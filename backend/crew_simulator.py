"""Simulate CrewAI agent workflows without needing an API key.

Three agents (researcher, analyzer, writer) each "make API calls"
with random token counts.  One agent is randomly chosen to enter a
runaway-loop pattern so the rules engine has anomalies to detect.

FIX: When a runaway agent is paused, ONLY that agent stops.
     The other agents continue running normally until they finish
     their own call_count or the budget is exceeded (PAUSE_ALL).
"""

import asyncio
import random

from cost_tracker import tracker
import rules_engine

# ── Agent profiles ─────────────────────────────────────────────
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


async def _run_agent(crew_id: str, profile: dict,
                     call_count: int, runaway: bool = False):
    """Simulate one agent making *call_count* API calls.

    Stopping conditions (in priority order):
    1. This specific agent was paused  → only THIS agent stops
    2. Crew status is no longer "running" (budget exceeded, etc.) → all stop
    3. Agent finished its call_count   → this agent stops naturally
    """
    for i in range(call_count):

        # ── Stop condition 1: THIS agent was paused ──────────
        # Only breaks THIS agent's loop. Other agents are unaffected.
        if tracker.is_paused(crew_id, profile["id"]):
            break

        # ── Stop condition 2: Whole crew was halted ──────────
        # This fires only on PAUSE_ALL (budget exceeded), not on PAUSE_AGENT.
        crew = tracker.crews.get(crew_id)
        if not crew or crew["status"] != "running":
            break

        # ── Simulate API call ────────────────────────────────
        # Runaway agents make fast, small, repetitive calls after call #8
        if runaway and i > 8:
            inp   = random.randint(100, 400)
            out   = random.randint(20, 100)
            delay = random.uniform(0.2, 0.5)   # faster = more calls = runaway
        else:
            inp   = random.randint(*profile["input_range"])
            out   = random.randint(*profile["output_range"])
            delay = random.uniform(*profile["delay"])

        tracker.log_call(crew_id, profile["id"], profile["model"], inp, out)

        # ── Evaluate rules every 3 calls ────────────────────
        # IMPORTANT: each agent only acts on alerts that concern IT.
        # A PAUSE_AGENT alert for "analyzer" will NOT affect "researcher".
        if i % 3 == 0:
            for alert in rules_engine.evaluate(crew_id):

                if alert["action"] == "PAUSE_AGENT":
                    # Only pause if the alert is about THIS agent
                    if alert.get("agent_id") == profile["id"]:
                        tracker.pause_agent(crew_id, profile["id"])
                        # Break out of the for-alert loop so we hit
                        # the is_paused check at the top of the next iteration
                        break

                elif alert["action"] == "PAUSE_ALL":
                    # Budget exceeded — stop EVERYTHING
                    tracker.finalize(crew_id, "budget_exceeded")
                    return  # exits _run_agent entirely for this agent

        await asyncio.sleep(delay)


async def run_simulated_crew(crew_id: str):
    """Launch all agents concurrently; one goes runaway at random.

    All three agents run at the same time (asyncio.gather).
    When the runaway is paused, gather keeps the other two running
    because their coroutines are independent.
    """
    runaway_id = random.choice([a["id"] for a in AGENTS])

    # Give the runaway more calls so it has time to trigger the detector
    tasks = []
    for agent in AGENTS:
        is_runaway = agent["id"] == runaway_id
        count = (random.randint(40, 60) if is_runaway   # enough to trigger loop
                 else random.randint(8, 18))             # normal agents finish later
        tasks.append(_run_agent(crew_id, agent, count, is_runaway))

    await asyncio.gather(*tasks)

    # Mark complete only if nothing already changed the status
    crew = tracker.crews.get(crew_id)
    if crew and crew["status"] == "running":
        tracker.finalize(crew_id, "completed")