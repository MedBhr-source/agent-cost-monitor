"""Simulate CrewAI workloads for the dashboard and alert logic."""

import asyncio
import logging
import random

from cost_tracker import tracker
import rules_engine

logger = logging.getLogger("agent_monitor.simulator")

AGENTS = [
    {
        "id": "researcher",
        "model": "gpt-4-turbo",
        "input_range": (800, 2000),
        "output_range": (200, 600),
        "delay": (1.5, 3.5),
    },
    {
        "id": "analyzer",
        "model": "claude-3-sonnet",
        "input_range": (600, 1500),
        "output_range": (150, 400),
        "delay": (1.0, 2.5),
    },
    {
        "id": "writer",
        "model": "gpt-3.5-turbo",
        "input_range": (400, 1200),
        "output_range": (300, 800),
        "delay": (2.0, 4.0),
    },
]


async def _run_agent(crew_id: str, profile: dict, call_count: int, runaway: bool = False):
    """Simulate one agent making a fixed number of API calls."""
    for i in range(call_count):
        while tracker.is_paused(crew_id, profile["id"]):
            await asyncio.sleep(0.5)
            crew = tracker.crews.get(crew_id)
            if not crew or crew["status"] != "running":
                return

        crew = tracker.crews.get(crew_id)
        if not crew or crew["status"] != "running":
            break

        if runaway and i > 8:
            inp = random.randint(100, 400)
            out = random.randint(20, 100)
            delay = random.uniform(0.2, 0.5)
        else:
            inp = random.randint(*profile["input_range"])
            out = random.randint(*profile["output_range"])
            delay = random.uniform(*profile["delay"])

        tracker.log_call(crew_id, profile["id"], profile["model"], inp, out)

        if i % 3 == 0:
            for alert in rules_engine.evaluate(crew_id):
                if alert["action"] == "PAUSE_AGENT":
                    tracker.pause_agent(crew_id, alert.get("agent_id", profile["id"]))
                elif alert["action"] == "PAUSE_ALL":
                    tracker.finalize(crew_id, "budget_exceeded")
                    return

        await asyncio.sleep(delay)


async def run_simulated_crew(crew_id: str):
    """Launch all agents concurrently and let one drift into a runaway pattern."""
    runaway_id = random.choice([a["id"] for a in AGENTS])
    logger.info("Crew %s simulation starting (runaway=%s)", crew_id, runaway_id)

    tasks = []
    for agent in AGENTS:
        is_runaway = agent["id"] == runaway_id
        count = random.randint(40, 60) if is_runaway else random.randint(8, 18)
        tasks.append(_run_agent(crew_id, agent, count, is_runaway))

    try:
        await asyncio.gather(*tasks)
    except Exception as exc:
        logger.exception("Crew %s simulation error: %s", crew_id, exc)
        tracker.finalize(crew_id, "failed")
        return

    crew = tracker.crews.get(crew_id)
    if crew and crew["status"] == "running":
        tracker.finalize(crew_id, "completed")
    logger.info("Crew %s simulation finished", crew_id)