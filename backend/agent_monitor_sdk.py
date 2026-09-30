"""Minimal Python SDK for the Agent Cost Monitor backend.

This mirrors the public example usage in the repo:

    from agent_monitor_sdk import AgentMonitor

    monitor = AgentMonitor(base_url="http://localhost:8000", budget=5.00)
    with monitor.crew("demo-run") as ctx:
        ctx.log("researcher", "gpt-4-turbo", 1000, 500)
"""

from __future__ import annotations

import uuid
from contextlib import AbstractContextManager
from typing import Callable, Optional

import requests


class CrewContext(AbstractContextManager):
    """Context manager used by monitor.crew(...)."""

    def __init__(self, monitor: "AgentMonitor", name: str):
        self.monitor = monitor
        self.name = name
        self.crew_id: Optional[str] = None

    def __enter__(self):
        payload = {
            "topic": self.name,
            "budget": self.monitor.budget,
            "duration_budget": self.monitor.duration_budget,
            "scenario": self.monitor.scenario,
            "slack_webhook": self.monitor.slack_webhook,
        }
        resp = requests.post(
            f"{self.monitor.base_url}/api/run-crew",
            json=payload,
            timeout=self.monitor.timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        self.crew_id = data.get("crew_id")
        if self.monitor.verbose:
            print(f"[AgentMonitor] started crew {self.crew_id} for '{self.name}'")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.monitor.verbose and self.crew_id:
            print(f"[AgentMonitor] run complete -> crew_id={self.crew_id}")
        return False

    def log(self, agent_id: str, model: str, input_tokens: int, output_tokens: int):
        if not self.crew_id:
            raise RuntimeError("Crew context was not started; use 'with monitor.crew(...) as ctx:'")

        payload = {
            "agent_id": agent_id,
            "model": model,
            "input_tokens": int(input_tokens),
            "output_tokens": int(output_tokens),
        }
        resp = requests.post(
            f"{self.monitor.base_url}/api/log/{self.crew_id}",
            json=payload,
            timeout=self.monitor.timeout,
        )
        resp.raise_for_status()
        result = resp.json()
        if self.monitor.verbose:
            print(f"[AgentMonitor] logged {agent_id} -> {result}")
        return result

    def summary(self):
        if not self.crew_id:
            return None
        resp = requests.get(
            f"{self.monitor.base_url}/api/metrics/{self.crew_id}",
            timeout=self.monitor.timeout,
        )
        resp.raise_for_status()
        return resp.json()


class AgentMonitor:
    """Thin HTTP client for the Agent Cost Monitor backend."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        budget: float = 5.0,
        verbose: bool = False,
        duration_budget: int = 600,
        scenario: str = "customer_reviews",
        slack_webhook: Optional[str] = None,
        timeout: int = 10,
    ):
        self.base_url = base_url.rstrip("/")
        self.budget = float(budget)
        self.verbose = verbose
        self.duration_budget = int(duration_budget)
        self.scenario = scenario
        self.slack_webhook = slack_webhook
        self.timeout = timeout

    def crew(self, name: Optional[str] = None) -> CrewContext:
        return CrewContext(self, name or f"crew-{uuid.uuid4().hex[:8]}")

    def watch(self, agent_id: str, model: str = "gpt-4-turbo"):
        """Decorator that logs an OpenAI-like response usage automatically."""

        def decorator(func: Callable):
            def wrapper(*args, **kwargs):
                result = func(*args, **kwargs)

                usage = getattr(result, "usage", None)
                if usage is None and isinstance(result, dict):
                    usage = result.get("usage")

                prompt_tokens = 0
                completion_tokens = 0
                if usage is not None:
                    if hasattr(usage, "prompt_tokens"):
                        prompt_tokens = int(getattr(usage, "prompt_tokens"))
                        completion_tokens = int(getattr(usage, "completion_tokens", 0))
                    elif isinstance(usage, dict):
                        prompt_tokens = int(usage.get("prompt_tokens", 0))
                        completion_tokens = int(usage.get("completion_tokens", 0))

                if prompt_tokens or completion_tokens:
                    ctx = self.crew(f"watch-{agent_id}")
                    with ctx:
                        return ctx.log(agent_id, model, prompt_tokens, completion_tokens) or result
                return result

            return wrapper

        return decorator
