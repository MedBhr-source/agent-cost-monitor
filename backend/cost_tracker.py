"""In-memory cost tracking for agent API calls.

Stores real-time metrics per crew and per agent. Thread-safe so the
FastAPI background simulation tasks and the WebSocket reader never clash.
No Redis or database required — just run the server and go.
"""

import uuid
from datetime import datetime
from threading import Lock
from typing import Dict, Optional

# ── Model pricing (USD per 1 million tokens) ───────────────────
MODEL_PRICING: Dict[str, Dict[str, float]] = {
    "gpt-4-turbo": {"input": 3.00, "output": 6.00},
    "gpt-4": {"input": 30.00, "output": 60.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    "claude-3-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-haiku": {"input": 0.80, "output": 4.00},
}


class CostTracker:
    """Singleton-style tracker that all modules share."""

    def __init__(self):
        self._lock = Lock()
        self.crews: Dict[str, dict] = {}
        self.run_history: list[dict] = []

    # ── Lifecycle ──────────────────────────────────────────────

    def start_crew(
        self,
        crew_id: str,
        budget: float,
        duration_budget: int = 600,
        scenario: str = "customer_reviews",
        slack_webhook: Optional[str] = None,
    ) -> str:
        """Create a new crew run and begin tracking."""
        with self._lock:
            self.crews[crew_id] = {
                "budget": budget,
                "duration_budget": duration_budget,
                "start_time": datetime.now(),
                "status": "running",
                "total_cost": 0.0,
                "total_calls": 0,
                "scenario": scenario,
                "slack_webhook": slack_webhook,
                "agents": {},
                "alerts": [],
                "hitl_queue": [],
                "cost_timeline": [],
                "log_feed": [],
            }
        return crew_id

    def finalize(self, crew_id: str, status: str = "completed"):
        """Mark a crew run as finished."""
        crew = self.crews.get(crew_id)
        if not crew:
            return

        if crew.get("status") in {"completed", "budget_exceeded", "failed", "killed_by_human"}:
            return

        crew["status"] = status
        run = {
            "id": crew_id,
            "scenario": crew.get("scenario", "customer_reviews"),
            "status": status,
            "budget": round(crew["budget"], 2),
            "total_cost": round(crew["total_cost"], 4),
            "total_calls": crew["total_calls"],
            "started_at": crew["start_time"].isoformat(),
            "ended_at": datetime.now().isoformat(),
            "alerts": crew["alerts"],
            "agents": [
                {
                    "agent_id": aid,
                    "total_calls": a["calls"],
                    "total_tokens": a["tokens"],
                    "total_cost": round(a["cost"], 4),
                    "paused": a["paused"],
                }
                for aid, a in crew["agents"].items()
            ],
        }
        self.run_history.insert(0, run)
        if len(self.run_history) > 50:
            self.run_history = self.run_history[:50]

    # ── Logging ────────────────────────────────────────────────

    def log_call(self, crew_id: str, agent_id: str, model: str,
                 input_tokens: int, output_tokens: int) -> dict:
        """Record a single API call and return a receipt."""
        pricing = MODEL_PRICING.get(model, {"input": 3.0, "output": 6.0})
        cost = (input_tokens * pricing["input"]
                + output_tokens * pricing["output"]) / 1_000_000

        now = datetime.now()
        record = {
            "id": uuid.uuid4().hex[:8],
            "timestamp": now.isoformat(),
            "agent_id": agent_id,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost": round(cost, 6),
        }

        with self._lock:
            crew = self.crews.get(crew_id)
            if not crew:
                return record

            crew["total_cost"] += cost
            crew["total_calls"] += 1

            crew["cost_timeline"].append({
                "time": now.strftime("%H:%M:%S"),
                "cost": round(crew["total_cost"], 4),
                "calls": crew["total_calls"],
            })
            if len(crew["cost_timeline"]) > 200:
                crew["cost_timeline"] = crew["cost_timeline"][-200:]

            if agent_id not in crew["agents"]:
                crew["agents"][agent_id] = {
                    "calls": 0,
                    "tokens": 0,
                    "cost": 0.0,
                    "history": [],
                    "paused": False,
                }
            agent = crew["agents"][agent_id]
            agent["calls"] += 1
            agent["tokens"] += input_tokens + output_tokens
            agent["cost"] += cost
            agent["history"].append(record)
            if len(agent["history"]) > 100:
                agent["history"] = agent["history"][-100:]

            feed_entry = {
                "time": now.strftime("%H:%M:%S"),
                "agent": agent_id,
                "type": "call",
                "message": f"{agent_id} completed a model call",
                "tokens": input_tokens + output_tokens,
                "cost": round(cost, 6),
            }
            crew["log_feed"].append(feed_entry)
            if len(crew["log_feed"]) > 150:
                crew["log_feed"] = crew["log_feed"][-150:]

        return record

    # ── Queries ────────────────────────────────────────────────

    def get_metrics(self, crew_id: str) -> Optional[dict]:
        """Build a full metrics snapshot for the frontend."""
        crew = self.crews.get(crew_id)
        if not crew:
            return None

        elapsed = (datetime.now() - crew["start_time"]).total_seconds()
        budget_pct = (
            crew["total_cost"] / crew["budget"] * 100 if crew["budget"] > 0 else 0
        )

        now = datetime.now()
        agent_list = []
        for aid, a in crew["agents"].items():
            recent = sum(
                1
                for c in a["history"]
                if (now - datetime.fromisoformat(c["timestamp"])).total_seconds() < 300
            )
            agent_list.append({
                "agent_id": aid,
                "total_calls": a["calls"],
                "total_tokens": a["tokens"],
                "total_cost": round(a["cost"], 4),
                "avg_cost_per_call": round(a["cost"] / a["calls"], 6) if a["calls"] else 0,
                "recent_calls_5min": recent,
                "paused": a["paused"],
            })

        return {
            "crew_id": crew_id,
            "scenario": crew.get("scenario", "customer_reviews"),
            "slack_webhook": crew.get("slack_webhook"),
            "total_cost": round(crew["total_cost"], 4),
            "total_calls": crew["total_calls"],
            "budget": crew["budget"],
            "budget_used_pct": round(budget_pct, 1),
            "duration_seconds": int(elapsed),
            "status": crew["status"],
            "agents": agent_list,
            "cost_timeline": crew["cost_timeline"],
            "alerts": crew["alerts"],
            "hitl_queue": crew["hitl_queue"],
            "log_feed": crew.get("log_feed", []),
        }

    def get_history(self):
        return list(self.run_history)

    # ── Agent control ──────────────────────────────────────────

    def pause_agent(self, crew_id: str, agent_id: str) -> bool:
        crew = self.crews.get(crew_id)
        if not crew or agent_id not in crew["agents"]:
            return False
        crew["agents"][agent_id]["paused"] = True
        crew["alerts"].append({
            "rule": "manual_pause",
            "severity": "INFO",
            "message": f"Agent '{agent_id}' was manually paused",
            "agent_id": agent_id,
            "timestamp": datetime.now().isoformat(),
            "action": "PAUSE_AGENT",
        })
        return True

    def resume_agent(self, crew_id: str, agent_id: str) -> bool:
        crew = self.crews.get(crew_id)
        if not crew or agent_id not in crew["agents"]:
            return False
        crew["agents"][agent_id]["paused"] = False
        return True

    def is_paused(self, crew_id: str, agent_id: str) -> bool:
        crew = self.crews.get(crew_id)
        if not crew or agent_id not in crew["agents"]:
            return False
        return crew["agents"][agent_id]["paused"]

    def add_hitl_event(self, crew_id: str, agent_id: str, reason: str, calls: int, cost: float):
        crew = self.crews.get(crew_id)
        if not crew:
            return None
        event = {
            "id": uuid.uuid4().hex[:8],
            "agent_id": agent_id,
            "reason": reason,
            "calls": calls,
            "cost": round(cost, 4),
            "decision": None,
            "timestamp": datetime.now().isoformat(),
        }
        crew["hitl_queue"].append(event)
        return event

    def resolve_hitl(self, crew_id: str, event_id: str, decision: str):
        crew = self.crews.get(crew_id)
        if not crew:
            return None
        for event in crew["hitl_queue"]:
            if event["id"] == event_id:
                event["decision"] = decision
                if decision == "resume":
                    crew["agents"].get(event["agent_id"], {})["paused"] = False
                elif decision == "kill":
                    self.finalize(crew_id, "killed_by_human")
                return event
        return None

    def add_alert(self, crew_id: str, alert: dict):
        crew = self.crews.get(crew_id)
        if crew:
            crew["alerts"].append(alert)


# ── Module-level singleton ─────────────────────────────────────
tracker = CostTracker()
