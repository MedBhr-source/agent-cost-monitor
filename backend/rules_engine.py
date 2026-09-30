"""Alert rules engine for detecting cost anomalies.

Evaluates crew metrics against configurable thresholds and generates
alerts. Built-in deduplication prevents the same rule from firing
more than once for the same agent within a crew run.
"""

from datetime import datetime

from cost_tracker import tracker

# ── Configurable thresholds ────────────────────────────────────
RUNAWAY_CALL_LIMIT = 20        # max calls per agent in 5 min window
BUDGET_WARNING_PCT = 80        # alert when usage exceeds this %
SLOW_EXECUTION_FACTOR = 1.5    # alert when duration > budget × factor
COST_DRIFT_FACTOR = 2.0        # alert when last call > avg × factor


def evaluate(crew_id: str) -> list[dict]:
    """Run every rule against *crew_id* and return **new** alerts only."""
    crew = tracker.crews.get(crew_id)
    if not crew or crew["status"] != "running":
        return []

    now = datetime.now()
    new_alerts: list[dict] = []
    seen = {f"{a['rule']}:{a.get('agent_id', '')}" for a in crew["alerts"]}

    def _add(alert: dict):
        key = f"{alert['rule']}:{alert.get('agent_id', '')}"
        if key not in seen:
            seen.add(key)
            new_alerts.append(alert)
            tracker.add_alert(crew_id, alert)

    if crew["budget"] > 0:
        pct = crew["total_cost"] / crew["budget"] * 100
        if crew["total_cost"] > crew["budget"]:
            _add(_make(
                "budget_exceeded",
                "CRITICAL",
                f"Budget exceeded: ${crew['total_cost']:.2f} > ${crew['budget']:.2f}",
                crew_id,
                action="PAUSE_ALL",
            ))
        elif pct > BUDGET_WARNING_PCT:
            _add(_make(
                "budget_warning",
                "HIGH",
                f"Budget {pct:.0f}% used (${crew['total_cost']:.2f} / ${crew['budget']:.2f})",
                crew_id,
            ))

    elapsed = (now - crew["start_time"]).total_seconds()
    if elapsed > crew["duration_budget"] * SLOW_EXECUTION_FACTOR:
        _add(_make(
            "slow_execution",
            "MEDIUM",
            f"Running {elapsed / crew['duration_budget']:.1f}× longer than expected",
            crew_id,
        ))

    for agent_id, agent in crew["agents"].items():
        if agent["paused"]:
            continue

        recent = sum(
            1
            for c in agent["history"]
            if (now - datetime.fromisoformat(c["timestamp"])).total_seconds() < 300
        )
        if recent > RUNAWAY_CALL_LIMIT:
            alert = _make(
                "runaway_loop",
                "HIGH",
                f"Agent '{agent_id}' made {recent} calls in 5 min (limit: {RUNAWAY_CALL_LIMIT})",
                crew_id,
                agent_id=agent_id,
                action="PAUSE_AGENT",
            )
            _add(alert)
            tracker.add_hitl_event(
                crew_id,
                agent_id,
                alert["message"],
                recent,
                agent.get("cost", 0.0),
            )

        if len(agent["history"]) >= 3:
            costs = [c["cost"] for c in agent["history"]]
            avg = sum(costs) / len(costs)
            last = costs[-1]
            if avg > 0 and last > avg * COST_DRIFT_FACTOR:
                _add(_make(
                    "cost_drift",
                    "LOW",
                    f"Agent '{agent_id}' last call ${last:.4f} vs avg ${avg:.4f}",
                    crew_id,
                    agent_id=agent_id,
                ))

    return new_alerts


def _make(rule, severity, message, crew_id, agent_id=None, action="ALERT_ONLY"):
    """Build a well-formed alert dict."""
    alert = {
        "rule": rule,
        "severity": severity,
        "message": message,
        "crew_id": crew_id,
        "action": action,
        "timestamp": datetime.now().isoformat(),
    }
    if agent_id:
        alert["agent_id"] = agent_id
    return alert
