"""FastAPI backend for the Agent Cost Monitor."""

import asyncio
import csv
import io
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import (
    Depends, FastAPI, HTTPException, Request, Response,
    WebSocket, WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field, field_validator

from cost_tracker import tracker
from crew_simulator import run_simulated_crew
from database import (
    init_db, save_crew_run, get_run_history_db,
    get_model_prices_db, save_model_price_db, delete_model_price_db,
)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("agent_monitor.api")

API_KEY: Optional[str] = os.getenv("API_KEY")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(key: Optional[str] = Depends(_api_key_header)):
    if not API_KEY:
        return
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Agent Cost Monitor starting up")
    try:
        init_db()
        db_prices = get_model_prices_db()
        if db_prices:
            tracker.load_pricing_from_db(db_prices)
    except Exception as exc:
        logger.warning("DB init skipped: %s", exc)
    tracker.set_on_finalize(save_crew_run)
    yield
    logger.info("Agent Cost Monitor shutting down")


app = FastAPI(title="Agent Cost Monitor", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed_ms = (time.time() - start) * 1000
    logger.info(
        "%s %s -> %d (%.0fms)",
        request.method, request.url.path, response.status_code, elapsed_ms,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


VALID_SCENARIOS = {"customer_reviews", "market_research", "code_review"}


class CrewRunRequest(BaseModel):
    topic: str = Field(default="Multi-agent AI systems", min_length=1, max_length=500)
    budget: float = Field(default=5.00, gt=0, le=10000)
    duration_budget: int = Field(default=600, ge=10, le=86400)
    scenario: str = Field(default="customer_reviews")
    slack_webhook: Optional[str] = None

    @field_validator("scenario")
    @classmethod
    def validate_scenario(cls, v):
        if v not in VALID_SCENARIOS:
            raise ValueError(f"scenario must be one of {sorted(VALID_SCENARIOS)}")
        return v


class HitlDecisionRequest(BaseModel):
    decision: str

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v):
        if v not in {"resume", "kill"}:
            raise ValueError("decision must be 'resume' or 'kill'")
        return v


class LogCallRequest(BaseModel):
    agent_id: str = Field(min_length=1, max_length=64)
    model: str = Field(default="gpt-4-turbo", min_length=1, max_length=64)
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)


class ModelPriceRequest(BaseModel):
    model: str = Field(min_length=1, max_length=64)
    provider: str = Field(default="Custom", min_length=1, max_length=64)
    input_cost: float = Field(default=1.0, ge=0, le=1000)
    output_cost: float = Field(default=2.0, ge=0, le=1000)


@app.post("/api/run-crew", dependencies=[Depends(verify_api_key)])
async def start_crew(req: CrewRunRequest):
    try:
        crew_id = uuid.uuid4().hex[:8]
        tracker.start_crew(
            crew_id,
            req.budget,
            req.duration_budget,
            scenario=req.scenario,
            slack_webhook=req.slack_webhook,
        )
        asyncio.create_task(run_simulated_crew(crew_id))
        logger.info(
            "Crew %s started (scenario=%s, budget=%.2f)",
            crew_id, req.scenario, req.budget,
        )
        return {
            "crew_id": crew_id,
            "status": "running",
            "budget": req.budget,
            "scenario": req.scenario,
        }
    except Exception:
        logger.exception("Failed to start crew")
        raise HTTPException(status_code=500, detail="Failed to start crew run")


@app.get("/api/metrics/{crew_id}", dependencies=[Depends(verify_api_key)])
async def get_metrics(crew_id: str):
    metrics = tracker.get_metrics(crew_id)
    if not metrics:
        raise HTTPException(404, "Crew not found")
    return metrics


@app.get("/api/alerts/{crew_id}", dependencies=[Depends(verify_api_key)])
async def get_alerts(crew_id: str):
    crew = tracker.crews.get(crew_id)
    if not crew:
        raise HTTPException(404, "Crew not found")
    return {"alerts": crew["alerts"]}


@app.post("/api/pause/{crew_id}/{agent_id}", dependencies=[Depends(verify_api_key)])
async def pause_agent(crew_id: str, agent_id: str):
    if not tracker.pause_agent(crew_id, agent_id):
        raise HTTPException(404, "Crew or agent not found")
    logger.info("Agent %s paused in crew %s", agent_id, crew_id)
    return {"status": "paused", "agent_id": agent_id}


@app.post("/api/resume/{crew_id}/{agent_id}", dependencies=[Depends(verify_api_key)])
async def resume_agent(crew_id: str, agent_id: str):
    if not tracker.resume_agent(crew_id, agent_id):
        raise HTTPException(404, "Crew or agent not found")
    logger.info("Agent %s resumed in crew %s", agent_id, crew_id)
    return {"status": "resumed", "agent_id": agent_id}


@app.post("/api/hitl/{crew_id}/{event_id}", dependencies=[Depends(verify_api_key)])
async def resolve_hitl(crew_id: str, event_id: str, req: HitlDecisionRequest):
    event = tracker.resolve_hitl(crew_id, event_id, req.decision)
    if event is None:
        raise HTTPException(404, "HITL event not found")
    logger.info(
        "HITL %s resolved as '%s' in crew %s", event_id, req.decision, crew_id,
    )
    return {"status": "updated", "event_id": event_id, "decision": req.decision}


@app.post("/api/log/{crew_id}", dependencies=[Depends(verify_api_key)])
async def log_call(crew_id: str, req: LogCallRequest):
    crew = tracker.crews.get(crew_id)
    if not crew:
        raise HTTPException(404, "Crew not found")
    record = tracker.log_call(
        crew_id, req.agent_id, req.model,
        req.input_tokens, req.output_tokens,
    )
    return {"status": "logged", "record": record}


@app.get("/api/history", dependencies=[Depends(verify_api_key)])
async def get_history():
    in_memory = tracker.get_history()
    from_db = get_run_history_db()
    seen_ids = {r["id"] for r in in_memory}
    merged = list(in_memory) + [r for r in from_db if r["id"] not in seen_ids]
    return {"runs": merged}


@app.get("/api/pricing", dependencies=[Depends(verify_api_key)])
async def get_pricing():
    return {"pricing": tracker.get_all_pricing()}


@app.post("/api/pricing", dependencies=[Depends(verify_api_key)])
async def update_pricing(req: ModelPriceRequest):
    tracker.set_price(req.model, req.input_cost, req.output_cost, req.provider)
    saved = save_model_price_db(req.model, req.input_cost, req.output_cost, req.provider)
    logger.info("Updated pricing for %s ($%.2f in / $%.2f out)", req.model, req.input_cost, req.output_cost)
    return {"status": "saved", "price": saved}


@app.delete("/api/pricing/{model}", dependencies=[Depends(verify_api_key)])
async def delete_pricing(model: str):
    tracker.delete_price(model)
    delete_model_price_db(model)
    logger.info("Deleted pricing for %s", model)
    return {"status": "deleted", "model": model}


@app.get("/api/export/{crew_id}", dependencies=[Depends(verify_api_key)])
async def export_csv(crew_id: str):
    metrics = tracker.get_metrics(crew_id)
    if not metrics:
        raise HTTPException(404, "Crew not found")

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "agent_id", "total_calls", "total_tokens", "total_cost",
        "avg_cost_per_call", "recent_calls_5min", "paused",
    ])
    for agent in metrics.get("agents", []):
        writer.writerow([
            agent["agent_id"], agent["total_calls"], agent["total_tokens"],
            agent["total_cost"], agent["avg_cost_per_call"],
            agent["recent_calls_5min"], agent["paused"],
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{crew_id}.csv"'},
    )


@app.get("/api/crews", dependencies=[Depends(verify_api_key)])
async def list_crews():
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
    await websocket.accept()
    logger.debug("WebSocket connected for crew %s", crew_id)
    try:
        while True:
            metrics = tracker.get_metrics(crew_id)
            if metrics:
                await websocket.send_json({"type": "metrics_update", **metrics})
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        logger.debug("WebSocket disconnected for crew %s", crew_id)
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
