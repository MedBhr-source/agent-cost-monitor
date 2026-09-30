"""FastAPI backend for the Agent Cost Monitor.

REST endpoints for starting crews, querying metrics, human review, and
CSV export. A WebSocket endpoint streams live metric snapshots to the dashboard.
"""

import asyncio
import csv
import io
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from cost_tracker import tracker
from crew_simulator import run_simulated_crew

app = FastAPI(title="Agent Cost Monitor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CrewRunRequest(BaseModel):
    topic: str = "Multi-agent AI systems"
    budget: float = 5.00
    duration_budget: int = 600
    scenario: str = "customer_reviews"
    slack_webhook: Optional[str] = None


class HitlDecisionRequest(BaseModel):
    decision: str


class LogCallRequest(BaseModel):
    agent_id: str
    model: str = "gpt-4-turbo"
    input_tokens: int = 0
    output_tokens: int = 0


@app.post("/api/run-crew")
async def start_crew(req: CrewRunRequest):
    """Start a new simulated crew run."""
    crew_id = uuid.uuid4().hex[:8]
    tracker.start_crew(
        crew_id,
        req.budget,
        req.duration_budget,
        scenario=req.scenario,
        slack_webhook=req.slack_webhook,
    )
    asyncio.create_task(run_simulated_crew(crew_id))
    return {
        "crew_id": crew_id,
        "status": "running",
        "budget": req.budget,
        "scenario": req.scenario,
    }


@app.get("/api/metrics/{crew_id}")
async def get_metrics(crew_id: str):
    """Return the full metrics snapshot for a crew."""
    metrics = tracker.get_metrics(crew_id)
    if not metrics:
        raise HTTPException(404, "Crew not found")
    return metrics


@app.get("/api/alerts/{crew_id}")
async def get_alerts(crew_id: str):
    """Return every alert generated during a crew run."""
    crew = tracker.crews.get(crew_id)
    if not crew:
        raise HTTPException(404, "Crew not found")
    return {"alerts": crew["alerts"]}


@app.post("/api/pause/{crew_id}/{agent_id}")
async def pause_agent(crew_id: str, agent_id: str):
    """Set the pause flag on an agent (simulator checks this flag)."""
    if not tracker.pause_agent(crew_id, agent_id):
        raise HTTPException(404, "Crew or agent not found")
    return {"status": "paused", "agent_id": agent_id}


@app.post("/api/resume/{crew_id}/{agent_id}")
async def resume_agent(crew_id: str, agent_id: str):
    """Clear the pause flag so the agent can continue."""
    if not tracker.resume_agent(crew_id, agent_id):
        raise HTTPException(404, "Crew or agent not found")
    return {"status": "resumed", "agent_id": agent_id}


@app.post("/api/hitl/{crew_id}/{event_id}")
async def resolve_hitl(crew_id: str, event_id: str, request: Request):
    payload = await request.json()
    decision = payload.get("decision")
    if decision not in {"resume", "kill"}:
        raise HTTPException(400, "decision must be 'resume' or 'kill'")

    event = tracker.resolve_hitl(crew_id, event_id, decision)
    if event is None:
        raise HTTPException(404, "HITL event not found")
    return {"status": "updated", "event_id": event_id, "decision": decision}


@app.post("/api/log/{crew_id}")
async def log_call(crew_id: str, req: LogCallRequest):
    """Record a single API call from an SDK or custom client."""
    crew = tracker.crews.get(crew_id)
    if not crew:
        raise HTTPException(404, "Crew not found")

    record = tracker.log_call(
        crew_id,
        req.agent_id,
        req.model,
        req.input_tokens,
        req.output_tokens,
    )
    return {"status": "logged", "record": record}


@app.get("/api/history")
async def get_history():
    return {"runs": tracker.get_history()}


@app.get("/api/export/{crew_id}")
async def export_csv(crew_id: str):
    metrics = tracker.get_metrics(crew_id)
    if not metrics:
        raise HTTPException(404, "Crew not found")

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["agent_id", "total_calls", "total_tokens", "total_cost", "avg_cost_per_call", "recent_calls_5min", "paused"])
    for agent in metrics.get("agents", []):
        writer.writerow([
            agent["agent_id"],
            agent["total_calls"],
            agent["total_tokens"],
            agent["total_cost"],
            agent["avg_cost_per_call"],
            agent["recent_calls_5min"],
            agent["paused"],
        ])

    csv_text = buffer.getvalue()
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{crew_id}.csv"'},
    )


@app.get("/api/crews")
async def list_crews():
    """Quick overview of every crew run (current and past)."""
    return {
        cid: {
            "status": c["status"],
            "total_cost": round(c["total_cost"], 4),
            "budget": c["budget"],
        }
        for cid, c in tracker.crews.items()
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/{crew_id}")
async def ws_metrics(websocket: WebSocket, crew_id: str):
    """Push a metrics snapshot every 1.5 s until the client disconnects."""
    await websocket.accept()
    try:
        while True:
            metrics = tracker.get_metrics(crew_id)
            if metrics:
                await websocket.send_json({"type": "metrics_update", **metrics})
            await asyncio.sleep(1.5)
    except (WebSocketDisconnect, Exception):
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
