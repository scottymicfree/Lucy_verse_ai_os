import React, { useEffect, useState } from 'react';
import { Activity, Shield, Terminal, Brain, HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';

export function RecoveryConsoleApp() {
  const [bootStatus, setBootStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/boot_status')
      .then(res => res.json())
      .then(data => { setBootStatus(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="h-full bg-black text-green-500 font-mono p-6 flex flex-col">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Terminal /> RECOVERY CONSOLE</h1>
      <div className="flex-1 overflow-y-auto">
        {loading ? <p>Loading boot status...</p> : 
         bootStatus.length === 0 ? <p className="text-green-300">No boot failures found.</p> :
         bootStatus.map((incident, i) => (
           <div key={i} className="mb-4 border border-red-500 p-4">
             <div className="text-red-500 font-bold">FATAL: {incident.component} [{incident.timestamp}]</div>
             <ul className="list-disc ml-5 mt-2 text-red-400">
               {incident.errors?.map((err: string, j: number) => <li key={j}>{err}</li>)}
             </ul>
           </div>
         ))}
      </div>
      <div className="mt-4 flex gap-4">
         <button className="px-4 py-2 bg-green-900/50 border border-green-500 hover:bg-green-800 transition-colors">SAFE BOOT</button>
         <button className="px-4 py-2 bg-red-900/50 border border-red-500 text-red-500 hover:bg-red-800 transition-colors">REBOOT SYSTEM</button>
      </div>
    </div>
  );
}

export function DiagnosticsDashboardApp() {
  const [metrics, setMetrics] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    fetch('/diagnostics').then(res => res.json()).then(setMetrics);
    fetch('/incidents').then(res => res.json()).then(setIncidents);
  }, []);

  return (
    <div className="h-full bg-slate-900 text-slate-200 p-6 font-sans flex flex-col">
       <h1 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400"><Activity /> Diagnostics Cortex</h1>
       <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-black/50 p-4 rounded border border-white/10">
             <div className="text-sm text-slate-400 uppercase">CPU Usage</div>
             <div className="text-2xl mt-1">{metrics?.cpu_percent ?? 0}%</div>
          </div>
          <div className="bg-black/50 p-4 rounded border border-white/10">
             <div className="text-sm text-slate-400 uppercase">Memory Used</div>
             <div className="text-2xl mt-1">{metrics ? (metrics.mem_used / 1024 / 1024 / 1024).toFixed(2) : 0} GB</div>
          </div>
          <div className="bg-black/50 p-4 rounded border border-white/10">
             <div className="text-sm text-slate-400 uppercase">Hardware Status</div>
             <div className={`text-2xl mt-1 ${metrics?.ok ? 'text-emerald-400' : 'text-red-400'}`}>{metrics?.ok ? 'OPTIMAL' : 'DEGRADED'}</div>
          </div>
       </div>
       <div className="flex-1 overflow-y-auto bg-black/30 p-4 rounded border border-white/10">
          <h2 className="text-sm uppercase font-bold text-slate-500 mb-4">Recent Incident Memory</h2>
          {incidents.length === 0 ? <p className="text-slate-500">No incidents recorded.</p> :
           incidents.map((inc, i) => (
             <div key={i} className="mb-2 p-3 bg-white/5 rounded flex justify-between items-center">
               <div>
                 <span className="text-rose-400 font-bold text-sm">[{inc.component}]</span>
                 <span className="ml-3 text-sm text-slate-300">{inc.details}</span>
               </div>
               <span className="text-xs text-slate-500 font-mono">{inc.timestamp}</span>
             </div>
           ))
          }
       </div>
    </div>
  );
}

export function ThreatPanelApp() {
  const [security, setSecurity] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetch('/security').then(res => res.json()).then(setSecurity);
    fetch('/event').then(res => res.json()).then(setEvents);
  }, []);

  return (
    <div className="h-full bg-slate-950 text-slate-200 p-6 font-sans flex flex-col">
       <h1 className="text-xl font-bold mb-6 flex items-center gap-2 text-rose-400"><Shield /> Threat Intelligence Panel</h1>
       <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
         <div className="flex flex-col bg-black/40 rounded-xl border border-rose-500/20 overflow-hidden">
           <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 font-bold text-rose-300 text-sm">Threat Memory Log</div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {security.length === 0 ? <p className="text-slate-500">No threats detected.</p> :
              security.map((sec, i) => (
                <div key={i} className="p-3 border border-rose-500/30 bg-rose-500/5 rounded">
                  <div className="flex justify-between items-center">
                     <span className="font-bold text-rose-400">{sec.event_type}</span>
                     <span className="text-xs text-slate-500">{sec.timestamp}</span>
                  </div>
                  <div className="text-sm mt-1 text-slate-300">Risk Score: {sec.risk_score} | Action: {sec.action_taken}</div>
                  <div className="text-xs font-mono mt-2 text-slate-500 bg-black/50 p-2 rounded">{sec.payload}</div>
                </div>
              ))}
           </div>
         </div>
         <div className="flex flex-col bg-black/40 rounded-xl border border-indigo-500/20 overflow-hidden">
           <div className="p-3 bg-indigo-500/10 border-b border-indigo-500/20 font-bold text-indigo-300 text-sm">Raw Event Bus (Aegis)</div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {events.length === 0 ? <p className="text-slate-500">No events recorded.</p> :
              events.map((ev, i) => (
                <div key={i} className="p-2 border-l-2 border-indigo-500 bg-white/5 text-xs text-slate-300">
                  <span className="text-indigo-400 font-bold">[{ev.type}]</span> {ev.sourceId} - {ev.timestamp}
                </div>
             ))}
           </div>
         </div>
       </div>
    </div>
  );
}

export function MemoryInspectorApp() {
  const [persona, setPersona] = useState("");

  useEffect(() => {
    fetch('/persona').then(res => res.text()).then(setPersona);
  }, []);

  return (
    <div className="h-full bg-slate-900 text-slate-200 p-6 font-sans flex flex-col">
       <h1 className="text-xl font-bold mb-6 flex items-center gap-2 text-purple-400"><Brain /> Memory Inspector</h1>
       <div className="flex-1 overflow-y-auto bg-black/40 p-6 rounded-xl border border-white/10 shadow-inner">
         <h2 className="text-sm uppercase font-bold text-slate-400 mb-4">Core Persona Block</h2>
         {!persona || persona === "Persona block not found." ? <p className="text-slate-500">No persona data available.</p> :
         <pre className="text-sm font-mono text-emerald-300 whitespace-pre-wrap">{persona}</pre>}
       </div>
    </div>
  );
}

export function BootViewerApp() {
  const [bootStatus, setBootStatus] = useState<any[]>([]);

  useEffect(() => {
    fetch('/boot_status').then(res => res.json()).then(setBootStatus);
  }, []);

  const hasFailures = bootStatus.length > 0;

  return (
    <div className="h-full bg-slate-950 text-slate-200 p-8 font-sans flex flex-col items-center justify-center relative">
       <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
       <HardDrive size={64} className={`mb-6 ${hasFailures ? 'text-rose-500' : 'text-indigo-400'}`} />
       <h1 className="text-3xl font-light tracking-widest mb-2">CHAIN OF TRUST</h1>
       <div className={`px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider mb-8 ${hasFailures ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
         {hasFailures ? 'Validation Failed' : 'Attestation Verified'}
       </div>
       
       <div className="w-full max-w-md space-y-4">
         <div className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-black/50">
            {hasFailures ? <AlertTriangle className="text-rose-500" /> : <CheckCircle className="text-emerald-500" />}
            <div>
              <div className="font-bold text-slate-200">Hardware & Thermal Probe</div>
              <div className="text-xs text-slate-500">Sentinel checks {hasFailures ? 'failed' : 'passed'}</div>
            </div>
         </div>
         <div className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-black/50">
            {hasFailures ? <AlertTriangle className="text-rose-500" /> : <CheckCircle className="text-emerald-500" />}
            <div>
              <div className="font-bold text-slate-200">Cryptographic Attestation</div>
              <div className="text-xs text-slate-500">Hashes {hasFailures ? 'invalid' : 'verified'}</div>
            </div>
         </div>
       </div>
    </div>
  );
}
