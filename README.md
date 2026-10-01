# 🤖 Enterprise Agent Cost Monitor

A real-time observability, cost control, and intervention platform for multi-agent AI workflows (CrewAI, LangGraph, AutoGen, OpenAI Agents SDK).

## Problem

Multi-agent systems can spiral into expensive infinite loops. One runaway loop can waste hundreds of dollars in minutes. Teams lack real-time visibility into per-agent burn rates, token patterns, dynamic model pricing, and active mitigation tools.

## Solution

This platform:
- **Tracks every API call** in real time with precise token & model cost calculations.
- **Dynamic Model Pricing Table** — Configure custom per-1M input/output token rates for any model (OpenAI, Anthropic, DeepSeek, Google, Meta, local vLLM/Ollama, or private fine-tunes).
- **Detects runaway loops** automatically (>20 calls per agent in 5 minutes).
- **Enforces budget caps & predicts exhaustion** with burn-rate forecasting.
- **Auto-pauses runaway agents & prompts Human-in-the-Loop (HITL)** reviews.
- **Provides resilient WebSocket live-streaming** with auto-reconnect and polling fallback.
- **Supports optional PostgreSQL persistence** alongside SQLite / in-memory modes.
- **Secures endpoints with API key authentication** (`X-API-Key`).

## Features

- ✅ **Real-Time Cost & Token Tracking** — Live metrics per agent, per model, per step.
- ✅ **Dynamic Model Pricing Management** — Web UI & API to add, edit, and delete custom model pricing rates on the fly.
- ✅ **Runaway Loop Detection & Auto-Pause** — Immediate mitigation before budget depletion.
- ✅ **Human-in-the-Loop (HITL) Queue** — Review, resume, or kill suspicious agent executions.
- ✅ **Resilient WebSocket Streaming** — Automatic reconnection with exponential backoff and visual live status indicator.
- ✅ **API Key Authentication** — Protected REST endpoints via `X-API-Key` headers (with local dev bypass).
- ✅ **Flexible Persistence** — PostgreSQL for production or SQLite/in-memory for development.
- ✅ **Structured Logging & Global Error Handling** — Clean, concise HTTP request lifecycle logging and JSON error payloads.
- ✅ **Python SDK & Decorator** — One-line integration into existing CrewAI / Python pipelines with custom model pricing support.
- ✅ **CSV Export & Run History** — Historical analytics and downloadable run reports.

## Architecture

```text
User Dashboard (React + Vite + Tailwind CSS)
    ↕ WebSocket (Auto-reconnecting) + HTTP REST (X-API-Key Auth)
FastAPI Backend (Structured Logging + Request Validation)
    ↕ In-Memory Tracker (Thread-Safe Ring Buffers, Live Feed & Pricing Engine)
    ↕ SQLAlchemy Persistence (PostgreSQL / SQLite)
Simulated or Real Multi-Agent Crews (Python SDK)
```

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/health`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

- Dashboard: `http://localhost:3000`

### 3. Docker Compose

```bash
docker compose up --build
```

## Configuration

Copy `.env.example` to `.env` to configure optional settings:

```env
# Database (PostgreSQL or SQLite)
DATABASE_URL=sqlite:///./agent_monitor.db

# API Key Protection (leave blank for local dev mode)
API_KEY=sk-live-agent-cost-monitor-secret-key

# Logging Level
LOG_LEVEL=INFO
```

## Python SDK Usage

```python
from agent_monitor_sdk import AgentMonitor

monitor = AgentMonitor(
    base_url="http://localhost:8000",
    budget=10.00,
    api_key="sk-live-agent-cost-monitor-secret-key",  # optional
    model_pricing={
        "deepseek-v3": {"input": 0.14, "output": 0.28, "provider": "DeepSeek"},
        "mistral-large": {"input": 2.00, "output": 6.00, "provider": "Mistral"},
    }
)

with monitor.crew("customer-research") as ctx:
    # Run your crew or agents here
    ctx.log(
        agent_id="researcher",
        model="deepseek-v3",
        input_tokens=1200,
        output_tokens=450
    )
```

## Testing

Run the full automated test suite:

```bash
python -m pytest backend/
```

## License

MIT
