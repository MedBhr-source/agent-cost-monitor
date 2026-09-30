/* ── API helpers ─────────────────────────────────────────────
   All calls go to /api/* — Vite proxies them to localhost:8000
   in dev, and nginx proxies them in production.
   Using native fetch instead of axios to keep deps minimal.
──────────────────────────────────────────────────────────── */

const API = "/api";

export async function startCrew(topicOrBudget, budgetOrScenario, scenarioOrSlack = "customer_reviews", maybeSlackWebhook = "", durationBudget = 600) {
  let topic = "Multi-agent AI systems";
  let budget = 2;
  let scenario = "customer_reviews";
  let slackWebhook = "";

  if (typeof topicOrBudget === "string") {
    topic = topicOrBudget;
    budget = Number(budgetOrScenario ?? 2);
    scenario = scenarioOrSlack || "customer_reviews";
    slackWebhook = maybeSlackWebhook || "";
  } else {
    budget = Number(topicOrBudget ?? 2);
    scenario = typeof budgetOrScenario === "string" ? budgetOrScenario : "customer_reviews";
    slackWebhook = typeof scenarioOrSlack === "string" ? scenarioOrSlack : "";
  }

  const res = await fetch(`${API}/run-crew`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      budget,
      duration_budget: durationBudget,
      scenario,
      slack_webhook: slackWebhook || null,
    }),
  });
  if (!res.ok) throw new Error("Failed to start crew");
  return res.json();
}

export async function pauseAgent(crewId, agentId) {
  const res = await fetch(`${API}/pause/${crewId}/${agentId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to pause agent");
  return res.json();
}

export async function resumeAgent(crewId, agentId) {
  const res = await fetch(`${API}/resume/${crewId}/${agentId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to resume agent");
  return res.json();
}

export async function resolveHitl(crewId, eventId, decision) {
  const res = await fetch(`${API}/hitl/${crewId}/${eventId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  if (!res.ok) throw new Error("Failed to resolve HITL decision");
  return res.json();
}

export async function fetchHistory() {
  const res = await fetch(`${API}/history`);
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}

export async function exportCSV(crewId) {
  const res = await fetch(`${API}/export/${crewId}`);
  if (!res.ok) throw new Error("Failed to export CSV");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${crewId}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
