const API = "/api";

export function getApiKey() {
  try {
    return localStorage.getItem("agent_monitor_api_key") || "";
  } catch {
    return "";
  }
}

export function setApiKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem("agent_monitor_api_key", key.trim());
    } else {
      localStorage.removeItem("agent_monitor_api_key");
    }
  } catch {
    // Ignore storage quota / access issues
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const key = getApiKey();
  if (key) {
    headers["X-API-Key"] = key;
  }

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      try {
        const errText = await res.text();
        if (errText) errorDetail = errText;
      } catch {
        // use default message
      }
    }
    const err = new Error(errorDetail);
    err.status = res.status;
    throw err;
  }

  return res;
}

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

  const res = await request("/run-crew", {
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
  return res.json();
}

export async function pauseAgent(crewId, agentId) {
  const res = await request(`/pause/${crewId}/${agentId}`, {
    method: "POST",
  });
  return res.json();
}

export async function resumeAgent(crewId, agentId) {
  const res = await request(`/resume/${crewId}/${agentId}`, {
    method: "POST",
  });
  return res.json();
}

export async function resolveHitl(crewId, eventId, decision) {
  const res = await request(`/hitl/${crewId}/${eventId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  return res.json();
}

export async function fetchHistory() {
  const res = await request("/history");
  return res.json();
}

export async function fetchMetrics(crewId) {
  const res = await request(`/metrics/${crewId}`);
  return res.json();
}

export async function exportCSV(crewId) {
  const res = await request(`/export/${crewId}`);
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

export async function fetchPricing() {
  const res = await request("/pricing");
  return res.json();
}

export async function savePricing(model, inputCost, outputCost, provider = "Custom") {
  const res = await request("/pricing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model.trim(),
      input_cost: Number(inputCost),
      output_cost: Number(outputCost),
      provider: provider.trim() || "Custom",
    }),
  });
  return res.json();
}

export async function deletePricing(model) {
  const res = await request(`/pricing/${encodeURIComponent(model)}`, {
    method: "DELETE",
  });
  return res.json();
}
