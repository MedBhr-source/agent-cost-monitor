"""Unit tests for cost tracking and rules engine.

Run with:  pytest test_cost_tracker.py -v
"""

import pytest
from cost_tracker import CostTracker, tracker
import rules_engine
from agent_monitor_sdk import AgentMonitor


@pytest.fixture(autouse=True)
def clean():
    """Reset global tracker state between tests."""
    tracker.crews.clear()
    yield


# ── CostTracker tests ─────────────────────────────────────────

class TestCostTracker:

    def test_crew_starts_at_zero(self):
        tracker.start_crew("t1", budget=5.0)
        m = tracker.get_metrics("t1")
        assert m["total_cost"] == 0
        assert m["total_calls"] == 0
        assert m["status"] == "running"

    def test_cost_calculation_gpt4_turbo(self):
        tracker.start_crew("t2", budget=5.0)
        # GPT-4-turbo pricing: $3/M input, $6/M output
        # 1000 input + 100 output → 0.003 + 0.0006 = 0.0036
        result = tracker.log_call("t2", "a", "gpt-4-turbo", 1000, 100)
        assert abs(result["cost"] - 0.0036) < 0.0001

    def test_calls_accumulate(self):
        tracker.start_crew("t3", budget=5.0)
        for _ in range(5):
            tracker.log_call("t3", "a", "gpt-4-turbo", 500, 100)
        m = tracker.get_metrics("t3")
        assert m["total_calls"] == 5
        assert m["agents"][0]["total_calls"] == 5

    def test_multiple_agents(self):
        tracker.start_crew("t4", budget=5.0)
        tracker.log_call("t4", "agent_a", "gpt-4-turbo", 100, 50)
        tracker.log_call("t4", "agent_b", "claude-3-sonnet", 100, 50)
        m = tracker.get_metrics("t4")
        assert m["total_calls"] == 2
        assert len(m["agents"]) == 2

    def test_pause_and_resume(self):
        tracker.start_crew("t5", budget=5.0)
        tracker.log_call("t5", "a", "gpt-4-turbo", 100, 50)
        tracker.pause_agent("t5", "a")
        assert tracker.is_paused("t5", "a")
        tracker.resume_agent("t5", "a")
        assert not tracker.is_paused("t5", "a")

    def test_finalize_changes_status(self):
        tracker.start_crew("t6", budget=5.0)
        tracker.finalize("t6", "completed")
        m = tracker.get_metrics("t6")
        assert m["status"] == "completed"

    def test_live_feed_records_agent_events(self):
        tracker.start_crew("t7", budget=5.0)
        tracker.log_call("t7", "researcher", "gpt-4-turbo", 1000, 500)
        m = tracker.get_metrics("t7")
        assert isinstance(m["log_feed"], list)
        assert len(m["log_feed"]) >= 1
        assert m["log_feed"][0]["agent"] == "researcher"
        assert m["log_feed"][0]["type"] == "call"


# ── Rules engine tests ─────────────────────────────────────────

class TestRulesEngine:

    def test_runaway_loop_detected(self):
        tracker.start_crew("r1", budget=5.0)
        for _ in range(25):
            tracker.log_call("r1", "bad_agent", "gpt-4-turbo", 100, 50)
        alerts = rules_engine.evaluate("r1")
        assert any(a["rule"] == "runaway_loop" for a in alerts)

    def test_budget_exceeded(self):
        tracker.start_crew("r2", budget=0.001)  # tiny budget
        tracker.log_call("r2", "a", "gpt-4-turbo", 10000, 5000)
        alerts = rules_engine.evaluate("r2")
        assert any(a["rule"] == "budget_exceeded" for a in alerts)

    def test_no_alerts_under_budget(self):
        tracker.start_crew("r3", budget=100.0)
        tracker.log_call("r3", "a", "gpt-4-turbo", 100, 50)
        alerts = rules_engine.evaluate("r3")
        budget_alerts = [a for a in alerts if "budget" in a["rule"]]
        assert len(budget_alerts) == 0

    def test_no_duplicate_alerts(self):
        tracker.start_crew("r4", budget=0.001)
        tracker.log_call("r4", "a", "gpt-4-turbo", 10000, 5000)
        rules_engine.evaluate("r4")  # first eval
        alerts2 = rules_engine.evaluate("r4")  # second eval
        assert len(alerts2) == 0  # no duplicates


def test_agent_monitor_sdk_creates_run_and_logs_cost(monkeypatch):
    monitor = AgentMonitor(base_url="http://localhost:8000", budget=5.0)
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs.get("json")))

        class DummyResponse:
            ok = True

            def __init__(self, url):
                self.url = url

            def raise_for_status(self):
                return None

            def json(self):
                if "/api/run-crew" in self.url:
                    return {"crew_id": "sdk123", "status": "running"}
                return {
                    "status": "logged",
                    "record": {"agent_id": "researcher", "model": "gpt-4-turbo", "cost": 0.0036},
                }

        return DummyResponse(url)

    monkeypatch.setattr("agent_monitor_sdk.requests.post", fake_post)
    with monitor.crew("demo-run") as ctx:
        assert ctx.crew_id == "sdk123"
        response = ctx.log("researcher", "gpt-4-turbo", 1000, 500)
        assert response["status"] == "logged"

    assert len(calls) >= 2
