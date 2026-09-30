import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { startCrew, pauseAgent, resumeAgent, resolveHitl, fetchHistory, exportCSV } from "./api";

/* ─── Icons ─────────────────────────────────────────────────── */
const I = {
  Bot:      ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 11V7"/><circle cx="12" cy="5" r="2"/><path d="M8 15h.01M16 15h.01M8 19h8"/></svg>,
  Play:     ()=><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z"/></svg>,
  Pause:    ()=><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>,
  Resume:   ()=><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 5v14l11-7z"/></svg>,
  Dollar:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Activity: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Clock:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Shield:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Alert:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Check:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Plus:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Zap:      ()=><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Terminal: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  Code:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  Copy:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Download: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  History:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>,
  Slack:    ()=><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>,
  Human:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Trend:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
};

/* ─── Constants ───────────────────────────────────────────────── */
const SEV = {
  CRITICAL:{ring:"border-rose-500/60",  bg:"bg-rose-500/8",  dot:"bg-rose-400",  label:"text-rose-300"},
  HIGH:    {ring:"border-amber-500/60", bg:"bg-amber-500/8", dot:"bg-amber-400", label:"text-amber-300"},
  MEDIUM:  {ring:"border-yellow-500/60",bg:"bg-yellow-500/8",dot:"bg-yellow-400",label:"text-yellow-300"},
  LOW:     {ring:"border-blue-500/60",  bg:"bg-blue-500/8",  dot:"bg-blue-400",  label:"text-blue-300"},
  INFO:    {ring:"border-slate-500/60", bg:"bg-slate-500/8", dot:"bg-slate-400", label:"text-slate-300"},
};

const SCENARIOS = {
  customer_reviews:{icon:"⭐",label:"Customer Review Analyzer",   desc:"Analyzer loops on sentiment re-checks",              agents:["researcher","analyzer","writer"]},
  market_research: {icon:"📊",label:"Market Research Pipeline",   desc:"Researcher loops on market data fetching",            agents:["researcher","analyzer","strategist"]},
  code_review:     {icon:"💻",label:"Code Review Assistant",      desc:"Reviewer loops on complexity scoring",               agents:["scanner","reviewer","writer"]},
};

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt   = {
  dur:  s=>{ if(!s)return"0s"; const m=Math.floor(s/60),sec=s%60; return m>0?`${m}m ${sec}s`:`${sec}s`; },
  cost: n=>typeof n==="number"?`$${n.toFixed(4)}`:"$0.0000",
  time: iso=>iso?new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"",
  date: iso=>iso?new Date(iso).toLocaleDateString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"",
};

/* ─── CopyButton ──────────────────────────────────────────────── */
function CopyButton({text}){
  const[ok,setOk]=useState(false);
  return <button onClick={()=>{navigator.clipboard.writeText(text);setOk(true);setTimeout(()=>setOk(false),2000);}}
    className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
    <I.Copy/>{ok?"Copied!":"Copy"}
  </button>;
}

/* ─── Scenario Card ───────────────────────────────────────────── */
function ScenarioCard({id,selected,onSelect}){
  const m=SCENARIOS[id]||{};
  const on=selected===id;
  return <button onClick={()=>onSelect(id)} className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer
    ${on?"border-violet-500/60 bg-violet-500/10":"border-white/8 bg-white/2 hover:border-white/15 hover:bg-white/4"}`}>
    <div className="flex items-start gap-3">
      <span className="text-2xl mt-0.5 shrink-0">{m.icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-semibold ${on?"text-white":"text-slate-300"}`}>{m.label}</span>
          {on&&<span className="text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full px-2 py-0.5">Selected</span>}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{m.desc}</p>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {m.agents?.map(a=><span key={a} className="text-[10px] bg-white/5 text-slate-500 rounded px-1.5 py-0.5 font-mono">{a}</span>)}
        </div>
      </div>
    </div>
  </button>;
}

/* ─── Launch Screen ───────────────────────────────────────────── */
function LaunchScreen({scenario,setScenario,budget,setBudget,slackWebhook,setSlackWebhook,onStart,starting}){
  return(
    <div className="min-h-screen bg-[#0a0a18] flex flex-col items-center justify-center px-6 py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-violet-600/10 blur-[130px]"/>
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[100px]"/>
      </div>
      <div className="relative z-10 w-full max-w-xl">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25"><I.Bot/></div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Agent Cost Monitor</h1>
            <p className="text-sm text-slate-500">Real-time multi-agent AI observability</p>
          </div>
        </div>

        <div className="bg-[#12121f] border border-white/6 rounded-3xl p-8 shadow-2xl shadow-black/50 mb-4">
          <h2 className="text-base font-semibold text-white mb-1">Choose a scenario</h2>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            Each scenario simulates a real-world multi-agent pipeline. One agent always enters a runaway loop — watch the system detect and pause it in real time.
          </p>
          <div className="space-y-2.5 mb-6">
            {Object.keys(SCENARIOS).map(id=><ScenarioCard key={id} id={id} selected={scenario} onSelect={setScenario}/>)}
          </div>

          {/* Budget */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Budget limit</label>
            <div className="flex gap-2">
              {[1,2,5,10].map(v=>(
                <button key={v} onClick={()=>setBudget(v)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer
                    ${budget===v?"bg-violet-600 text-white shadow-lg shadow-violet-500/25":"text-slate-400 hover:text-white hover:bg-white/8"}`}
                  style={budget!==v?{background:"#1e1e35",border:"1px solid rgba(255,255,255,0.08)"}:{}}>
                  ${v}
                </button>
              ))}
              <input type="number" value={budget} step="0.5" min="0.5" onChange={e=>setBudget(parseFloat(e.target.value)||1)}
                className="w-20 rounded-xl px-3 py-2.5 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-violet-500/40 cursor-text"
                style={{background:"#1e1e35",border:"1px solid rgba(255,255,255,0.08)"}}/>
            </div>
          </div>

          {/* Slack webhook */}
          <div className="mb-7">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <I.Slack/> Slack Webhook <span className="normal-case text-slate-600 font-normal">(optional)</span>
            </label>
            <input type="url" value={slackWebhook} onChange={e=>setSlackWebhook(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 cursor-text"
              style={{background:"#1e1e35",border:"1px solid rgba(255,255,255,0.08)"}}/>
            <p className="text-[11px] text-slate-600 mt-1.5">Get notified on Slack when a runaway loop is detected.</p>
          </div>

          <button onClick={onStart} disabled={starting}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer text-sm">
            {starting?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Starting…</>:<><I.Play/> Launch Simulation</>}
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {["Runaway loop detection","Budget enforcement","Burn rate forecast","HITL decisions","Slack alerts","CSV export","Run history"].map(f=>(
            <span key={f} className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-white/2 border border-white/5 rounded-full px-3 py-1.5"><I.Zap/>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Metric Card ─────────────────────────────────────────────── */
function MetricCard({label,value,sub,icon:Icon,color="violet",urgent=false}){
  const C={violet:"from-violet-500/12 to-indigo-500/12 border-violet-500/18",emerald:"from-emerald-500/12 to-teal-500/12 border-emerald-500/18",amber:"from-amber-500/12 to-orange-500/12 border-amber-500/18",rose:"from-rose-500/12 to-pink-500/12 border-rose-500/18"};
  const IC={violet:"text-violet-400",emerald:"text-emerald-400",amber:"text-amber-400",rose:"text-rose-400"};
  return(
    <div className={`bg-gradient-to-br ${C[color]} border rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${urgent?"ring-1 ring-rose-500/40":""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <span className={IC[color]}><Icon/></span>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      {sub&&<div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

/* ─── Budget Bar ──────────────────────────────────────────────── */
function BudgetBar({pct,cost,budget,forecastCost,budgetHitsIn}){
  const p=Math.min(pct??0,100);
  const col=p>90?"from-rose-500 to-pink-500":p>65?"from-amber-500 to-orange-400":"from-violet-500 to-indigo-500";
  const tc=p>90?"text-rose-400":p>65?"text-amber-400":"text-violet-400";
  const hitsIn=budgetHitsIn;
  return(
    <div className="bg-[#12121f] border border-white/6 rounded-2xl px-6 py-4 space-y-2">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 shrink-0"><I.Shield/><span className="text-sm font-semibold text-slate-300">Budget</span></div>
        <div className="flex-1">
          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${col} transition-all duration-700`} style={{width:`${p}%`}}/>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-sm font-bold font-mono ${tc}`}>{p.toFixed(1)}%</span>
          <span className="text-xs text-slate-500 ml-2">{fmt.cost(cost)} / ${budget?.toFixed(2)}</span>
        </div>
      </div>
      {/* Forecast row */}
      {(forecastCost||hitsIn)&&(
        <div className="flex items-center gap-4 text-[11px] text-slate-500 border-t border-white/4 pt-2">
          <span className="flex items-center gap-1.5"><I.Trend/>Forecast</span>
          {forecastCost&&<span>Projected total: <span className="text-slate-300 font-semibold font-mono">${forecastCost.toFixed(4)}</span></span>}
          {hitsIn!=null&&hitsIn>0&&<span className={`ml-auto font-semibold ${hitsIn<30?"text-rose-400":hitsIn<120?"text-amber-400":"text-slate-400"}`}>
            Budget reached in ~{fmt.dur(hitsIn)}
          </span>}
          {hitsIn!=null&&hitsIn<=0&&<span className="ml-auto font-bold text-rose-400">Budget limit reached</span>}
        </div>
      )}
    </div>
  );
}

/* ─── HITL Panel ──────────────────────────────────────────────── */
function HitlPanel({events,crewId,onDecision}){
  const pending=events.filter(e=>e.decision===null);
  if(pending.length===0) return null;
  return(
    <div className="bg-amber-500/6 border border-amber-500/30 rounded-2xl p-5 animate-in">
      <div className="flex items-center gap-2 mb-4">
        <I.Human/>
        <h3 className="text-sm font-bold text-amber-300">Human Review Required</h3>
        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5 ml-1">{pending.length} pending</span>
      </div>
      <div className="space-y-3">
        {pending.map(ev=>(
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
                <button onClick={()=>onDecision(ev.id,"resume")}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer">
                  <I.Resume/> Resume Agent
                </button>
                <button onClick={()=>onDecision(ev.id,"kill")}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-all cursor-pointer">
                  Kill Run
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Agent Card ──────────────────────────────────────────────── */
function AgentCard({agent,crewId,onPause,onResume}){
  const isRunaway=agent.recent_calls_5min>20;
  const costBar=Math.min((agent.total_cost/0.5)*100,100);
  return(
    <div className={`border rounded-xl p-4 transition-all duration-200
      ${agent.paused?"border-rose-500/30 bg-rose-500/4":isRunaway?"border-amber-500/40 bg-amber-500/4":"border-white/6 bg-white/2 hover:border-white/10"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${agent.paused?"bg-rose-400":isRunaway?"bg-amber-400 animate-pulse":"bg-emerald-400"}`}/>
          <span className="font-semibold text-white capitalize text-sm">{agent.agent_id}</span>
          {isRunaway&&!agent.paused&&<span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wide">Runaway</span>}
          {agent.paused&&<span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full px-2 py-0.5 uppercase tracking-wide">Paused</span>}
        </div>
        {agent.paused
          ?<button onClick={()=>onResume(agent.agent_id)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/12 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all cursor-pointer"><I.Resume/> Resume</button>
          :<button onClick={()=>onPause(agent.agent_id)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/12 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20 transition-all cursor-pointer"><I.Pause/> Pause</button>
        }
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[["Calls",agent.total_calls,"text-white"],["Cost",fmt.cost(agent.total_cost),"text-violet-300 font-mono"],["5m calls",agent.recent_calls_5min,isRunaway?"text-amber-300":"text-slate-300"]].map(([l,v,c])=>(
          <div key={l} className="text-center bg-white/3 rounded-lg py-2">
            <div className={`text-sm font-bold ${c}`}>{v}</div>
            <div className="text-[10px] text-slate-500 uppercase">{l}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="w-full bg-white/4 rounded-full h-1.5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500" style={{width:`${costBar}%`}}/>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-600">{agent.total_tokens?.toLocaleString()} tokens</span>
          <span className="text-[10px] text-slate-600">${agent.avg_cost_per_call?.toFixed(6)}/call</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Live Log Feed ───────────────────────────────────────────── */
const LOG_C={call:{ag:"text-violet-400",msg:"text-slate-300",bg:""},pause:{ag:"text-rose-400",msg:"text-rose-300",bg:"bg-rose-500/5"},alert:{ag:"text-amber-400",msg:"text-amber-300",bg:"bg-amber-500/5"},info:{ag:"text-slate-500",msg:"text-slate-500",bg:""}};
function LiveLog({logs}){
  const containerRef = useRef(null);

  // Scroll ONLY the inner container — never the page
  useEffect(()=>{
    const el = containerRef.current;
    if(el) el.scrollTop = el.scrollHeight;
  },[logs]);

  return(
    <div className="bg-[#0d0d1a] border border-white/6 rounded-2xl flex flex-col h-64">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0">
        <I.Terminal/><span className="text-xs font-semibold text-slate-400">Live Agent Feed</span>
        <span className="ml-auto text-[10px] text-slate-600 font-mono">{logs.length} events</span>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto px-1 py-2 font-mono text-[11px] space-y-0.5">
        {logs.length===0?<div className="flex items-center justify-center h-full text-slate-600">Waiting for agents…</div>:
          logs.map((log,i)=>{const c=LOG_C[log.type]||LOG_C.call;return(
            <div key={i} className={`flex items-start gap-2 px-3 py-1 rounded ${c.bg}`}>
              <span className="text-slate-600 shrink-0 mt-0.5">{log.time}</span>
              <span className={`shrink-0 w-20 truncate ${c.ag}`}>{log.agent}</span>
              <span className={`flex-1 leading-relaxed ${c.msg}`}>{log.message}</span>
              {log.tokens>0&&<span className="shrink-0 text-slate-600">{log.tokens.toLocaleString()}t</span>}
              {log.cost>0&&<span className="shrink-0 text-slate-600">${log.cost.toFixed(5)}</span>}
            </div>
          );})}
      </div>
    </div>
  );
}

/* ─── Alert Item ──────────────────────────────────────────────── */
function AlertItem({alert,i}){
  const c=SEV[alert.severity]||SEV.INFO;
  return(
    <div className={`${c.bg} border-l-2 ${c.ring} rounded-r-xl p-3 alert-enter`} style={{animationDelay:`${i*40}ms`}}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`}/>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${c.label}`}>{alert.severity}</span>
        <span className="text-[10px] text-slate-600 bg-white/4 rounded px-1.5 py-0.5 font-mono">{alert.rule}</span>
        <span className="text-[10px] text-slate-600 ml-auto font-mono">{fmt.time(alert.timestamp)}</span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
    </div>
  );
}

/* ─── History Tab ─────────────────────────────────────────────── */
function HistoryTab(){
  const[runs,setRuns]=useState([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{ fetchHistory().then(d=>{ setRuns(d.runs||[]); setLoading(false); }).catch(()=>setLoading(false)); },[]);

  if(loading) return <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2"><span className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin"/>Loading history…</div>;
  if(runs.length===0) return(
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center mb-4 text-3xl">📋</div>
      <p className="text-slate-400 font-semibold mb-1">No runs yet</p>
      <p className="text-slate-600 text-sm">Completed runs will appear here automatically.</p>
    </div>
  );

  const totalSaved=runs.reduce((s,r)=>s+(r.budget-r.total_cost>0?r.budget-r.total_cost:0),0);
  const totalSpent=runs.reduce((s,r)=>s+r.total_cost,0);

  return(
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[["Total Runs",runs.length,"text-violet-300"],["Total Spent",`$${totalSpent.toFixed(4)}`,"text-rose-300"],["Budget Saved",`$${totalSaved.toFixed(4)}`,"text-emerald-300"]].map(([l,v,c])=>(
          <div key={l} className="bg-[#12121f] border border-white/6 rounded-2xl p-4 text-center">
            <div className={`text-xl font-bold font-mono ${c}`}>{v}</div>
            <div className="text-xs text-slate-500 mt-1 uppercase tracking-wide">{l}</div>
          </div>
        ))}
      </div>

      {/* Run rows */}
      <div className="space-y-3">
        {runs.map(run=>{
          const sc=SCENARIOS[run.scenario];
          const statusCol=run.status==="completed"?"text-emerald-400 bg-emerald-500/10 border-emerald-500/20":run.status==="budget_exceeded"?"text-rose-400 bg-rose-500/10 border-rose-500/20":"text-slate-400 bg-white/5 border-white/10";
          return(
            <div key={run.id} className="bg-[#12121f] border border-white/6 rounded-2xl p-5 hover:border-white/12 transition-all">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{sc?.icon||"🤖"}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white font-mono">{run.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCol} uppercase tracking-wide`}>{run.status.replace("_"," ")}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{sc?.label||run.scenario} · {fmt.date(run.started_at)}</p>
                  </div>
                </div>
                <button onClick={()=>exportCSV(run.id)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0">
                  <I.Download/> Export
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[["Cost",`$${run.total_cost.toFixed(4)}`],["Budget",`$${run.budget.toFixed(2)}`],["Calls",run.total_calls],["Alerts",run.alerts_fired]].map(([l,v])=>(
                  <div key={l} className="bg-white/3 rounded-lg p-2.5 text-center">
                    <div className="text-sm font-bold text-white font-mono">{v}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{l}</div>
                  </div>
                ))}
              </div>
              {run.agents?.length>0&&(
                <div className="flex gap-2 mt-3 flex-wrap">
                  {run.agents.map(a=>(
                    <span key={a.agent_id} className="flex items-center gap-1.5 text-[10px] bg-white/4 border border-white/8 rounded-lg px-2 py-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${a.paused?"bg-rose-400":"bg-emerald-400"}`}/>
                      <span className="text-slate-400 capitalize">{a.agent_id}</span>
                      <span className="text-slate-600 font-mono">${a.cost.toFixed(4)}</span>
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

/* ─── Integration Tab ─────────────────────────────────────────── */
const CODE_SDK=`from agent_monitor_sdk import AgentMonitor

# 1. Create monitor
monitor = AgentMonitor(
    base_url = "http://localhost:8000",
    budget   = 10.00,
)

# 2. Wrap your crew run (add 1 line before, 1 line per API call)
with monitor.crew("my-analysis") as ctx:
    result = my_crewai_crew.kickoff()  # your existing code, unchanged

    # Log token usage from the crew output
    ctx.log(
        agent_id      = "researcher",
        model         = "gpt-4-turbo",
        input_tokens  = result.token_usage.prompt_tokens,
        output_tokens = result.token_usage.completion_tokens,
    )

# ctx.summary() → {"total_cost": 0.43, "total_calls": 47, ...}`;

const CODE_DECORATOR=`from agent_monitor_sdk import AgentMonitor

monitor = AgentMonitor(budget=5.00)

# Decorator: auto-extracts token usage from OpenAI response
@monitor.watch(agent_id="researcher", model="gpt-4-turbo")
def run_researcher(task: str):
    return openai_client.chat.completions.create(
        model    = "gpt-4-turbo",
        messages = [{"role": "user", "content": task}],
    )

result = run_researcher("Research AI agent trends")
# Token usage logged automatically — no code changes needed`;

const CODE_REST=`# Start monitoring
curl -X POST http://localhost:8000/api/run-crew \\
  -H "Content-Type: application/json" \\
  -d '{"budget": 10.00, "scenario": "customer_reviews",
       "slack_webhook": "https://hooks.slack.com/..."}'

# → {"crew_id": "abc12345"}

# Real-time metrics
curl http://localhost:8000/api/metrics/abc12345

# Pause runaway agent
curl -X POST http://localhost:8000/api/pause/abc12345/analyzer

# Download CSV report
curl -o report.csv http://localhost:8000/api/export/abc12345

# WebSocket stream
wscat -c ws://localhost:8000/ws/abc12345`;

function CodeBlock({code,lang}){return(
  <div className="bg-[#0a0a15] border border-white/6 rounded-xl overflow-hidden">
    <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lang}</span>
      <CopyButton text={code}/>
    </div>
    <pre className="text-[11px] text-slate-300 font-mono p-4 overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
  </div>
);}

const CODE_CREWAI=`from agent_monitor_sdk import AgentMonitor
from crewai import Agent, Task, Crew

monitor = AgentMonitor(base_url="http://localhost:8000", budget=5.00)

with monitor.crew("my-crew") as ctx:
    # Your existing CrewAI code — zero changes
    researcher = Agent(role="Researcher", ...)
    crew = Crew(agents=[researcher], tasks=[...])
    result = crew.kickoff()

    # Log token usage from the crew output
    ctx.log(
        agent_id = "researcher",
        model    = "gpt-4-turbo",
        input_tokens  = result.token_usage.prompt_tokens,
        output_tokens = result.token_usage.completion_tokens,
    )

# Auto-prints cost summary + saves to history`;

function IntegrationTab(){return(
  <div className="space-y-6 py-2">
    <div className="bg-violet-500/8 border border-violet-500/20 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-violet-300 mb-2">What makes this different from Langfuse / Helicone</h3>
      <div className="grid grid-cols-1 gap-3 mt-4">
        {[
          ["Langfuse / Helicone","Observe what happened after the fact. No active intervention.","text-slate-500"],
          ["Agent Cost Monitor","Detects runaway loops in real time, pauses agents automatically, lets a human review and decide — before money is wasted.","text-violet-300"],
        ].map(([name,desc,c])=>(
          <div key={name} className="bg-white/3 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-400 mb-1">{name}</div>
            <div className={`text-xs leading-relaxed ${c}`}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
    <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><I.Code/>CrewAI integration (copy-paste ready)</h3><CodeBlock code={CODE_CREWAI} lang="python"/></div>
    <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><I.Code/>Python SDK — context manager</h3><CodeBlock code={CODE_SDK} lang="python"/></div>
    <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><I.Code/>Python SDK — decorator</h3><CodeBlock code={CODE_DECORATOR} lang="python"/></div>
    <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><I.Terminal/>REST API + Slack + CSV export</h3><CodeBlock code={CODE_REST} lang="bash"/></div>
    <div className="bg-[#12121f] border border-white/6 rounded-2xl p-5">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Compatible frameworks</h3>
      <div className="grid grid-cols-2 gap-2">
        {[["CrewAI","Role-based agent orchestration"],["LangGraph","Graph-based state machines"],["LangChain","Chain-based pipelines"],["AutoGen","Conversational agents"],["OpenAI Agents SDK","Native OpenAI multi-agent"],["Custom Python","Any LLM API wrapper"]].map(([name,desc])=>(
          <div key={name} className="flex items-start gap-2.5 bg-white/2 rounded-xl p-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"/>
            <div><div className="text-xs font-semibold text-slate-200">{name}</div><div className="text-[10px] text-slate-500">{desc}</div></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);}

/* ─── Status Pill ─────────────────────────────────────────────── */
function StatusPill({status}){
  const M={running:{dot:"bg-emerald-400",pulse:true,text:"text-emerald-300",label:"Running"},completed:{dot:"bg-blue-400",pulse:false,text:"text-blue-300",label:"Completed"},budget_exceeded:{dot:"bg-rose-400",pulse:false,text:"text-rose-300",label:"Budget hit"},killed_by_human:{dot:"bg-rose-400",pulse:false,text:"text-rose-300",label:"Killed"},failed:{dot:"bg-rose-400",pulse:false,text:"text-rose-300",label:"Failed"}};
  const s=M[status]||M.completed;
  return(<span className="flex items-center gap-1.5">
    <span className="relative flex h-2 w-2">
      {s.pulse&&<span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${s.dot} opacity-60`}/>}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${s.dot}`}/>
    </span>
    <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
  </span>);
}

/* ─── Tooltip ─────────────────────────────────────────────────── */
function ChartTooltip({active,payload,label}){
  if(!active||!payload?.length) return null;
  return(<div className="bg-[#1a1a2e] border border-violet-500/30 rounded-xl px-4 py-3 shadow-2xl">
    <p className="text-[10px] text-slate-500 mb-2 font-mono">{label}</p>
    {payload.map(p=>(
      <div key={p.name} className="flex items-center gap-2 text-xs">
        <span className="w-2 h-2 rounded-full" style={{background:p.stroke}}/>
        <span className="text-slate-400">{p.name}:</span>
        <span className="font-bold text-white">{p.name==="Cost ($)"?`$${Number(p.value).toFixed(4)}`:p.value}</span>
      </div>
    ))}
  </div>);
}

/* ─── Main Dashboard ──────────────────────────────────────────── */
export default function Dashboard(){
  const[crewId,   setCrewId]   =useState(null);
  const[metrics,  setMetrics]  =useState(null);
  const[logs,     setLogs]     =useState([]);
  const[scenario, setScenario] =useState("customer_reviews");
  const[budget,   setBudget]   =useState(2);
  const[slack,    setSlack]    =useState("");
  const[starting, setStarting] =useState(false);
  const[tab,      setTab]      =useState("monitor");

  /* WebSocket */
  useEffect(()=>{
    if(!crewId) return;
    const proto=window.location.protocol==="https:"?"wss:":"ws:";
    const ws=new WebSocket(`${proto}//${window.location.host}/ws/${crewId}`);
    ws.onmessage=e=>{
      const d=JSON.parse(e.data);
      if(d.type==="metrics_update"){
        setMetrics(d);
        if(d.log_feed) setLogs(d.log_feed);
      }
    };
    return()=>ws.close();
  },[crewId]);

  const handleStart=async()=>{
    setStarting(true);
    try{
      const d=await startCrew(budget,scenario,slack||null);
      setCrewId(d.crew_id); setLogs([]);
    }catch(e){console.error(e);}
    finally{setStarting(false);}
  };

  const handlePause  =useCallback(async aid=>{ await pauseAgent(crewId,aid); },[crewId]);
  const handleResume =useCallback(async aid=>{ await resumeAgent(crewId,aid); },[crewId]);
  const handleHitl   =useCallback(async(eventId,decision)=>{
    await resolveHitl(crewId,eventId,decision);
  },[crewId]);

  if(!crewId) return <LaunchScreen scenario={scenario} setScenario={setScenario} budget={budget} setBudget={setBudget} slackWebhook={slack} setSlackWebhook={setSlack} onStart={handleStart} starting={starting}/>;

  if(!metrics) return(
    <div className="min-h-screen bg-[#0a0a18] flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <span className="w-5 h-5 border-2 border-slate-600 border-t-violet-500 rounded-full animate-spin"/>
        <span className="text-sm">Connecting to crew…</span>
      </div>
    </div>
  );

  const alertCount   =metrics.alerts?.length??0;
  const criticalCount=metrics.alerts?.filter(a=>a.severity==="CRITICAL").length??0;
  const hitlQueue    =metrics.hitl_queue||[];
  const sc           =SCENARIOS[scenario];
  const scenarioLabel=`${sc?.icon||"🤖"} ${sc?.label||scenario}`;
  const TABS=[["monitor","Monitor"],["history","History"],["integrate","Integrate"]];

  return(
    <div className="min-h-screen bg-[#0a0a18] text-white font-sans">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-violet-600/5 blur-[130px]"/>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a18]/88 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0"><I.Bot/></div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Agent Cost Monitor</h1>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">crew/{crewId} · {scenarioLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white/4 border border-white/8 rounded-xl p-1">
              {TABS.map(([k,l])=>(
                <button key={k} onClick={()=>setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${tab===k?"bg-violet-600 text-white shadow":"text-slate-400 hover:text-white"}`}>{l}</button>
              ))}
            </div>
            <StatusPill status={metrics.status}/>
            {alertCount>0&&<span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${criticalCount>0?"bg-rose-500/15 text-rose-300 border border-rose-500/30":"bg-amber-500/15 text-amber-300 border border-amber-500/30"}`}><I.Alert/>{alertCount} alert{alertCount!==1?"s":""}</span>}
            {metrics.status==="completed"&&<button onClick={()=>exportCSV(crewId)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"><I.Download/> Export CSV</button>}
            <button onClick={()=>{setCrewId(null);setMetrics(null);setLogs([]);}} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"><I.Plus/> New Run</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 relative z-10">
        {tab==="history"?<HistoryTab/>:tab==="integrate"?<IntegrationTab/>:(
          <div className="space-y-5">
            <BudgetBar pct={metrics.budget_used_pct} cost={metrics.total_cost} budget={metrics.budget} forecastCost={metrics.forecast_cost} budgetHitsIn={metrics.budget_hits_in}/>

            {/* HITL panel — appears above everything else when there's a decision to make */}
            <HitlPanel events={hitlQueue} crewId={crewId} onDecision={handleHitl}/>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in">
              <MetricCard label="Total Cost"  value={fmt.cost(metrics.total_cost)} sub={`${metrics.budget_used_pct??0}% of budget`} icon={I.Dollar}   color="violet"/>
              <MetricCard label="API Calls"   value={metrics.total_calls??0}       sub="across all agents"                         icon={I.Activity} color="emerald"/>
              <MetricCard label="Duration"    value={fmt.dur(metrics.duration_seconds)}                        sub="elapsed"        icon={I.Clock}    color="amber"/>
              <MetricCard label="Alerts"      value={alertCount}                   sub={criticalCount>0?`${criticalCount} critical`:"all clear"} icon={I.Shield} color={criticalCount>0?"rose":"emerald"} urgent={criticalCount>0}/>
            </div>

            {/* Chart + Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-[#12121f] border border-white/6 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-slate-200">Cost & Calls Over Time</h2>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-violet-500 rounded inline-block"/> Cost</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-emerald-500 rounded inline-block"/> Calls</span>
                  </div>
                </div>
                {(metrics.cost_timeline?.length??0)<2?(
                  <div className="h-52 flex items-center justify-center text-slate-600 text-sm gap-2"><span className="w-4 h-4 border-2 border-slate-700 border-t-slate-500 rounded-full animate-spin"/>Waiting for data…</div>
                ):(
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={metrics.cost_timeline} margin={{top:4,right:4,left:-20,bottom:0}}>
                      <defs>
                        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7C3AED" stopOpacity={0.25}/><stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/></linearGradient>
                        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="time" tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis yAxisId="l" tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis yAxisId="r" orientation="right" tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      {metrics.budget&&<ReferenceLine yAxisId="l" y={metrics.budget} stroke="#ec4899" strokeDasharray="4 4" strokeOpacity={0.5} label={{value:"Budget",fill:"#ec4899",fontSize:10}}/>}
                      <Area yAxisId="l" type="monotone" dataKey="cost"  stroke="#7C3AED" fill="url(#gC)" name="Cost ($)"  strokeWidth={2} dot={false}/>
                      <Area yAxisId="r" type="monotone" dataKey="calls" stroke="#10b981" fill="url(#gA)" name="API Calls" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="bg-[#12121f] border border-white/6 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h2 className="text-sm font-semibold text-slate-200">Live Alerts</h2>
                  {alertCount>0&&<span className="text-[10px] font-bold bg-white/5 text-slate-400 rounded-full px-2 py-0.5">{alertCount}</span>}
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {alertCount===0?(
                    <div className="h-full flex flex-col items-center justify-center text-center py-8">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3"><I.Check/></div>
                      <p className="text-sm text-slate-500">No alerts</p>
                      <p className="text-xs text-slate-600 mt-1">Everything looks normal</p>
                    </div>
                  ):[...metrics.alerts].reverse().slice(0,20).map((a,i)=><AlertItem key={i} alert={a} i={i}/>)}
                </div>
              </div>
            </div>

            <LiveLog logs={logs}/>

            <div>
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Agents — {metrics.agents?.length??0} active</h2>
              {(!metrics.agents||metrics.agents.length===0)?(
                <div className="bg-[#12121f] border border-white/6 rounded-2xl p-8 text-center text-slate-500 text-sm">Waiting for agents to initialize…</div>
              ):(
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {metrics.agents.map(a=><AgentCard key={a.agent_id} agent={a} crewId={crewId} onPause={handlePause} onResume={handleResume}/>)}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/4 py-5 mt-8">
        <p className="text-center text-xs text-slate-700">Agent Cost Monitor v2.0 · Mohamed Bouhasfour · TDIA, ENSA Al Hoceima</p>
      </footer>
    </div>
  );
}
