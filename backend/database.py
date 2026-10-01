"""SQLAlchemy models and optional persistence layer."""

import logging
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, DateTime, Float, Integer, JSON, String, Text,
    create_engine,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("agent_monitor.db")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agent_monitor.db")
_is_postgres = DATABASE_URL.startswith("postgresql")

_engine_kwargs: dict = {"echo": False}
if _is_postgres:
    _engine_kwargs.update(pool_size=5, max_overflow=10, pool_pre_ping=True)

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


def _utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CrewRun(Base):
    __tablename__ = "crew_runs"

    id = Column(String, primary_key=True)
    topic = Column(Text)
    scenario = Column(String(64), nullable=True)
    budget = Column(Float)
    total_cost = Column(Float, default=0.0)
    total_calls = Column(Integer, default=0)
    status = Column(String(32), default="running")
    started_at = Column(DateTime, default=_utc_now)
    ended_at = Column(DateTime, nullable=True)
    agents_json = Column(JSON, default=list)
    alerts_json = Column(JSON, default=list)


class ApiCallLog(Base):
    __tablename__ = "api_call_logs"

    id = Column(String, primary_key=True)
    crew_id = Column(String, index=True)
    agent_id = Column(String(64))
    model = Column(String(64))
    input_tokens = Column(Integer)
    output_tokens = Column(Integer)
    cost = Column(Float)
    created_at = Column(DateTime, default=_utc_now)


class ModelPrice(Base):
    __tablename__ = "model_prices"

    model = Column(String(64), primary_key=True)
    provider = Column(String(64), default="Custom")
    input_cost = Column(Float, default=1.0)
    output_cost = Column(Float, default=2.0)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)


DEFAULT_MODEL_PRICES = [
    {"model": "gpt-4o", "provider": "OpenAI", "input_cost": 2.50, "output_cost": 10.00},
    {"model": "gpt-4o-mini", "provider": "OpenAI", "input_cost": 0.15, "output_cost": 0.60},
    {"model": "gpt-4-turbo", "provider": "OpenAI", "input_cost": 3.00, "output_cost": 6.00},
    {"model": "gpt-4", "provider": "OpenAI", "input_cost": 30.00, "output_cost": 60.00},
    {"model": "gpt-3.5-turbo", "provider": "OpenAI", "input_cost": 0.50, "output_cost": 1.50},
    {"model": "claude-3-5-sonnet", "provider": "Anthropic", "input_cost": 3.00, "output_cost": 15.00},
    {"model": "claude-3-sonnet", "provider": "Anthropic", "input_cost": 3.00, "output_cost": 15.00},
    {"model": "claude-3-haiku", "provider": "Anthropic", "input_cost": 0.25, "output_cost": 1.25},
    {"model": "deepseek-v3", "provider": "DeepSeek", "input_cost": 0.14, "output_cost": 0.28},
    {"model": "deepseek-r1", "provider": "DeepSeek", "input_cost": 0.55, "output_cost": 2.19},
    {"model": "gemini-1.5-pro", "provider": "Google", "input_cost": 1.25, "output_cost": 5.00},
    {"model": "gemini-1.5-flash", "provider": "Google", "input_cost": 0.075, "output_cost": 0.30},
    {"model": "llama-3.3-70b", "provider": "Meta / Local", "input_cost": 0.55, "output_cost": 0.80},
]

_db_available = False


def init_db():
    global _db_available
    try:
        Base.metadata.create_all(bind=engine)
        _db_available = True
        _seed_default_pricing()
        mode = "PostgreSQL" if _is_postgres else "SQLite"
        logger.info("Database ready (%s)", mode)
    except SQLAlchemyError as exc:
        _db_available = False
        logger.warning("Database unavailable, using in-memory mode: %s", exc)


def _seed_default_pricing():
    if not _db_available:
        return
    try:
        session = SessionLocal()
        existing_count = session.query(ModelPrice).count()
        if existing_count == 0:
            for item in DEFAULT_MODEL_PRICES:
                session.add(ModelPrice(
                    model=item["model"],
                    provider=item["provider"],
                    input_cost=item["input_cost"],
                    output_cost=item["output_cost"],
                    updated_at=_utc_now(),
                ))
            session.commit()
            logger.info("Seeded %d default model prices", len(DEFAULT_MODEL_PRICES))
        session.close()
    except SQLAlchemyError as exc:
        logger.warning("Pricing seed skipped: %s", exc)


def db_available() -> bool:
    return _db_available


def save_crew_run(run_data: dict):
    if not _db_available:
        return
    try:
        session = SessionLocal()
        row = CrewRun(
            id=run_data.get("id", uuid.uuid4().hex[:8]),
            topic=run_data.get("scenario", ""),
            scenario=run_data.get("scenario"),
            budget=run_data.get("budget", 0),
            total_cost=run_data.get("total_cost", 0),
            total_calls=run_data.get("total_calls", 0),
            status=run_data.get("status", "completed"),
            started_at=_parse_iso(run_data.get("started_at")),
            ended_at=_parse_iso(run_data.get("ended_at")),
            agents_json=run_data.get("agents", []),
            alerts_json=run_data.get("alerts", []),
        )
        session.merge(row)
        session.commit()
        session.close()
        logger.debug("Persisted crew run %s", run_data.get("id"))
    except SQLAlchemyError as exc:
        logger.warning("Failed to persist crew run: %s", exc)


def get_run_history_db(limit: int = 50) -> list:
    if not _db_available:
        return []
    try:
        session = SessionLocal()
        rows = (
            session.query(CrewRun)
            .order_by(CrewRun.started_at.desc())
            .limit(limit)
            .all()
        )
        result = [
            {
                "id": r.id,
                "scenario": r.scenario or r.topic,
                "status": r.status,
                "budget": r.budget,
                "total_cost": r.total_cost,
                "total_calls": r.total_calls,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "ended_at": r.ended_at.isoformat() if r.ended_at else None,
                "agents": r.agents_json or [],
                "alerts": r.alerts_json or [],
            }
            for r in rows
        ]
        session.close()
        return result
    except SQLAlchemyError as exc:
        logger.warning("Failed to load run history from DB: %s", exc)
        return []


def get_model_prices_db() -> list:
    if not _db_available:
        return []
    try:
        session = SessionLocal()
        rows = session.query(ModelPrice).order_by(ModelPrice.provider, ModelPrice.model).all()
        result = [
            {
                "model": r.model,
                "provider": r.provider,
                "input_cost": r.input_cost,
                "output_cost": r.output_cost,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]
        session.close()
        return result
    except SQLAlchemyError as exc:
        logger.warning("Failed to load model prices from DB: %s", exc)
        return []


def save_model_price_db(model: str, input_cost: float, output_cost: float, provider: str = "Custom") -> dict:
    now = _utc_now()
    if not _db_available:
        return {
            "model": model,
            "provider": provider,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "updated_at": now.isoformat(),
        }
    try:
        session = SessionLocal()
        row = ModelPrice(
            model=model,
            provider=provider or "Custom",
            input_cost=input_cost,
            output_cost=output_cost,
            updated_at=now,
        )
        session.merge(row)
        session.commit()
        session.close()
        return {
            "model": model,
            "provider": provider or "Custom",
            "input_cost": input_cost,
            "output_cost": output_cost,
            "updated_at": now.isoformat(),
        }
    except SQLAlchemyError as exc:
        logger.warning("Failed to save model price in DB: %s", exc)
        return {
            "model": model,
            "provider": provider,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "updated_at": now.isoformat(),
        }


def delete_model_price_db(model: str) -> bool:
    if not _db_available:
        return False
    try:
        session = SessionLocal()
        row = session.query(ModelPrice).filter(ModelPrice.model == model).first()
        if row:
            session.delete(row)
            session.commit()
            session.close()
            return True
        session.close()
        return False
    except SQLAlchemyError as exc:
        logger.warning("Failed to delete model price in DB: %s", exc)
        return False


def _parse_iso(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None
