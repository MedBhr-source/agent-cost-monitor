import pytest
from fastapi.testclient import TestClient
from cost_tracker import CostTracker, tracker
import rules_engine
from agent_monitor_sdk import AgentMonitor
import main
import database


@pytest.fixture(autouse=True)
def clean():
    tracker.crews.clear()
    database.init_db()
    yield


class TestCostTracker:

    def test_crew_starts_at_zero(self):
        tracker.start_crew("t1", budget=5.0)
        m = tracker.get_metrics("t1")
        assert m["total_cost"] == 0
        assert m["total_calls"] == 0
        assert m["status"] == "running"

    def test_cost_calculation_gpt4_turbo(self):
        tracker.start_crew("t2", budget=5.0)
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


class TestRulesEngine:

    def test_runaway_loop_detected(self):
        tracker.start_crew("r1", budget=5.0)
        for _ in range(25):
            tracker.log_call("r1", "bad_agent", "gpt-4-turbo", 100, 50)
        alerts = rules_engine.evaluate("r1")
        assert any(a["rule"] == "runaway_loop" for a in alerts)

    def test_budget_exceeded(self):
        tracker.start_crew("r2", budget=0.001)
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
        rules_engine.evaluate("r4")
        alerts2 = rules_engine.evaluate("r4")
        assert len(alerts2) == 0


class TestApiAndEndpoints:

    def test_health_check(self):
        client = TestClient(main.app)
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}

    def test_run_crew_validation_and_creation(self):
        client = TestClient(main.app)
        res = client.post("/api/run-crew", json={"scenario": "invalid_scenario", "budget": 5.0})
        assert res.status_code == 422

        res = client.post("/api/run-crew", json={"scenario": "customer_reviews", "budget": -5.0})
        assert res.status_code == 422

        res = client.post("/api/run-crew", json={"scenario": "customer_reviews", "budget": 3.5})
        assert res.status_code == 200
        data = res.json()
        assert "crew_id" in data
        assert data["status"] == "running"
        assert data["budget"] == 3.5

    def test_api_key_authentication(self, monkeypatch):
        monkeypatch.setattr(main, "API_KEY", "secret-test-key")
        client = TestClient(main.app)

        assert client.get("/api/health").status_code == 200

        res = client.get("/api/history")
        assert res.status_code == 401

        res = client.get("/api/history", headers={"X-API-Key": "wrong-key"})
        assert res.status_code == 401

        res = client.get("/api/history", headers={"X-API-Key": "secret-test-key"})
        assert res.status_code == 200

    def test_agent_pause_resume_endpoints(self):
        client = TestClient(main.app)
        tracker.start_crew("crew_api", budget=5.0)
        tracker.log_call("crew_api", "agent_1", "gpt-4-turbo", 100, 50)

        res = client.post("/api/pause/nonexistent/agent_1")
        assert res.status_code == 404

        res = client.post("/api/pause/crew_api/agent_1")
        assert res.status_code == 200
        assert tracker.is_paused("crew_api", "agent_1")

        res = client.post("/api/resume/crew_api/agent_1")
        assert res.status_code == 200
        assert not tracker.is_paused("crew_api", "agent_1")

    def test_hitl_endpoint(self):
        client = TestClient(main.app)
        tracker.start_crew("crew_hitl", budget=5.0)
        ev = tracker.add_hitl_event("crew_hitl", "bot1", "testing HITL", 10, 0.5)

        res = client.post(f"/api/hitl/crew_hitl/{ev['id']}", json={"decision": "invalid"})
        assert res.status_code == 422

        res = client.post(f"/api/hitl/crew_hitl/{ev['id']}", json={"decision": "resume"})
        assert res.status_code == 200
        assert res.json()["decision"] == "resume"

    def test_csv_export_endpoint(self):
        client = TestClient(main.app)
        tracker.start_crew("crew_csv", budget=5.0)
        tracker.log_call("crew_csv", "agent_x", "gpt-4-turbo", 500, 200)

        res = client.get("/api/export/crew_csv")
        assert res.status_code == 200
        assert "agent_x" in res.text
        assert "text/csv" in res.headers["content-type"]

    def test_pricing_endpoints_and_calculations(self):
        client = TestClient(main.app)
        # GET pricing
        res = client.get("/api/pricing")
        assert res.status_code == 200
        pricing = res.json()["pricing"]
        assert len(pricing) >= 5

        # POST new custom model pricing
        res = client.post("/api/pricing", json={
            "model": "deepseek-v3-custom",
            "provider": "DeepSeek",
            "input_cost": 0.14,
            "output_cost": 0.28,
        })
        assert res.status_code == 200

        # Verify call calculation uses the custom price
        tracker.start_crew("crew_pricing", budget=5.0)
        receipt = tracker.log_call("crew_pricing", "coder", "deepseek-v3-custom", 1_000_000, 1_000_000)
        assert abs(receipt["cost"] - 0.42) < 0.001

        # DELETE custom model pricing
        res = client.delete("/api/pricing/deepseek-v3-custom")
        assert res.status_code == 200
        assert res.json()["status"] == "deleted"


class TestDatabasePersistence:

    def test_save_and_retrieve_history(self):
        run_data = {
            "id": "db_test_1",
            "scenario": "market_research",
            "budget": 5.0,
            "total_cost": 0.045,
            "total_calls": 12,
            "status": "completed",
            "started_at": "2026-09-30T20:00:00",
            "ended_at": "2026-09-30T20:05:00",
            "agents": [{"agent_id": "researcher", "cost": 0.045}],
            "alerts": [],
        }
        database.save_crew_run(run_data)
        history = database.get_run_history_db()
        assert any(r["id"] == "db_test_1" for r in history)

    def test_save_and_retrieve_model_pricing(self):
        database.save_model_price_db("test-db-model", 0.5, 1.5, "Custom")
        prices = database.get_model_prices_db()
        assert any(p["model"] == "test-db-model" for p in prices)
        database.delete_model_price_db("test-db-model")
        prices_after = database.get_model_prices_db()
        assert not any(p["model"] == "test-db-model" for p in prices_after)


def test_agent_monitor_sdk_creates_run_and_logs_cost(monkeypatch):
    monitor = AgentMonitor(
        base_url="http://localhost:8000",
        budget=5.0,
        api_key="test-sdk-key",
        model_pricing={"custom-sdk-model": {"input": 1.0, "output": 2.0, "provider": "Custom"}},
    )
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs.get("json"), kwargs.get("headers")))

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
    assert calls[0][2].get("X-API-Key") == "test-sdk-key"
    assert calls[1][2].get("X-API-Key") == "test-sdk-key"
