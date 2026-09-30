# 🤖 Enterprise Agent Cost Monitor

A real-time observability and cost control system for multi-agent AI workflows.

## Problem

Multi-agent systems can spiral into expensive infinite loops. One runaway loop can waste $500+ in minutes. Teams lack visibility into per-agent costs and execution patterns.

## Solution

This system:
- **Tracks every API call** in real-time with precise cost calculation
- **Detects runaway loops** automatically (>20 calls per agent per 5 min)
- **Alerts & pauses agents** with one click
- **Visualizes cost trends** with a live dashboard

## Features

✅ Real-time cost tracking (per agent, per task)
✅ Runaway loop detection & auto-pause
✅ Budget enforcement ($X max per crew run)
✅ WebSocket real-time dashboard
✅ Docker ready, cloud deployable
✅ 4 alert types (runaway, budget, slow execution, cost drift)

## Architecture

```text
User Browser (React + Vite + Tailwind)
    ↓ HTTP / WebSocket
FastAPI Backend (Python)
    ↓ In-memory state (Thread-safe)
CrewAI Agents (Simulated)
```

## Quick Start

```bash
# 1. Start services
# Terminal 1 — backend 
cd backend
uvicorn main:app --reload --port 8000
# Terminal 2 — frontend
cd frontend
npm install
npm run dev

# 2. Open browser
# Frontend: http://localhost:3000
# API docs: http://localhost:8000/docs
```

## Usage

Start a crew run from the UI at `http://localhost:3000` to watch the simulated agents execute and report their API costs in real-time.

## Tech Stack

- **Backend**: Python 3.11, FastAPI
- **Frontend**: React 18, Vite, Recharts, Tailwind CSS
- **Deployment**: Docker Compose

## License

MIT
