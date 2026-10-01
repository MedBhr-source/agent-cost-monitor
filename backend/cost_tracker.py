"""In-memory cost tracking for agent API calls."""

import logging
import uuid
from datetime import datetime
from threading import Lock
from typing import Callable, Dict, Optional

logger = logging.getLogger("agent_monitor.tracker")

DEFAULT_PRICING: Dict[str, dict] = {
    "gpt-4o": {"provider": "OpenAI", "input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"provider": "OpenAI", "input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"provider": "OpenAI", "input": 3.00, "output": 6.00},
    "gpt-4": {"provider": "OpenAI", "input": 30.00, "output": 60.00},
    "gpt-3.5-turbo": {"provider": "OpenAI", "input": 0.50, "output": 1.50},
    "claude-3-5-sonnet": {"provider": "Anthropic", "input": 3.00, "output": 15.00},
    "claude-3-sonnet": {"provider": "Anthropic", "input": 3.00, "output": 15.00},
    "claude-3-haiku": {"provider": "Anthropic", "input": 0.25, "output": 1.25},
    "deepseek-v3": {"provider": "DeepSeek", "input": 0.14, "output": 0.28},
    "deepseek-r1": {"provider": "DeepSeek", "input": 0.55, "output": 2.19},
    "gemini-1.5-pro": {"provider": "Google", "input": 1.25, "output": 5.00},
    "gemini-1.5-flash": {"provider": "Google", "input": 0.075, "output": 0.30},
    "llama-3.3-70b": {"provider": "Meta / Local", "input": 0.55, "output": 0.80},
}


class CostTracker:
    def __init__(self):
        self._lock = Lock()
        self.crews: Dict[str, dict] = {}
        self.run_history: list[dict] = []
        self.pricing: Dict[str, dict] = {k: dict(v) for k, v in DEFAULT_PRICING.items()}
        self._on_finalize: Optional[Callable] = None

    def set_on_finalize(self, callback: Optional[Callable] = None):
        self._on_finalize = callback

    def get_all_pricing(self) -> list[dict]:
        with self._lock:
            return [
                {
                    "model": model,
                    "provider": data.get("provider", "Custom"),
                    "input_cost": data.get("input", 1.0),
                    "output_cost": data.get("output", 2.0),
                }
                for model, data in self.pricing.items()
            ]

    def set_price(self, model: str, input_cost: float, output_cost: float, provider: str = "Custom"):
        with self._lock:
            self.pricing[model] = {
                "provider": provider or "Custom",
                "input": float(input_cost),
                "output": float(output_cost),
            }

    def delete_price(self, model: str) -> bool:
        with self._lock:
            if model in self.pricing:
                del self.pricing[model]
                return True
            return False

    def load_pricing_from_db(self, db_prices: list[dict]):
        with self._lock:
            for item in db_prices:
                self.pricing[item["model"]] = {
                    "provider": item.get("provider", "Custom"),
                    "input": float(item.get("input_cost", 1.0)),
                    "output": float(item.get("output_cost", 2.0)),
                }

    def start_crew(
        self,
        crew_id: str,
        budget: float,
        duration_budget: int = 600,
        scenario: str = "customer_reviews",
        slack_webhook: Optional[str] = None,
    ) -> str:
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
        logger.info("Crew %s started (budget=%.2f, scenario=%s)", crew_id, budget, scenario)
        return crew_id

    def finalize(self, crew_id: str, status: str = "completed"):
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

        if self._on_finalize:
            try:
                self._on_finalize(run)
            except Exception as exc:
                logger.warning("Finalize callback failed: %s", exc)
        logger.info("Crew %s finalized (status=%s, cost=%.4f)", crew_id, status, crew["total_cost"])

    def log_call(self, crew_id: str, agent_id: str, model: str,
                 input_tokens: int, output_tokens: int) -> dict:
        rates = self.pricing.get(model, {"input": 3.0, "output": 6.0})
        cost = (input_tokens * rates["input"]
                + output_tokens * rates["output"]) / 1_000_000

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
                "message": f"{agent_id} completed a model call ({model})",
                "tokens": input_tokens + output_tokens,
                "cost": round(cost, 6),
            }
            crew["log_feed"].append(feed_entry)
            if len(crew["log_feed"]) > 150:
                crew["log_feed"] = crew["log_feed"][-150:]

        return record

    def get_metrics(self, crew_id: str) -> Optional[dict]:
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


tracker = CostTracker()
