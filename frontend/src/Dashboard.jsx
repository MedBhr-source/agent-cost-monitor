import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  startCrew, pauseAgent, resumeAgent, resolveHitl,
  fetchHistory, fetchMetrics, exportCSV, getApiKey, setApiKey,
  fetchPricing, savePricing, deletePricing,
} from "./api";

const I = {
  Bot: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 11V7"/><circle cx="12" cy="5" r="2"/><path d="M8 15h.01M16 15h.01M8 19h8"/></svg>,
  Play: () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z"/></svg>,
  Pause: () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>,
  Resume: () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 5v14l11-7z"/></svg>,
  Dollar: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Activity: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Clock: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Shield: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Alert: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Plus: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Zap: () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Terminal: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  Code: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  Copy: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  History: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>,
  Slack: () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>,
  Human: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Trend: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Key: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-2-2"/></svg>,
  Refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>,
  Edit: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  Trash: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Search: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};

const SEV = {
  CRITICAL: { ring: "border-rose-500/60", bg: "bg-rose-500/8", dot: "bg-rose-400", label: "text-rose-300" },
  HIGH: { ring: "border-amber-500/60", bg: "bg-amber-500/8", dot: "bg-amber-400", label: "text-amber-300" },
  MEDIUM: { ring: "border-yellow-500/60", bg: "bg-yellow-500/8", dot: "bg-yellow-400", label: "text-yellow-300" },
  LOW: { ring: "border-blue-500/60", bg: "bg-blue-500/8", dot: "bg-blue-400", label: "text-blue-300" },
  INFO: { ring: "border-slate-500/60", bg: "bg-slate-500/8", dot: "bg-slate-400", label: "text-slate-300" },
};

const SCENARIOS = {
  customer_reviews: { icon: "01", label: "Customer Review Analyzer", desc: "Analyzer loops on sentiment re-checks", agents: ["researcher", "analyzer", "writer"] },
  market_research: { icon: "02", label: "Market Research Pipeline", desc: "Researcher loops on market data fetching", agents: ["researcher", "analyzer", "strategist"] },
  code_review: { icon: "03", label: "Code Review Assistant", desc: "Reviewer loops on complexity scoring", agents: ["scanner", "reviewer", "writer"] },
};

const PROVIDER_COLORS = {
  OpenAI: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Anthropic: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  DeepSeek: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  Google: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  "Meta / Local": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Mistral: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Custom: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const fmt = {
  dur: (s) => {
    if (!s) return "0s";
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  },
  cost: (n) => (typeof n === "number" ? `$${n.toFixed(4)}` : "$0.0000"),
  time: (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""),
  date: (iso) => (iso ? new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""),
};

function CopyButton({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
      className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
    >
      <I.Copy />{ok ? "Copied!" : "Copy"}
    </button>
  );
}

function ScenarioCard({ id, selected, onSelect }) {
  const item = SCENARIOS[id] || {};
  const active = selected === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer ${active ? "border-cyan-500/60 bg-cyan-500/10" : "border-white/8 bg-white/2 hover:border-white/15 hover:bg-white/4"}`}
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center text-[11px] font-bold tracking-[0.2em] text-slate-300 shrink-0">{item.icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold ${active ? "text-white" : "text-slate-300"}`}>{item.label}</span>
            {active && <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full px-2 py-0.5">Selected</span>}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {item.agents?.map((a) => <span key={a} className="text-[10px] bg-white/5 text-slate-500 rounded px-1.5 py-0.5 font-mono">{a}</span>)}
          </div>
        </div>
      </div>
    </button>
  );
}

function ApiKeyModal({ isOpen, onClose, currentKey, onSave }) {
  const [keyInput, setKeyInput] = useState(currentKey);

  useEffect(() => {
    setKeyInput(currentKey);
  }, [currentKey, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in">
      <div className="bg-[#0b1a27] border border-cyan-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <I.Key />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">API Key Authentication</h3>
              <p className="text-xs text-slate-400">Configure client header for secured endpoints</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg p-1 cursor-pointer">✕</button>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          If your backend environment has <code className="text-cyan-300 bg-cyan-950/60 px-1 py-0.5 rounded font-mono">API_KEY</code> set, specify it here to authenticate requests via <code className="text-cyan-300 bg-cyan-950/60 px-1 py-0.5 rounded font-mono">X-API-Key</code>. Leave blank for local development mode.
        </p>

        <div className="space-y-3 mb-6">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Secret API Key</label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Enter API Key (e.g. sk-live-cost-monitor-...)"
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white bg-[#102739] border border-sky-200/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={() => {
              setKeyInput("");
              onSave("");
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer"
          >
            Clear Key
          </button>
          <button
            onClick={() => {
              onSave(keyInput);
              onClose();
            }}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelPriceModal({ isOpen, onClose, initialData, onSave }) {
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("OpenAI");
  const [inputCost, setInputCost] = useState("1.00");
  const [outputCost, setOutputCost] = useState("2.00");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setModel(initialData.model || "");
      setProvider(initialData.provider || "Custom");
      setInputCost(String(initialData.input_cost ?? "1.00"));
      setOutputCost(String(initialData.output_cost ?? "2.00"));
    } else {
      setModel("");
      setProvider("OpenAI");
      setInputCost("1.00");
      setOutputCost("2.00");
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!model.trim()) {
      setError("Model name is required");
      return;
    }
    const inVal = parseFloat(inputCost);
    const outVal = parseFloat(outputCost);
    if (isNaN(inVal) || inVal < 0 || isNaN(outVal) || outVal < 0) {
      setError("Input and Output costs must be valid non-negative numbers");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(model.trim(), inVal, outVal, provider);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save model price");
    } finally {
      setSaving(false);
    }
  };

  const PROVIDER_OPTIONS = ["OpenAI", "Anthropic", "DeepSeek", "Google", "Meta / Local", "Mistral", "Custom"];

  const sampleCallCost = (10000 * (parseFloat(inputCost) || 0) + 2000 * (parseFloat(outputCost) || 0)) / 1_000_000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in">
      <div className="bg-[#0b1a27] border border-cyan-500/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <I.Dollar />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{initialData ? "Edit Model Pricing" : "Add Model Pricing"}</h3>
              <p className="text-xs text-slate-400">Set rates per 1 Million tokens</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg p-1 cursor-pointer">✕</button>
        </div>

        {error && (
          <div className="mb-4 bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-rose-300 text-xs flex items-center gap-2">
            <I.Alert />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Model Identifier</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={Boolean(initialData)}
              placeholder="e.g. gpt-4o, claude-3-5-sonnet, deepseek-v3, mistral-large"
              className="w-full rounded-xl px-4 py-2.5 text-sm text-white bg-[#102739] border border-sky-200/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Provider / Category</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PROVIDER_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setProvider(opt)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    provider === opt ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "bg-white/3 border-white/8 text-slate-400 hover:text-white"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Input Cost ($ / 1M)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={inputCost}
                  onChange={(e) => setInputCost(e.target.value)}
                  className="w-full rounded-xl pl-7 pr-3 py-2 text-sm text-white bg-[#102739] border border-sky-200/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Output Cost ($ / 1M)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={outputCost}
                  onChange={(e) => setOutputCost(e.target.value)}
                  className="w-full rounded-xl pl-7 pr-3 py-2 text-sm text-white bg-[#102739] border border-sky-200/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="bg-white/3 border border-white/6 rounded-xl p-3 text-xs text-slate-400 flex items-center justify-between">
            <span>Example: 10k prompt + 2k completion</span>
            <span className="font-mono text-cyan-300 font-bold">${sampleCallCost.toFixed(5)}</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving…" : initialData ? "Update Price" : "Add Model"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PricingTab() {
  const [pricingList, setPricingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("All");
  const [editingItem, setEditingItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState(null);

  const loadPricing = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchPricing();
      setPricingList(res.pricing || []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load model pricing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  const handleSave = async (model, inputCost, outputCost, provider) => {
    await savePricing(model, inputCost, outputCost, provider);
    setToast(`Saved rate for ${model}`);
    setTimeout(() => setToast(null), 3000);
    await loadPricing();
  };

  const handleDelete = async (model) => {
    if (!window.confirm(`Are you sure you want to remove pricing for '${model}'?`)) return;
    try {
      await deletePricing(model);
      setToast(`Deleted rate for ${model}`);
      setTimeout(() => setToast(null), 3000);
      await loadPricing();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const providers = useMemo(() => {
    const set = new Set(pricingList.map((p) => p.provider || "Custom"));
    return ["All", ...Array.from(set)];
  }, [pricingList]);

  const filtered = useMemo(() => {
    return pricingList.filter((item) => {
      const matchSearch =
        item.model.toLowerCase().includes(search.toLowerCase()) ||
        (item.provider || "").toLowerCase().includes(search.toLowerCase());
      const matchProv = selectedProvider === "All" || item.provider === selectedProvider;
      return matchSearch && matchProv;
    });
  }, [pricingList, search, selectedProvider]);

  const minInput = pricingList.length ? Math.min(...pricingList.map((p) => p.input_cost)) : 0;
  const minOutput = pricingList.length ? Math.min(...pricingList.map((p) => p.output_cost)) : 0;

  return (
    <div className="space-y-5 py-2 animate-in">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-500/90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2">
          <I.Check />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-4 text-center">
          <div className="text-xl font-bold font-mono text-cyan-300">{pricingList.length}</div>
          <div className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Configured Models</div>
        </div>
        <div className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-4 text-center">
          <div className="text-xl font-bold font-mono text-emerald-300">${minInput.toFixed(3)} / 1M</div>
          <div className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Lowest Input Cost</div>
        </div>
        <div className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-4 text-center">
          <div className="text-xl font-bold font-mono text-amber-300">${minOutput.toFixed(3)} / 1M</div>
          <div className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Lowest Output Cost</div>
        </div>
      </div>

      <div className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-5">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-3 text-slate-500"><I.Search /></span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models or providers…"
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs text-white bg-white/4 border border-white/8 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingItem(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <I.Plus /> Add Model Price
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {providers.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedProvider(p)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                selectedProvider === p ? "bg-cyan-600 text-white shadow" : "bg-white/3 border border-white/6 text-slate-400 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
            <span className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
            Loading pricing table…
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-center text-rose-300 text-xs">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No matching models found. Click "Add Model Price" to register a new rate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/6 text-slate-500 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Model</th>
                  <th className="py-3 px-3">Provider</th>
                  <th className="py-3 px-3 text-right">Input ($ / 1M)</th>
                  <th className="py-3 px-3 text-right">Output ($ / 1M)</th>
                  <th className="py-3 px-3 text-right">Sample (10k/2k)</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4 font-mono">
                {filtered.map((item) => {
                  const pCol = PROVIDER_COLORS[item.provider] || PROVIDER_COLORS.Custom;
                  const sampleCost = (10000 * item.input_cost + 2000 * item.output_cost) / 1_000_000;
                  return (
                    <tr key={item.model} className="hover:bg-white/2 transition-colors">
                      <td className="py-3 px-3 font-semibold text-cyan-300">{item.model}</td>
                      <td className="py-3 px-3 font-sans">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pCol}`}>
                          {item.provider}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-200">${item.input_cost.toFixed(3)}</td>
                      <td className="py-3 px-3 text-right text-slate-200">${item.output_cost.toFixed(3)}</td>
                      <td className="py-3 px-3 text-right text-emerald-400 font-bold">${sampleCost.toFixed(5)}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setShowAddModal(true);
                            }}
                            className="p-1.5 rounded-lg bg-white/4 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                            title="Edit Price"
                          >
                            <I.Edit />
                          </button>
                          <button
                            onClick={() => handleDelete(item.model)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer"
                            title="Delete Price"
                          >
                            <I.Trash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModelPriceModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingItem(null);
        }}
        initialData={editingItem}
        onSave={handleSave}
      />
    </div>
  );
}

/* ─── Agent Pipeline Flow Diagram ─── */
function AgentPipelineFlow({ scenario }) {
  const item = SCENARIOS[scenario];
  if (!item) return null;
  const AGENT_META = {
    researcher: { color: "cyan", risk: "medium", desc: "Gathers data from sources" },
    analyzer: { color: "amber", risk: "high", desc: "Loop-vulnerable analysis pass" },
    writer: { color: "emerald", risk: "low", desc: "Synthesizes final output" },
    strategist: { color: "indigo", risk: "medium", desc: "Formulates strategy" },
    scanner: { color: "cyan", risk: "low", desc: "Scans input codebase" },
    reviewer: { color: "amber", risk: "high", desc: "Iterates on review cycles" },
  };
  const RISK_BADGE = {
    high: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };
  const DOT_COLOR = {
    cyan: "bg-cyan-400", amber: "bg-amber-400", emerald: "bg-emerald-400", indigo: "bg-indigo-400",
  };
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-3 px-1">
      {item.agents.map((agentId, idx) => {
        const meta = AGENT_META[agentId] || { color: "cyan", risk: "low", desc: "Agent step" };
        return (
          <div key={agentId} className="flex items-center gap-1 shrink-0">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 min-w-[130px] hover:border-white/[0.15] hover:bg-white/[0.05] transition-all duration-200 group">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${DOT_COLOR[meta.color] || "bg-cyan-400"} shrink-0`} />
                <span className="text-xs font-bold text-white capitalize">{agentId}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-snug mb-2">{meta.desc}</p>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${RISK_BADGE[meta.risk]}`}>
                {meta.risk} risk
              </span>
            </div>
            {idx < item.agents.length - 1 && (
              <div className="flex items-center shrink-0 px-0.5">
                <div className="w-6 h-px bg-gradient-to-r from-cyan-500/40 to-transparent" />
                <svg viewBox="0 0 8 12" className="w-2 h-3 text-cyan-500/50 -ml-0.5"><path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Recent Runs Sidebar Mini-Card ─── */
function RecentRunsMini() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchHistory().then((d) => { setRuns((d.runs || []).slice(0, 4)); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-slate-600 text-xs py-6 justify-center"><span className="w-3.5 h-3.5 border-2 border-slate-700 border-t-slate-500 rounded-full animate-spin" />Loading…</div>;
  if (runs.length === 0) return (
    <div className="text-center py-6">
      <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-2.5 text-slate-600"><I.History /></div>
      <p className="text-[11px] text-slate-600">No previous runs</p>
      <p className="text-[10px] text-slate-700 mt-0.5">Completed runs will appear here</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const sc = SCENARIOS[run.scenario];
        const status = run.status || "completed";
        const stCol = status === "completed" ? "bg-emerald-400" : status === "budget_exceeded" ? "bg-rose-400" : "bg-slate-400";
        return (
          <div key={run.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-200 group cursor-default">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${stCol} shrink-0`} />
              <span className="text-[11px] font-bold text-slate-300 font-mono truncate">{run.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-600">{sc?.label || run.scenario}</span>
              <span className="text-[10px] font-mono text-cyan-400 font-semibold">${Number(run.total_cost || 0).toFixed(4)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Active Guardrails Widget ─── */
function GuardrailsWidget() {
  const guardrails = [
    { label: "Loop Pattern Matcher", desc: "Detects cyclical agent calls", active: true },
    { label: "Token Spike Sentinel", desc: "Flags sudden token surges", active: true },
    { label: "Budget Ceiling Stop", desc: "Hard stop at budget limit", active: true },
    { label: "HITL Auto-Pause", desc: "Pauses agent for human review", active: true },
  ];
  return (
    <div className="space-y-1.5">
      {guardrails.map((g) => (
        <div key={g.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] group hover:bg-white/[0.04] transition-all">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-300">{g.label}</div>
            <div className="text-[9px] text-slate-600">{g.desc}</div>
          </div>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">On</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Redesigned Launch Screen: Command Center ─── */
function LaunchScreen({ scenario, setScenario, budget, setBudget, slackWebhook, setSlackWebhook, onStart, starting, onOpenKeyModal, hasApiKey, errorMsg, tab, setTab }) {

  const LAUNCH_TABS = [["launchpad", "Launchpad"], ["history", "History"], ["pricing", "Pricing"], ["integrate", "Integrate"]];
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#05141d] text-white font-sans">
      {/* Background ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-cyan-600/[0.07] blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-emerald-600/[0.05] blur-[120px]" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] rounded-full bg-indigo-600/[0.04] blur-[100px]" />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(148,163,184,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.3) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* ── Sticky Top Navigation ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#05141d]/90 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-950/60 ring-1 ring-cyan-400/20 flex items-center justify-center shadow-lg shadow-cyan-500/15 shrink-0 overflow-hidden">
              <img src="/logo-agent-cost-monitor-111.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white leading-none">Agent Cost Monitor</h1>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded px-1.5 py-0.5">v2.0</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Autonomous AI Agent Cost & Safety Telemetry</p>
            </div>
          </div>

          {/* Center Tabs */}
          <div className="flex bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
            {LAUNCH_TABS.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${tab === k ? "bg-cyan-600 text-white shadow-md shadow-cyan-500/20" : "text-slate-500 hover:text-slate-300"}`}>{l}</button>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenKeyModal}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                hasApiKey ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08]"
              }`}
            >
              <I.Key />
              <span className="hidden sm:inline">{hasApiKey ? "Key Active" : "API Key"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-6 py-6 relative z-10">

        {/* ── ROUTE: History / Pricing / Integrate tabs ── */}
        {tab === "history" ? <HistoryTab /> : tab === "pricing" ? <PricingTab /> : tab === "integrate" ? <IntegrationTab /> : (
          <>
            {/* ── Hero Section ── */}
            <div className="mb-6 animate-in">
              <div className="flex items-end justify-between gap-4 mb-1">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Command Center</h2>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-xl">Configure, launch, and observe multi-agent AI executions. Detect runaway loops, enforce budgets, and intervene in real time — before cost spirals.</p>
                </div>
              </div>
            </div>

            {/* ── Quick Telemetry Ribbon ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 animate-in" style={{ animationDelay: "50ms" }}>
              {[
                { label: "Simulation Engine", value: "Ready", icon: I.Bot, accent: "cyan" },
                { label: "Safety Guardrails", value: "4 Active", icon: I.Shield, accent: "emerald" },
                { label: "Model Catalog", value: "15+ Models", icon: I.Dollar, accent: "amber" },
                { label: "Detection Systems", value: "Online", icon: I.Activity, accent: "indigo" },
              ].map((item) => {
                const accents = { cyan: "border-cyan-500/20 bg-cyan-500/[0.06]", emerald: "border-emerald-500/20 bg-emerald-500/[0.06]", amber: "border-amber-500/20 bg-amber-500/[0.06]", indigo: "border-indigo-500/20 bg-indigo-500/[0.06]" };
                const iconColors = { cyan: "text-cyan-400", emerald: "text-emerald-400", amber: "text-amber-400", indigo: "text-indigo-400" };
                const valueColors = { cyan: "text-cyan-300", emerald: "text-emerald-300", amber: "text-amber-300", indigo: "text-indigo-300" };
                return (
                  <div key={item.label} className={`border rounded-xl px-4 py-3 flex items-center gap-3 transition-all hover:scale-[1.02] duration-200 ${accents[item.accent]}`}>
                    <div className={`${iconColors[item.accent]}`}><item.icon /></div>
                    <div>
                      <div className={`text-sm font-bold ${valueColors[item.accent]}`}>{item.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest">{item.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {errorMsg && (
              <div className="mb-5 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-300 text-xs animate-in">
                <I.Alert />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {/* ── Main Grid: Scenario Studio + Sidebar ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* ── LEFT: Scenario & Configuration Panel (2 cols) ── */}
              <div className="lg:col-span-2 space-y-5">

                {/* Scenario Selection */}
                <div className="bg-[#0a1a28]/80 border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm animate-in" style={{ animationDelay: "100ms" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <I.Bot />
                        <span>Select Simulation Scenario</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1">Each scenario simulates a multi-agent pipeline with a known runaway pattern</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1">{Object.keys(SCENARIOS).length} available</span>
                  </div>
                  <div className="space-y-2.5 mb-5">
                    {Object.keys(SCENARIOS).map((id) => <ScenarioCard key={id} id={id} selected={scenario} onSelect={setScenario} />)}
                  </div>

                  {/* Agent Pipeline Flow */}
                  <div className="border-t border-white/[0.05] pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <I.Activity />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent Execution Pipeline</span>
                    </div>
                    <AgentPipelineFlow scenario={scenario} />
                  </div>
                </div>

                {/* Budget & Configuration */}
                <div className="bg-[#0a1a28]/80 border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm animate-in" style={{ animationDelay: "150ms" }}>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                    <I.Shield />
                    <span>Budget & Safety Guardrails</span>
                  </h3>

                  {/* Budget presets */}
                  <div className="mb-5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Cost ceiling</label>
                    <div className="flex gap-2">
                      {[1, 2, 5, 10].map((v) => (
                        <button
                          key={v}
                          onClick={() => setBudget(v)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${budget === v ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400/30" : "text-slate-400 hover:text-white hover:bg-white/[0.06] bg-white/[0.03] border border-white/[0.07]"}`}
                        >
                          ${v}
                        </button>
                      ))}
                      <input
                        type="number"
                        value={budget}
                        step="0.5"
                        min="0.5"
                        onChange={(e) => setBudget(parseFloat(e.target.value) || 1)}
                        className="w-20 rounded-xl px-3 py-2.5 text-sm text-white text-center bg-white/[0.03] border border-white/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-500/40 cursor-text"
                      />
                    </div>
                    {/* Safety preview indicator */}
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 bg-emerald-500/[0.05] border border-emerald-500/15 rounded-lg px-3 py-2">
                      <I.Shield />
                      <span>Auto-triggers HITL halt at <span className="text-emerald-400 font-semibold">80% threshold</span> · Prevents runaway billing</span>
                    </div>
                  </div>

                  {/* Advanced Options Accordion */}
                  <div className="border-t border-white/[0.05] pt-4">
                    <button
                      onClick={() => setAdvancedOpen(!advancedOpen)}
                      className="flex items-center justify-between w-full text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <I.Slack />
                        <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">Advanced Options</span>
                        <span className="text-[10px] text-slate-600">Slack integration & more</span>
                      </div>
                      <svg viewBox="0 0 12 12" className={`w-3 h-3 text-slate-600 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    {advancedOpen && (
                      <div className="mt-4 space-y-3 animate-in">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Slack Webhook URL</label>
                          <input
                            type="url"
                            value={slackWebhook}
                            onChange={(e) => setSlackWebhook(e.target.value)}
                            placeholder="https://hooks.slack.com/services/..."
                            className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 bg-white/[0.03] border border-white/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-500/40 cursor-text"
                          />
                          <p className="text-[10px] text-slate-600 mt-1.5">Get notified on Slack when a runaway loop is detected.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Launch Button */}
                <div className="animate-in" style={{ animationDelay: "200ms" }}>
                  <button
                    onClick={onStart}
                    disabled={starting}
                    className="w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-400 hover:from-cyan-400 hover:via-sky-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all duration-200 hover:shadow-2xl hover:shadow-cyan-500/30 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2.5 cursor-pointer text-sm relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                    {starting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Initializing Agents…</> : <><I.Play /> Launch Simulation</>}
                  </button>
                </div>

                {/* Feature Pills */}
                <div className="flex flex-wrap gap-2 animate-in" style={{ animationDelay: "250ms" }}>
                  {["Runaway loop detection", "Budget enforcement", "Dynamic Model Pricing", "Burn rate forecast", "HITL decisions", "Slack alerts", "CSV export"].map((f) => (
                    <span key={f} className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-white/[0.02] border border-white/[0.04] rounded-full px-2.5 py-1"><I.Zap />{f}</span>
                  ))}
                </div>
              </div>

              {/* ── RIGHT: Sidebar (1 col) ── */}
              <div className="space-y-5">

                {/* Recent Runs */}
                <div className="bg-[#0a1a28]/80 border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm animate-in" style={{ animationDelay: "100ms" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><I.History /> Recent Runs</h3>
                    <button onClick={() => setTab("history")} className="text-[10px] text-cyan-500 hover:text-cyan-400 font-semibold cursor-pointer transition-colors">View All →</button>
                  </div>
                  <RecentRunsMini />
                </div>

                {/* Active Guardrails */}
                <div className="bg-[#0a1a28]/80 border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm animate-in" style={{ animationDelay: "150ms" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><I.Shield /> Guardrails</h3>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">All Active</span>
                  </div>
                  <GuardrailsWidget />
                </div>

                {/* Quick Links */}
                <div className="bg-[#0a1a28]/80 border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm animate-in" style={{ animationDelay: "200ms" }}>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><I.Code /> Quick Access</h3>
                  <div className="space-y-1.5">
                    {[
                      { label: "Model Pricing Catalog", desc: "Configure per-model rates", tab: "pricing", icon: I.Dollar },
                      { label: "SDK Integration Guide", desc: "Python SDK & REST API", tab: "integrate", icon: I.Terminal },
                      { label: "Execution History", desc: "Browse all past runs", tab: "history", icon: I.History },
                    ].map((link) => (
                      <button
                        key={link.label}
                        onClick={() => setTab(link.tab)}
                        className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.08] transition-all cursor-pointer group"
                      >
                        <div className="text-slate-500 group-hover:text-cyan-400 transition-colors"><link.icon /></div>
                        <div>
                          <div className="text-[11px] font-semibold text-slate-300 group-hover:text-white transition-colors">{link.label}</div>
                          <div className="text-[9px] text-slate-600">{link.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-5 mt-8">
        <p className="text-center text-xs text-slate-700">Agent Cost Monitor v2.0 · Built for AI operations teams</p>
      </footer>
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color = "violet", urgent = false }) {
  const C = {
    violet: "from-cyan-500/12 to-sky-500/12 border-cyan-500/18",
    emerald: "from-emerald-500/12 to-teal-500/12 border-emerald-500/18",
    amber: "from-amber-500/12 to-orange-500/12 border-amber-500/18",
    rose: "from-rose-500/12 to-pink-500/12 border-rose-500/18",
  };
  const IC = { violet: "text-cyan-400", emerald: "text-emerald-400", amber: "text-amber-400", rose: "text-rose-400" };
  return (
    <div className={`bg-gradient-to-br ${C[color]} border rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${urgent ? "ring-1 ring-rose-500/40" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <span className={IC[color]}><Icon /></span>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function BudgetBar({ pct, cost, budget, forecastCost, budgetHitsIn }) {
  const p = Math.min(pct ?? 0, 100);
  const col = p > 90 ? "from-rose-500 to-pink-500" : p > 65 ? "from-amber-500 to-orange-400" : "from-cyan-500 to-sky-500";
  const tc = p > 90 ? "text-rose-400" : p > 65 ? "text-amber-400" : "text-cyan-400";
  return (
    <div className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl px-6 py-4 space-y-2">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 shrink-0"><I.Shield /><span className="text-sm font-semibold text-slate-300">Budget</span></div>
        <div className="flex-1">
          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${col} transition-all duration-700`} style={{ width: `${p}%` }} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-sm font-bold font-mono ${tc}`}>{p.toFixed(1)}%</span>
          <span className="text-xs text-slate-500 ml-2">{fmt.cost(cost)} / ${budget?.toFixed(2)}</span>
        </div>
      </div>
      {(forecastCost || budgetHitsIn != null) && (
        <div className="flex items-center gap-4 text-[11px] text-slate-500 border-t border-white/4 pt-2">
          <span className="flex items-center gap-1.5"><I.Trend />Forecast</span>
          {forecastCost && <span>Projected total: <span className="text-slate-300 font-semibold font-mono">${forecastCost.toFixed(4)}</span></span>}
          {budgetHitsIn != null && budgetHitsIn > 0 && <span className={`ml-auto font-semibold ${budgetHitsIn < 30 ? "text-rose-400" : budgetHitsIn < 120 ? "text-amber-400" : "text-slate-400"}`}>Budget reached in ~{fmt.dur(budgetHitsIn)}</span>}
          {budgetHitsIn != null && budgetHitsIn <= 0 && <span className="ml-auto font-bold text-rose-400">Budget limit reached</span>}
        </div>
      )}
    </div>
  );
}

function HitlPanel({ events, onDecision }) {
  const pending = events.filter((e) => e.decision === null);
  if (pending.length === 0) return null;
  return (
    <div className="bg-amber-500/6 border border-amber-500/30 rounded-2xl p-5 animate-in">
      <div className="flex items-center gap-2 mb-4">
        <I.Human />
        <h3 className="text-sm font-bold text-amber-300">Human Review Required</h3>
        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5 ml-1">{pending.length} pending</span>
      </div>
      <div className="space-y-3">
        {pending.map((ev) => (
          <div key={ev.id} className="bg-[#12121f] border border-white/8 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white mb-1">
                  Agent <span className="text-amber-300 font-mono">{ev.agent_id}</span> was auto-paused
                </p>
                <p className="text-xs text-slate-400 mb-1">{ev.reason}</p>
                <p className="text-xs text-slate-600 font-mono">{ev.calls} calls · ${ev.cost.toFixed(4)} spent · {fmt.time(ev.timestamp)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => onDecision(ev.id, "resume")} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer"><I.Resume /> Resume Agent</button>
                <button onClick={() => onDecision(ev.id, "kill")} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-all cursor-pointer">Kill Run</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent, onPause, onResume }) {
  const isRunaway = agent.recent_calls_5min > 20;
  const costBar = Math.min((agent.total_cost / 0.5) * 100, 100);
  return (
    <div className={`border rounded-xl p-4 transition-all duration-200 ${agent.paused ? "border-rose-500/30 bg-rose-500/4" : isRunaway ? "border-amber-500/40 bg-amber-500/4" : "border-white/6 bg-white/2 hover:border-white/10"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${agent.paused ? "bg-rose-400" : isRunaway ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
          <span className="font-semibold text-white capitalize text-sm">{agent.agent_id}</span>
          {isRunaway && !agent.paused && <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wide">Runaway</span>}
          {agent.paused && <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full px-2 py-0.5 uppercase tracking-wide">Paused</span>}
        </div>
        {agent.paused ? <button onClick={() => onResume(agent.agent_id)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/12 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all cursor-pointer"><I.Resume /> Resume</button> : <button onClick={() => onPause(agent.agent_id)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/12 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20 transition-all cursor-pointer"><I.Pause /> Pause</button>}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[['Calls', agent.total_calls, 'text-white'], ['Cost', fmt.cost(agent.total_cost), 'text-cyan-300 font-mono'], ['5m calls', agent.recent_calls_5min, isRunaway ? 'text-amber-300' : 'text-slate-300']].map(([label, value, className]) => (
          <div key={label} className="text-center bg-white/3 rounded-lg py-2">
            <div className={`text-sm font-bold ${className}`}>{value}</div>
            <div className="text-[10px] text-slate-500 uppercase">{label}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="w-full bg-white/4 rounded-full h-1.5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 transition-all duration-500" style={{ width: `${costBar}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-600">{agent.total_tokens?.toLocaleString()} tokens</span>
          <span className="text-[10px] text-slate-600">${agent.avg_cost_per_call?.toFixed(6)}/call</span>
        </div>
      </div>
    </div>
  );
}

const LOG_C = {
  call: { ag: "text-cyan-400", msg: "text-slate-300", bg: "" },
  pause: { ag: "text-rose-400", msg: "text-rose-300", bg: "bg-rose-500/5" },
  alert: { ag: "text-amber-400", msg: "text-amber-300", bg: "bg-amber-500/5" },
  info: { ag: "text-slate-500", msg: "text-slate-500", bg: "" },
};

function LiveLog({ logs }) {
  const containerRef = useRef(null);
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="bg-[#0b1a27] border border-sky-200/10 rounded-2xl flex flex-col h-64">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0">
        <I.Terminal /><span className="text-xs font-semibold text-slate-400">Live Agent Feed</span>
        <span className="ml-auto text-[10px] text-slate-600 font-mono">{logs.length} events</span>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto px-1 py-2 font-mono text-[11px] space-y-0.5">
        {logs.length === 0 ? <div className="flex items-center justify-center h-full text-slate-600">Waiting for agents…</div> : logs.map((log, i) => { const c = LOG_C[log.type] || LOG_C.call; return <div key={i} className={`flex items-start gap-2 px-3 py-1 rounded ${c.bg}`}><span className="text-slate-600 shrink-0 mt-0.5">{log.time}</span><span className={`shrink-0 w-20 truncate ${c.ag}`}>{log.agent}</span><span className={`flex-1 leading-relaxed ${c.msg}`}>{log.message}</span>{log.tokens > 0 && <span className="shrink-0 text-slate-600">{log.tokens.toLocaleString()}t</span>}{log.cost > 0 && <span className="shrink-0 text-slate-600">${log.cost.toFixed(5)}</span>}</div>; })}
      </div>
    </div>
  );
}

function AlertItem({ alert, i }) {
  const c = SEV[alert.severity] || SEV.INFO;
  return (
    <div className={`${c.bg} border-l-2 ${c.ring} rounded-r-xl p-3 alert-enter`} style={{ animationDelay: `${i * 40}ms` }}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${c.label}`}>{alert.severity}</span>
        <span className="text-[10px] text-slate-600 bg-white/4 rounded px-1.5 py-0.5 font-mono">{alert.rule}</span>
        <span className="text-[10px] text-slate-600 ml-auto font-mono">{fmt.time(alert.timestamp)}</span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
    </div>
  );
}

function HistoryTab() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistory()
      .then((d) => {
        setRuns(d.runs || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load history");
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2"><span className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />Loading history…</div>;
  if (error) return <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center text-rose-300 text-sm">{error}</div>;
  if (runs.length === 0) return <div className="flex flex-col items-center justify-center py-20 text-center"><div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center mb-4 text-[11px] font-bold tracking-[0.22em] text-slate-300">00</div><p className="text-slate-400 font-semibold mb-1">No runs yet</p><p className="text-slate-600 text-sm">Completed runs will appear here automatically.</p></div>;

  const totalSaved = runs.reduce((sum, run) => sum + Math.max((Number(run.budget) || 0) - (Number(run.total_cost) || 0), 0), 0);
  const totalSpent = runs.reduce((sum, run) => sum + (Number(run.total_cost) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[['Total Runs', runs.length, 'text-cyan-300'], ['Total Spent', `$${totalSpent.toFixed(4)}`, 'text-rose-300'], ['Budget Saved', `$${totalSaved.toFixed(4)}`, 'text-emerald-300']].map(([label, value, className]) => (
          <div key={label} className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-4 text-center">
            <div className={`text-xl font-bold font-mono ${className}`}>{value}</div>
            <div className="text-xs text-slate-500 mt-1 uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {runs.map((run) => {
          const sc = SCENARIOS[run.scenario];
          const status = run.status || 'completed';
          const statusCol = status === 'completed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : status === 'budget_exceeded' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-slate-400 bg-white/5 border-white/10';
          return (
            <div key={run.id} className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-5 hover:border-sky-200/20 transition-all">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center text-[11px] font-bold tracking-[0.2em] text-slate-300">{sc?.icon || '00'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white font-mono">{run.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCol} uppercase tracking-wide`}>{(status || 'completed').replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{sc?.label || run.scenario} · {fmt.date(run.started_at)}</p>
                  </div>
                </div>
                <button onClick={() => exportCSV(run.id)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"><I.Download /> Export</button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[['Cost', `$${Number(run.total_cost || 0).toFixed(4)}`], ['Budget', `$${Number(run.budget || 0).toFixed(2)}`], ['Calls', run.total_calls || 0], ['Alerts', run.alerts?.length || 0]].map(([label, value]) => (
                  <div key={label} className="bg-white/3 rounded-lg p-2.5 text-center">
                    <div className="text-sm font-bold text-white font-mono">{value}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{label}</div>
                  </div>
                ))}
              </div>
              {run.agents?.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {run.agents.map((agent) => (
                    <span key={agent.agent_id} className="flex items-center gap-1.5 text-[10px] bg-white/4 border border-white/8 rounded-lg px-2 py-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.paused ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                      <span className="text-slate-400 capitalize">{agent.agent_id}</span>
                      <span className="text-slate-600 font-mono">${Number(agent.cost || 0).toFixed(4)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CODE_SDK = `from agent_monitor_sdk import AgentMonitor

# Configure monitor with budget and custom model pricing
monitor = AgentMonitor(
    base_url = "http://localhost:8000",
    budget   = 10.00,
    api_key  = "your-secret-api-key",
    model_pricing = {
        "deepseek-v3": {"input": 0.14, "output": 0.28, "provider": "DeepSeek"},
        "mistral-large": {"input": 2.00, "output": 6.00, "provider": "Mistral"}
    }
)

with monitor.crew("my-analysis") as ctx:
    result = my_crewai_crew.kickoff()
    ctx.log(
        agent_id      = "researcher",
        model         = "deepseek-v3",
        input_tokens  = result.token_usage.prompt_tokens,
        output_tokens = result.token_usage.completion_tokens,
    )`;

const CODE_DECORATOR = `from agent_monitor_sdk import AgentMonitor

monitor = AgentMonitor(budget=5.00, api_key="your-api-key")

@monitor.watch(agent_id="researcher", model="gpt-4o")
def run_researcher(task: str):
    return openai_client.chat.completions.create(
        model    = "gpt-4o",
        messages = [{"role": "user", "content": task}],
    )

result = run_researcher("Research AI agent trends")`;

const CODE_REST = `# 1. Add custom model rate
curl -X POST http://localhost:8000/api/pricing \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-secret-api-key" \\
  -d '{"model": "deepseek-v3", "provider": "DeepSeek", "input_cost": 0.14, "output_cost": 0.28}'

# 2. Start monitoring
curl -X POST http://localhost:8000/api/run-crew \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-secret-api-key" \\
  -d '{"budget": 10.00, "scenario": "customer_reviews"}'

# 3. Stream metrics
wscat -c ws://localhost:8000/ws/abc12345`;

function CodeBlock({ code, lang }) {
  return (
    <div className="bg-[#0a0a15] border border-white/6 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="text-[11px] text-slate-300 font-mono p-4 overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

const CODE_CREWAI = `from agent_monitor_sdk import AgentMonitor
from crewai import Agent, Task, Crew

monitor = AgentMonitor(
    base_url = "http://localhost:8000",
    budget   = 5.00,
    api_key  = "your-secret-api-key",
)

with monitor.crew("my-crew") as ctx:
    researcher = Agent(role="Researcher", ...)
    crew = Crew(agents=[researcher], tasks=[...])
    result = crew.kickoff()
    ctx.log(
        agent_id = "researcher",
        model    = "gpt-4o",
        input_tokens  = result.token_usage.prompt_tokens,
        output_tokens = result.token_usage.completion_tokens,
    )`;

function IntegrationTab() {
  return (
    <div className="space-y-6 py-2">
      <div className="bg-cyan-500/8 border border-cyan-500/20 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-cyan-300 mb-2">What makes this different from Langfuse / Helicone</h3>
        <div className="grid grid-cols-1 gap-3 mt-4">
          {[
            ["Langfuse / Helicone", "Observe what happened after the fact. No active intervention.", "text-slate-500"],
            ["Agent Cost Monitor", "Detects runaway loops in real time, pauses agents automatically, lets a human review and decide — before money is wasted.", "text-cyan-300"],
          ].map(([name, desc, c]) => (
            <div key={name} className="bg-white/3 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 mb-1">{name}</div>
              <div className={`text-xs leading-relaxed ${c}`}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><I.Code />CrewAI integration (copy-paste ready)</h3><CodeBlock code={CODE_CREWAI} lang="python" /></div>
      <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><I.Code />Python SDK — context manager</h3><CodeBlock code={CODE_SDK} lang="python" /></div>
      <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><I.Code />Python SDK — decorator</h3><CodeBlock code={CODE_DECORATOR} lang="python" /></div>
      <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><I.Terminal />REST API + Slack + CSV export</h3><CodeBlock code={CODE_REST} lang="bash" /></div>
      <div className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Compatible frameworks</h3>
        <div className="grid grid-cols-2 gap-2">
          {[["CrewAI", "Role-based agent orchestration"], ["LangGraph", "Graph-based state machines"], ["LangChain", "Chain-based pipelines"], ["AutoGen", "Conversational agents"], ["OpenAI Agents SDK", "Native OpenAI multi-agent"], ["Custom Python", "Any LLM API wrapper"]].map(([name, desc]) => (
            <div key={name} className="flex items-start gap-2.5 bg-white/2 rounded-xl p-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div><div className="text-xs font-semibold text-slate-200">{name}</div><div className="text-[10px] text-slate-500">{desc}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const M = {
    running: { dot: "bg-emerald-400", pulse: true, text: "text-emerald-300", label: "Running" },
    completed: { dot: "bg-cyan-400", pulse: false, text: "text-cyan-300", label: "Completed" },
    budget_exceeded: { dot: "bg-rose-400", pulse: false, text: "text-rose-300", label: "Budget hit" },
    killed_by_human: { dot: "bg-rose-400", pulse: false, text: "text-rose-300", label: "Killed" },
    failed: { dot: "bg-rose-400", pulse: false, text: "text-rose-300", label: "Failed" },
  };
  const s = M[status] || M.completed;
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {s.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${s.dot} opacity-60`} />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${s.dot}`} />
      </span>
      <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
    </span>
  );
}

function WsStatusBadge({ status, attempts, onReconnect }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
        Live WS
      </span>
    );
  }

  if (status === "reconnecting") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300">
        <span className="w-2.5 h-2.5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
        Reconnecting ({attempts})
      </span>
    );
  }

  return (
    <button
      onClick={onReconnect}
      className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
      title="Click to reconnect WebSocket"
    >
      <I.Refresh /> Disconnected
    </button>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1f2d] border border-cyan-500/30 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[10px] text-slate-500 mb-2 font-mono">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ background: p.stroke }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold text-white">{p.name === "Cost ($)" ? `$${Number(p.value).toFixed(4)}` : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [crewId, setCrewId] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [scenario, setScenario] = useState("customer_reviews");
  const [budget, setBudget] = useState(2);
  const [slack, setSlack] = useState("");
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState("launchpad");
  const [activeApiKey, setActiveApiKey] = useState(getApiKey());
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [startError, setStartError] = useState(null);
  const [wsState, setWsState] = useState("disconnected");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSaveApiKey = (newKey) => {
    setApiKey(newKey);
    setActiveApiKey(newKey);
  };

  const connectWebSocket = useCallback((currentCrewId) => {
    if (!currentCrewId) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Connect through proxy or fallback to port 8000 directly in local dev
    const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const wsUrl = (isDev && reconnectAttempts > 2)
      ? `${proto}//${window.location.hostname}:8000/ws/${currentCrewId}`
      : `${proto}//${window.location.host}/ws/${currentCrewId}`;

    setWsState((prev) => (prev === "connected" ? "connected" : "reconnecting"));

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setWsState("connected");
        setReconnectAttempts(0);
      };

      ws.onmessage = (e) => {
        if (!isMountedRef.current) return;
        try {
          const d = JSON.parse(e.data);
          if (d.type === "metrics_update") {
            setMetrics(d);
            if (Array.isArray(d.log_feed)) setLogs(d.log_feed);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = (e) => {
        if (!isMountedRef.current) return;
        wsRef.current = null;
        if (!e.wasClean) {
          scheduleReconnect(currentCrewId);
        } else {
          setWsState("disconnected");
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        if (wsRef.current) {
          wsRef.current.close();
        }
      };
    } catch {
      scheduleReconnect(currentCrewId);
    }
  }, [reconnectAttempts]);

  const scheduleReconnect = useCallback((currentCrewId) => {
    if (!isMountedRef.current || !currentCrewId) return;
    setWsState("reconnecting");
    setReconnectAttempts((prev) => {
      const nextAttempt = prev + 1;
      if (nextAttempt > 5) {
        // Fallback gracefully: polling is still active
        setWsState("disconnected");
        return 0;
      }
      const delay = Math.min(1000 * Math.pow(1.5, nextAttempt), 8000);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && currentCrewId) {
          connectWebSocket(currentCrewId);
        }
      }, delay);
      return nextAttempt;
    });
  }, [connectWebSocket]);

  useEffect(() => {
    if (!crewId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      return;
    }

    const pollMetrics = async () => {
      try {
        const data = await fetchMetrics(crewId);
        if (data && Object.keys(data).length > 0 && isMountedRef.current) {
          setMetrics(data);
          if (Array.isArray(data.log_feed)) setLogs(data.log_feed);
        }
      } catch (error) {
        console.warn("Metrics polling:", error.message);
      }
    };

    pollMetrics();
    pollTimerRef.current = setInterval(pollMetrics, 2000);
    connectWebSocket(crewId);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [crewId, connectWebSocket]);

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const d = await startCrew(budget, scenario, slack || null);
      setCrewId(d.crew_id);
      setTab("monitor");
      setLogs([]);
    } catch (e) {
      setStartError(e.message || "Failed to start crew run");
    } finally {
      setStarting(false);
    }
  };

  const handlePause = useCallback(async (agentId) => {
    try {
      await pauseAgent(crewId, agentId);
    } catch (e) {
      console.error("Pause failed:", e.message);
    }
  }, [crewId]);

  const handleResume = useCallback(async (agentId) => {
    try {
      await resumeAgent(crewId, agentId);
    } catch (e) {
      console.error("Resume failed:", e.message);
    }
  }, [crewId]);

  const handleHitl = useCallback(async (eventId, decision) => {
    try {
      await resolveHitl(crewId, eventId, decision);
    } catch (e) {
      console.error("HITL decision failed:", e.message);
    }
  }, [crewId]);

  if (!crewId) {
    return (
      <>
        <LaunchScreen
          scenario={scenario}
          setScenario={setScenario}
          budget={budget}
          setBudget={setBudget}
          slackWebhook={slack}
          setSlackWebhook={setSlack}
          onStart={handleStart}
          starting={starting}
          onOpenKeyModal={() => setShowKeyModal(true)}
          hasApiKey={Boolean(activeApiKey)}
          errorMsg={startError}
          tab={tab}
          setTab={setTab}
        />
        <ApiKeyModal
          isOpen={showKeyModal}
          onClose={() => setShowKeyModal(false)}
          currentKey={activeApiKey}
          onSave={handleSaveApiKey}
        />
      </>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-[#05141d] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="w-5 h-5 border-2 border-slate-600 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-sm">Connecting to crew…</span>
        </div>
      </div>
    );
  }

  const alertCount = metrics.alerts?.length ?? 0;
  const criticalCount = metrics.alerts?.filter((a) => a.severity === "CRITICAL").length ?? 0;
  const hitlQueue = metrics.hitl_queue || [];
  const sc = SCENARIOS[scenario];
  const scenarioLabel = `${sc?.icon || "00"} ${sc?.label || scenario}`;
  const TABS = [["monitor", "Monitor"], ["history", "History"], ["pricing", "Pricing"], ["integrate", "Integrate"]];

  return (
    <div className="min-h-screen bg-[#05141d] text-white font-sans">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-cyan-600/5 blur-[130px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-sky-200/10 bg-[#05141d]/88 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-950/60 ring-1 ring-cyan-400/20 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0 overflow-hidden">
              <img src="/logo-agent-cost-monitor-111.jpg" alt="Brand logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Agent Cost Monitor</h1>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">crew/{crewId} · {scenarioLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white/4 border border-white/8 rounded-xl p-1">
              {TABS.map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${tab === k ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>{l}</button>
              ))}
            </div>

            <WsStatusBadge
              status={wsState}
              attempts={reconnectAttempts}
              onReconnect={() => connectWebSocket(crewId)}
            />

            <StatusPill status={metrics.status} />

            <button
              onClick={() => setShowKeyModal(true)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                activeApiKey ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300" : "bg-white/5 border-white/8 text-slate-400 hover:text-white"
              }`}
              title="Configure API Key"
            >
              <I.Key />
            </button>

            {alertCount > 0 && (
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${criticalCount > 0 ? "bg-rose-500/15 text-rose-300 border border-rose-500/30" : "bg-amber-500/15 text-amber-300 border border-amber-500/30"}`}>
                <I.Alert />{alertCount} alert{alertCount !== 1 ? "s" : ""}
              </span>
            )}
            {metrics.status === "completed" && (
              <button onClick={() => exportCSV(crewId)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer">
                <I.Download /> Export CSV
              </button>
            )}
            <button onClick={() => { setCrewId(null); setMetrics(null); setLogs([]); setTab("launchpad"); }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
              <I.Plus /> New Run
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 relative z-10">
        {tab === "history" ? <HistoryTab /> : tab === "pricing" ? <PricingTab /> : tab === "integrate" ? <IntegrationTab /> : (
          <div className="space-y-5">
            <BudgetBar pct={metrics.budget_used_pct} cost={metrics.total_cost} budget={metrics.budget} forecastCost={metrics.forecast_cost} budgetHitsIn={metrics.budget_hits_in} />
            <HitlPanel events={hitlQueue} onDecision={handleHitl} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in">
              <MetricCard label="Total Cost" value={fmt.cost(metrics.total_cost)} sub={`${metrics.budget_used_pct ?? 0}% of budget`} icon={I.Dollar} color="violet" />
              <MetricCard label="API Calls" value={metrics.total_calls ?? 0} sub="across all agents" icon={I.Activity} color="emerald" />
              <MetricCard label="Duration" value={fmt.dur(metrics.duration_seconds)} sub="elapsed" icon={I.Clock} color="amber" />
              <MetricCard label="Alerts" value={alertCount} sub={criticalCount > 0 ? `${criticalCount} critical` : "all clear"} icon={I.Shield} color={criticalCount > 0 ? "rose" : "emerald"} urgent={criticalCount > 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-slate-200">Cost & Calls Over Time</h2>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-cyan-500 rounded inline-block" /> Cost</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-emerald-500 rounded inline-block" /> Calls</span>
                  </div>
                </div>
                {(metrics.cost_timeline?.length ?? 0) < 2 ? <div className="h-52 flex items-center justify-center text-slate-600 text-sm gap-2"><span className="w-4 h-4 border-2 border-slate-700 border-t-slate-500 rounded-full animate-spin" />Waiting for data…</div> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={metrics.cost_timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38BDF8" stopOpacity={0.25} /><stop offset="95%" stopColor="#38BDF8" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="time" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="l" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="r" orientation="right" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      {metrics.budget && <ReferenceLine yAxisId="l" y={metrics.budget} stroke="#ec4899" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "Budget", fill: "#ec4899", fontSize: 10 }} />}
                      <Area yAxisId="l" type="monotone" dataKey="cost" stroke="#38BDF8" fill="url(#gC)" name="Cost ($)" strokeWidth={2} dot={false} />
                      <Area yAxisId="r" type="monotone" dataKey="calls" stroke="#10b981" fill="url(#gA)" name="API Calls" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h2 className="text-sm font-semibold text-slate-200">Live Alerts</h2>
                  {alertCount > 0 && <span className="text-[10px] font-bold bg-white/5 text-slate-400 rounded-full px-2 py-0.5">{alertCount}</span>}
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {alertCount === 0 ? <div className="h-full flex flex-col items-center justify-center text-center py-8"><div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3"><I.Check /></div><p className="text-sm text-slate-500">No alerts</p><p className="text-xs text-slate-600 mt-1">Everything looks normal</p></div> : [...metrics.alerts].reverse().slice(0, 20).map((a, i) => <AlertItem key={i} alert={a} i={i} />)}
                </div>
              </div>
            </div>

            <LiveLog logs={logs} />

            <div>
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Agents — {metrics.agents?.length ?? 0} active</h2>
              {(!metrics.agents || metrics.agents.length === 0) ? <div className="bg-[#0d1f2d] border border-sky-200/10 rounded-2xl p-8 text-center text-slate-500 text-sm">Waiting for agents to initialize…</div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{metrics.agents.map((a) => <AgentCard key={a.agent_id} agent={a} onPause={handlePause} onResume={handleResume} />)}</div>}
            </div>
          </div>
        )}
      </main>

      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        currentKey={activeApiKey}
        onSave={handleSaveApiKey}
      />

      <footer className="border-t border-white/4 py-5 mt-8">
        <p className="text-center text-xs text-slate-700">Agent Cost Monitor v2.0 · Built for AI operations teams</p>
      </footer>
    </div>
  );
}
