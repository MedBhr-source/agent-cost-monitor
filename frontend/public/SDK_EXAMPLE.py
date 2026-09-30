"""
Real-world example: using Agent Cost Monitor SDK with a CrewAI crew.

This is what a recruiter would do to integrate your monitoring tool
into their existing multi-agent system.
"""

from agent_monitor_sdk import AgentMonitor
from crewai import Agent, Task, Crew
import json

# ─────────────────────────────────────────────────────────────
# 1. Initialize the monitor (one line)
# ─────────────────────────────────────────────────────────────
monitor = AgentMonitor(
    base_url="http://localhost:8000",
    budget=5.00,  # Hard stop at $5 USD
    verbose=True,
)

# ─────────────────────────────────────────────────────────────
# 2. Define your agents (no changes needed)
# ─────────────────────────────────────────────────────────────
researcher = Agent(
    role="Market Researcher",
    goal="Find emerging AI trends in enterprise software",
    backstory="Expert at spotting market gaps and opportunities",
    # ... your existing agent config
)

analyst = Agent(
    role="Data Analyst",
    goal="Extract insights from research data",
    backstory="Turns raw data into actionable intelligence",
    # ... your existing agent config
)

writer = Agent(
    role="Report Writer",
    goal="Create executive summaries",
    backstory="Writes clear, concise reports for C-suite",
    # ... your existing agent config
)

# ─────────────────────────────────────────────────────────────
# 3. Wrap your crew run in the monitor context (one line)
# ─────────────────────────────────────────────────────────────
with monitor.crew("market-research-q4") as ctx:
    """
    Everything inside this block runs normally.
    The monitor tracks cost in the background.
    """

    # Define your tasks
    research_task = Task(
        description="Research Q4 2026 enterprise AI spending trends",
        agent=researcher,
        expected_output="List of top 5 trends with market size",
    )

    analysis_task = Task(
        description="Analyze the trends and score by impact",
        agent=analyst,
        expected_output="Scored impact analysis with risk factors",
    )

    report_task = Task(
        description="Write a 2-page executive summary",
        agent=writer,
        expected_output="Professional report ready for stakeholders",
    )

    # Run your crew normally
    crew = Crew(
        agents=[researcher, analyst, writer],
        tasks=[research_task, analysis_task, report_task],
        verbose=True,
    )

    result = crew.kickoff()

    # ─────────────────────────────────────────────────────────
    # 4. Log token usage from CrewAI output (add after crew runs)
    # ─────────────────────────────────────────────────────────
    # CrewAI returns usage info — log it for each agent
    if hasattr(result, "token_usage"):
        # Example: if result.token_usage is a dict of agent usage
        for agent_name, usage in result.token_usage.items():
            ctx.log(
                agent_id=agent_name,
                model="gpt-4-turbo",  # or whatever model the agent used
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
            )

    # OR manually extract from crew output if token usage is embedded
    # (this depends on your crew's output format)
    print(result)

# ─────────────────────────────────────────────────────────────
# 5. Get the summary (printed automatically on exit)
# ─────────────────────────────────────────────────────────────
# Output:
# [AgentMonitor] Run complete ─────────────────────
#   Crew ID:     abc12345
#   Total cost:  $1.2340  (47 calls)
#   Duration:    342s
#   Dashboard:   http://localhost:8000/?crew=abc12345
#   researcher           $0.4521
#   analyst              $0.3802
#   writer               $0.4017


# ═════════════════════════════════════════════════════════════
# BONUS: Using the decorator for a single agent function
# ═════════════════════════════════════════════════════════════

@monitor.watch(agent_id="researcher", model="gpt-4-turbo")
def get_market_data(query: str):
    """
    The decorator automatically logs token usage.
    Works with any function that returns an OpenAI response object.
    """
    from openai import OpenAI

    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": query}],
        max_tokens=500,
    )
    return response


# Call it — token usage is logged automatically
result = get_market_data("What are the top 5 AI trends in 2026?")
print(result.choices[0].message.content)


# ═════════════════════════════════════════════════════════════
# What happens behind the scenes
# ═════════════════════════════════════════════════════════════
# 1. monitor.crew() creates a CrewContext with a unique crew_id
# 2. ctx.log() sends each call to http://localhost:8000/api/run-crew
# 3. The backend logs cost per agent, detects runaway loops
# 4. If budget is exceeded, the backend pauses agents automatically
# 5. The frontend shows real-time dashboard with alerts
# 6. On exit, summary is printed + saved to SQLite for history

