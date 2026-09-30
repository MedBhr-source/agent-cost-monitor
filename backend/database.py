"""SQLAlchemy models for persistent storage.

Used for historical data and audit trails.  The in-memory tracker
(cost_tracker.py) handles all real-time work; this module is for
persisting completed crew runs to PostgreSQL (or SQLite in dev).
"""

import os
from datetime import datetime

from sqlalchemy import (
    Column, DateTime, Float, Integer, JSON, String, Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agent_monitor.db")

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class CrewRun(Base):
    __tablename__ = "crew_runs"

    id = Column(String, primary_key=True)
    topic = Column(Text)
    budget = Column(Float)
    total_cost = Column(Float, default=0.0)
    total_calls = Column(Integer, default=0)
    status = Column(String(32), default="running")
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
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
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    """Create tables if they don't already exist."""
    Base.metadata.create_all(bind=engine)
