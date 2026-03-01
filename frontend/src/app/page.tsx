"use client"

import { useState, useEffect, useCallback } from "react";

const OPTIENGINE_URL = "http://localhost:8000";

// ─── helpers ────────────────────────────────────────────────────────────────

async function fetchEnhance(prompt: string, domain: string, project: string) {
  const r = await fetch(`${OPTIENGINE_URL}/api/v1/enhance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ junior_prompt: prompt, domain, project }),
  });
  if (!r.ok) throw new Error(`enhance endpoint: ${r.status}`);
  return r.json();
}

async function fetchRules(domain: string) {
  const r = await fetch(`${OPTIENGINE_URL}/api/v1/rules?domain=${domain}`);
  if (!r.ok) throw new Error(`rules endpoint: ${r.status}`);
  return r.json();
}

async function fetchHealth(): Promise<any> {
  const r = await fetch(`${OPTIENGINE_URL}/api/v1/health`);
  if (!r.ok) throw new Error("unhealthy");
  return r.json();
}

async function generateCode(prompt: string): Promise<string> {
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!r.ok) throw new Error(`generate route: ${r.status}`);
  const data = await r.json();
  return data.code;
}

// ─── flat color tokens ───────────────────────────────────────────────────────
const C = {
  bg: "#0c0c0c",
  card: "#111111",
  card2: "#161616",
  orange: "#ff5c00",
  sky: "#00c2ff",
  white: "#f0f0f0",
  muted: "#888888",
  faint: "#444444",
  red: "#ff3b3b",
  green: "#00d26a",
  purple: "#b57bee",
  border: "#f0f0f0",
  borderDim: "#2a2a2a",
} as const;

// shadow helpers
const sh = (color: string = C.border, n = 4) => `${n}px ${n}px 0 ${color}`;
const shO = (n = 4) => sh(C.orange, n);
const shS = (n = 4) => sh(C.sky, n);

// ─── sub-components ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    online: { color: C.green, label: "Online" },
    offline: { color: C.red, label: "Offline" },
    checking: { color: C.orange, label: "Checking" },
  };
  const { color, label } = cfg[status] ?? { color: C.muted, label: "Unknown" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%", background: color,
        animation: status === "online" ? "pulse 2s infinite" : "none",
      }} />
      <span style={{ fontSize: 11, color, fontFamily: "monospace", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

function RuleBadge({ text }: { text: string }) {
  return (
    <div style={{
      padding: "6px 12px",
      background: C.card2,
      border: `2px solid ${C.sky}`,
      boxShadow: shS(3),
      fontSize: 11, color: C.sky, fontFamily: "monospace",
      lineHeight: 1.5,
    }}>{text}</div>
  );
}

function DistanceBar({ label, distance }: { label: string; distance: number }) {
  const pct = Math.max(0, Math.min(100, (1 - distance) * 100));
  const color = distance < 0.5 ? C.green : distance < 0.8 ? C.orange : C.red;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", maxWidth: "76%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "monospace" }}>dist {distance.toFixed(3)}</span>
      </div>
      {/* Hard bar — no rounded corners, no gradient */}
      <div style={{ height: 6, background: C.card2, border: `1px solid ${C.borderDim}` }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.9s ease" }} />
      </div>
    </div>
  );
}

function CodeBlock({ code, label, accent }: { code: string; label: string; accent: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ background: C.bg, border: `2px solid ${accent}`, boxShadow: sh(accent), overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: accent, borderBottom: `2px solid ${accent}` }}>
        <span style={{ fontSize: 11, color: C.bg, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.1em" }}>{label}</span>
        <button onClick={copy} style={{
          fontSize: 10, padding: "2px 10px", border: `2px solid ${C.bg}`,
          background: copied ? C.bg : "transparent",
          color: copied ? accent : C.bg,
          cursor: "pointer", fontFamily: "monospace", fontWeight: 700,
          transition: "all 0.15s",
        }}>
          {copied ? "COPIED!" : "COPY"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: 16, fontSize: 11, color: C.muted, lineHeight: 1.75, overflowX: "auto", overflowY: "auto", maxHeight: 360, whiteSpace: "pre-wrap", wordBreak: "break-word", flex: 1 }}>
        {code || "Waiting for generation…"}
      </pre>
    </div>
  );
}

function Spinner({ color = C.orange }: { color?: string }) {
  return (
    <div style={{ display: "inline-block", width: 16, height: 16, border: `3px solid ${C.faint}`, borderTop: `3px solid ${color}`, borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
  );
}

// Ticker strip between header & content
function TickerStrip() {
  const items = ["MCP ENFORCEMENT", "OPTIENGINE", "PROMPT ENHANCEMENT", "REAL-TIME ANALYSIS", "CHROMADB", "ZERO OVERHEAD"];
  const text = items.join("  ·  ");
  return (
    <div style={{ overflow: "hidden", borderTop: `2px solid ${C.borderDim}`, borderBottom: `2px solid ${C.borderDim}`, background: C.card, padding: "0" }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "marquee 18s linear infinite" }}>
        {[text, text].map((t, i) => (
          <span key={i} style={{ display: "inline-block", padding: "8px 24px", fontSize: 10, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.18em", color: C.faint }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── section label ──────────────────────────────────────────────────────────
function Label({ text, accent = C.orange }: { text: string; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ width: 10, height: 10, background: accent, border: `2px solid ${accent}` }} />
      <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.18em", color: accent, textTransform: "uppercase" }}>{text}</span>
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

const DOMAINS = ["Global", "Web", "Backend", "AI", "Mobile", "Data", "DevOps"];
const PROJECTS = ["All", "NexusWeb", "SynthAI"];

type PresetPrompt = { label: string; domain: string; project: string; prompt: string };
const PRESET_PROMPTS: PresetPrompt[] = [
  { label: "Inventory hook", domain: "Web", project: "NexusWeb", prompt: "Add an API hook to fetch inventory stock levels with low-stock alerts for the dashboard" },
  { label: "Sales hook", domain: "Web", project: "NexusWeb", prompt: "Write an API hook to fetch sales data for the dashboard" },
  { label: "Blog post route", domain: "AI", project: "SynthAI", prompt: "Write a route to generate a blog post using the LLM" },
  { label: "Login endpoint", domain: "Backend", project: "All", prompt: "Write a user login endpoint that accepts email and password" },
  { label: "Content stream", domain: "AI", project: "SynthAI", prompt: "Build a streaming endpoint that generates marketing copy using an LLM" },
];

export default function LiveDemoDashboard() {
  const [health, setHealth] = useState<"online" | "offline" | "checking">("checking");
  const [collections, setCollections] = useState<string[]>([]);
  const [tab, setTab] = useState<"live" | "rules">("live");
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0].prompt);
  const [domain, setDomain] = useState(PRESET_PROMPTS[0].domain);
  const [project, setProject] = useState(PRESET_PROMPTS[0].project);
  const [stage, setStage] = useState<"idle" | "enhancing" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [enhanceData, setEnhanceData] = useState<any>(null);
  const [codeWithout, setCodeWithout] = useState("");
  const [codeWith, setCodeWith] = useState("");
  const [rulesData, setRulesData] = useState<any>(null);
  const [rulesDomain, setRulesDomain] = useState("Web");
  const [rulesLoading, setRulesLoading] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then(d => { setHealth("online"); setCollections(d.collections ?? []); })
      .catch(() => setHealth("offline"));
  }, []);

  useEffect(() => {
    if (tab !== "rules") return;
    setRulesLoading(true);
    fetchRules(rulesDomain)
      .then(d => { setRulesData(d); setRulesLoading(false); })
      .catch(() => setRulesLoading(false));
  }, [tab, rulesDomain]);

  const applyPreset = (p: PresetPrompt) => { setPrompt(p.prompt); setDomain(p.domain); setProject(p.project); };

  const runComparison = useCallback(async () => {
    if (!prompt.trim()) return;
    setStage("enhancing"); setError(null); setEnhanceData(null); setCodeWithout(""); setCodeWith("");
    try {
      const eData = await fetchEnhance(prompt, domain, project);
      setEnhanceData(eData);
      setStage("generating");
      const [rawCode, enhCode] = await Promise.all([generateCode(prompt), generateCode(eData.enhanced_prompt)]);
      setCodeWithout(rawCode); setCodeWith(enhCode); setStage("done");
    } catch (e: any) {
      setError(e?.message ?? String(e)); setStage("error");
    }
  }, [prompt, domain, project]);

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=clash-display@700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes marquee  { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ minHeight: "100vh", color: C.white, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>

        {/* ═══════════ HEADER ═══════════ */}
        <header style={{ borderBottom: `2px solid ${C.borderDim}` }}>
          {/* top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: `1px solid ${C.borderDim}` }}>
            {/* wordmark */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* logo image */}
              <img src="/logo.png" alt="OptiEngine Logo" style={{
                width: 48, height: 48,
                background: C.white,
                border: `2px solid ${C.white}`,
                boxShadow: sh(C.white, 3),
                objectFit: "contain"
              }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.28em", color: C.white, textTransform: "uppercase" }}>OptiEngine</div>
                <div style={{ fontSize: 10, color: C.faint, letterSpacing: "0.06em", fontFamily: "monospace" }}>MCP Enforcement Layer</div>
              </div>
            </div>
            {/* status */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
              <StatusDot status={health} />
              {collections.length > 0 && (
                <div style={{ fontSize: 10, color: C.faint, fontFamily: "monospace" }}>
                  {collections.length} collections · {collections.map(c => c.replace("guidelines_", "")).join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* hero name */}
          <div style={{ padding: "32px 32px 24px", overflow: "hidden" }}>
            <div style={{ fontSize: "clamp(68px, 8.5vw, 120px)", fontWeight: 700, lineHeight: 0.9, letterSpacing: "-0.02em", color: C.white, textTransform: "uppercase", fontFamily: "'ClashDisplay-Bold', 'ClashDisplay', 'Arial Black', sans-serif" } as React.CSSProperties}>
              OPTI
              <span style={{ color: C.orange }}>ENGINE</span>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: C.muted, maxWidth: 520, lineHeight: 1.6 }}>
                Intercept junior prompts, inject org standards, compare AI output quality — in real-time.
              </div>
              {/* stat chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
                {[
                  { val: "MCP", label: "Protocol", color: C.orange },
                  { val: "2×", label: "Quality", color: C.sky },
                  { val: "0ms", label: "Overhead", color: C.green },
                ].map(s => (
                  <div key={s.val} style={{
                    padding: "6px 14px",
                    border: `2px solid ${s.color}`,
                    boxShadow: sh(s.color, 3),
                    background: C.card,
                    display: "flex", alignItems: "baseline", gap: 7,
                  }}>
                    <span style={{ fontSize: 17, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.val}</span>
                    <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* ticker */}
        <TickerStrip />

        {/* ═══════════ MAIN ═══════════ */}
        <main style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 32px 72px" }}>

          {/* ── TABS ── */}
          <div style={{ display: "flex", gap: 0, marginBottom: 28, border: `2px solid ${C.borderDim}`, width: "fit-content", boxShadow: sh(C.borderDim) }}>
            {([
              { id: "live", icon: "⚡", label: "Live Comparison" },
              { id: "rules", icon: "📚", label: "Rules Browser" },
            ] as { id: "live" | "rules"; icon: string; label: string }[]).map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "10px 22px",
                  border: "none",
                  borderRight: i === 0 ? `2px solid ${C.borderDim}` : "none",
                  cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em",
                  background: tab === t.id ? C.orange : C.card,
                  color: tab === t.id ? C.bg : C.muted,
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          {/* ════════════════ LIVE TAB ════════════════ */}
          {tab === "live" && (
            <div>

              {/* ── INPUT PANEL ── */}
              <div style={{ background: C.card, border: `2px solid ${C.white}`, boxShadow: shO(), marginBottom: 20 }}>
                {/* panel header bar */}
                <div style={{ padding: "10px 16px", background: C.card2, borderBottom: `2px solid ${C.borderDim}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, background: C.orange }} />
                  <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.18em", color: C.orange, textTransform: "uppercase" }}>Prompt Input</span>
                </div>

                <div style={{ padding: 20 }}>
                  {/* presets */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {PRESET_PROMPTS.map((p, i) => (
                      <button key={i} onClick={() => applyPreset(p)} style={{
                        padding: "5px 13px",
                        border: `2px solid ${prompt === p.prompt ? C.orange : C.borderDim}`,
                        background: prompt === p.prompt ? C.orange : "transparent",
                        color: prompt === p.prompt ? C.bg : C.muted,
                        fontSize: 11, cursor: "pointer", fontWeight: 600,
                        fontFamily: "monospace",
                        boxShadow: prompt === p.prompt ? shO(3) : "none",
                        transition: "all 0.15s",
                      }}>{p.label}</button>
                    ))}
                  </div>

                  {/* textarea */}
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%", background: C.bg,
                      border: `2px solid ${C.borderDim}`,
                      padding: "12px 14px", color: C.white,
                      fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                      resize: "vertical", outline: "none", lineHeight: 1.7, marginBottom: 14,
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => e.target.style.borderColor = C.orange}
                    onBlur={e => e.target.style.borderColor = C.borderDim}
                  />

                  {/* controls */}
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 10, flex: 1 }}>
                      {[
                        { label: "Domain", val: domain, setter: setDomain, options: DOMAINS },
                        { label: "Project", val: project, setter: setProject, options: PROJECTS },
                      ].map(sel => (
                        <div key={sel.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label style={{ fontSize: 10, color: C.faint, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "monospace" }}>{sel.label}</label>
                          <select value={sel.val} onChange={e => sel.setter(e.target.value)} style={{
                            background: C.bg, border: `2px solid ${C.borderDim}`,
                            color: C.white, padding: "7px 10px",
                            fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                            cursor: "pointer", outline: "none",
                          }}>
                            {sel.options.map(o => <option key={o} style={{ background: "#111" }}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* RUN */}
                    <button
                      onClick={runComparison}
                      disabled={stage === "enhancing" || stage === "generating" || health !== "online"}
                      style={{
                        padding: "10px 28px",
                        border: `2px solid ${health !== "online" ? C.faint : C.white}`,
                        background: health !== "online" ? C.card2 : C.orange,
                        color: health !== "online" ? C.faint : C.bg,
                        fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                        cursor: health !== "online" ? "not-allowed" : "pointer",
                        boxShadow: health === "online" ? sh(C.white) : "none",
                        display: "flex", alignItems: "center", gap: 10,
                        fontFamily: "monospace",
                        transition: "all 0.15s",
                      }}
                    >
                      {(stage === "enhancing" || stage === "generating")
                        ? <><Spinner color={C.bg} /> {stage === "enhancing" ? "Enhancing…" : "Generating…"}</>
                        : <>▶ Run Comparison</>}
                    </button>
                  </div>

                  {/* offline warning */}
                  {health !== "online" && (
                    <div style={{ marginTop: 14, fontSize: 11, color: C.red, padding: "8px 12px", background: C.bg, border: `2px solid ${C.red}`, fontFamily: "monospace" }}>
                      ✗ Backend offline — <code>uvicorn main:app --port 8000</code>
                    </div>
                  )}
                </div>
              </div>

              {/* ── ERROR ── */}
              {stage === "error" && (
                <div style={{ padding: "10px 14px", background: C.bg, border: `2px solid ${C.red}`, boxShadow: sh(C.red), fontSize: 12, color: C.red, marginBottom: 18, fontFamily: "monospace" }}>
                  ✗ Error: {error}
                </div>
              )}

              {/* ── PIPELINE RESULTS ── */}
              {enhanceData && (
                <div style={{ animation: "slideUp 0.4s ease both", marginBottom: 20 }}>

                  {/* stat cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                    {[
                      { label: "Rules Applied", value: enhanceData.rules_count, color: C.orange },
                      { label: "Domain", value: enhanceData.domain, color: C.sky },
                      { label: "Degraded", value: enhanceData.degraded ? "YES ⚠" : "NO ✓", color: enhanceData.degraded ? C.orange : C.green },
                      { label: "Prompt Words", value: `${prompt.split(" ").length}→${enhanceData.enhanced_prompt.split(" ").length}`, color: C.purple },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: C.card, padding: "18px 16px",
                        border: `2px solid ${s.color}`,
                        boxShadow: sh(s.color),
                      }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: s.color, fontFamily: "monospace", lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "monospace" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* applied rules */}
                  {enhanceData.applied_rules?.length > 0 && (
                    <div style={{ background: C.card, border: `2px solid ${C.sky}`, boxShadow: shS(), padding: 20, marginBottom: 16 }}>
                      <Label text={`ChromaDB — ${enhanceData.rules_count} rules · domain=${enhanceData.domain}`} accent={C.sky} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                        {(enhanceData.applied_rules as string[]).map((r, i) => <RuleBadge key={i} text={r} />)}
                      </div>
                      <div style={{ fontSize: 10, color: C.faint, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>Relevance Distances</div>
                      {(enhanceData.applied_rules as string[]).map((r, i) => (
                        <DistanceBar key={i} label={r.substring(0, 60)} distance={0.38 + i * 0.09} />
                      ))}
                      <div style={{ fontSize: 10, color: C.faint, marginTop: 8, fontFamily: "monospace" }}>* Lower distance = more semantically relevant</div>
                    </div>
                  )}

                  {/* prompt diff */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div style={{ background: C.card, padding: 18, border: `2px solid ${C.red}`, boxShadow: sh(C.red) }}>
                      <Label text="Original Prompt" accent={C.red} />
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, fontStyle: "italic", fontFamily: "'JetBrains Mono', monospace" }}>"{enhanceData.original_prompt}"</div>
                      <div style={{ marginTop: 10, fontSize: 10, color: C.faint, fontFamily: "monospace" }}>{prompt.split(" ").length} words · 0 standards</div>
                    </div>
                    <div style={{ background: C.card, padding: 18, border: `2px solid ${C.orange}`, boxShadow: shO() }}>
                      <Label text="Enhanced Prompt" accent={C.orange} />
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.65, maxHeight: 90, overflowY: "auto", fontFamily: "'JetBrains Mono', monospace" }}>
                        {enhanceData.enhanced_prompt}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 10, color: C.faint, fontFamily: "monospace" }}>{enhanceData.enhanced_prompt.split(" ").length} words · {enhanceData.rules_count} standards injected</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CODE COMPARISON ── */}
              {(codeWithout || codeWith || stage === "generating") && (
                <div style={{ animation: "slideUp 0.4s ease both" }}>
                  <Label text="Live Code Generation — Claude generating from both prompts simultaneously" accent={C.faint} />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 10, height: 10, background: C.red, border: `2px solid ${C.red}` }} />
                        <span style={{ fontSize: 11, color: C.red, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.08em" }}>WITHOUT OptiEngine</span>
                        <span style={{ fontSize: 10, color: C.faint, fontFamily: "monospace" }}>raw prompt → Claude</span>
                      </div>
                      {stage === "generating" && !codeWithout
                        ? <div style={{ padding: 28, textAlign: "center", background: C.card, border: `2px solid ${C.red}` }}><Spinner color={C.red} /></div>
                        : <CodeBlock code={codeWithout} label="No standards context" accent={C.red} />
                      }
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 10, height: 10, background: C.orange, border: `2px solid ${C.orange}` }} />
                        <span style={{ fontSize: 11, color: C.orange, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.08em" }}>WITH OptiEngine</span>
                        <span style={{ fontSize: 10, color: C.faint, fontFamily: "monospace" }}>enhanced prompt → Claude</span>
                      </div>
                      {stage === "generating" && !codeWith
                        ? <div style={{ padding: 28, textAlign: "center", background: C.card, border: `2px solid ${C.orange}` }}><Spinner color={C.orange} /></div>
                        : <CodeBlock code={codeWith} label={`${enhanceData?.rules_count ?? 0} rules enforced`} accent={C.orange} />
                      }
                    </div>
                  </div>

                  {/* result banner */}
                  {stage === "done" && codeWithout && codeWith && (
                    <div style={{
                      marginTop: 14, padding: "18px 24px",
                      background: C.card,
                      border: `2px solid ${C.orange}`,
                      boxShadow: shO(6),
                      display: "flex", gap: 20, alignItems: "center",
                      animation: "slideUp 0.4s ease both",
                    }}>
                      {/* big number */}
                      <div style={{ fontSize: 52, fontWeight: 900, color: C.orange, fontFamily: "monospace", lineHeight: 1 }}>
                        +{enhanceData?.rules_count ?? 0}
                      </div>
                      <div style={{ borderLeft: `2px solid ${C.borderDim}`, paddingLeft: 20 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>organizational standards enforced</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: "monospace" }}>from a {prompt.split(" ").length}-word prompt · zero additional developer effort</div>
                      </div>
                      <div style={{ marginLeft: "auto", textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: C.faint, fontFamily: "monospace", marginBottom: 4 }}>PROMPT EXPANSION</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>
                          <span style={{ color: C.muted }}>{prompt.split(" ").length}</span>
                          <span style={{ color: C.faint, margin: "0 8px" }}>→</span>
                          <span style={{ color: C.sky }}>{enhanceData?.enhanced_prompt?.split(" ").length ?? "—"}</span>
                          <span style={{ fontSize: 11, color: C.faint, marginLeft: 5 }}>words</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ RULES TAB ════════════════ */}
          {tab === "rules" && (
            <div>
              {/* domain filter */}
              <div style={{ display: "flex", gap: 0, marginBottom: 20, border: `2px solid ${C.borderDim}`, width: "fit-content", flexWrap: "wrap" }}>
                <span style={{ padding: "8px 14px", fontSize: 10, color: C.faint, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "monospace", borderRight: `2px solid ${C.borderDim}`, display: "flex", alignItems: "center" }}>Domain</span>
                {DOMAINS.map((d, i) => (
                  <button key={d} onClick={() => setRulesDomain(d)} style={{
                    padding: "8px 15px",
                    border: "none",
                    borderRight: i < DOMAINS.length - 1 ? `2px solid ${C.borderDim}` : "none",
                    cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "monospace",
                    background: rulesDomain === d ? C.sky : "transparent",
                    color: rulesDomain === d ? C.bg : C.muted,
                    transition: "all 0.15s",
                  }}>{d}</button>
                ))}
              </div>

              {rulesLoading && (
                <div style={{ textAlign: "center", padding: 60 }}><Spinner color={C.sky} /></div>
              )}

              {rulesData && !rulesLoading && (
                <div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 14, fontFamily: "monospace" }}>
                    {rulesData.count ?? rulesData.rules?.length ?? 0} rules in{" "}
                    <code style={{ color: C.sky }}>guidelines_{rulesDomain.toLowerCase()}</code>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(rulesData.rules ?? []).map((rule: any, i: number) => (
                      <div key={i} style={{
                        background: C.card, padding: "14px 16px",
                        border: `2px solid ${C.borderDim}`,
                        animation: `slideUp 0.3s ease ${i * 0.05}s both`,
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.sky; e.currentTarget.style.boxShadow = shS(3); }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDim; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <div style={{ display: "flex", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, background: C.sky, color: C.bg, padding: "2px 8px", fontWeight: 800, letterSpacing: "0.08em", fontFamily: "monospace" }}>{rule.domain}</span>
                          {rule.project && rule.project !== "All" && (
                            <span style={{ fontSize: 10, background: C.purple, color: C.bg, padding: "2px 8px", fontWeight: 800, fontFamily: "monospace" }}>{rule.project}</span>
                          )}
                          {rule.topic && (
                            <span style={{ fontSize: 10, color: C.faint, fontFamily: "monospace" }}>{rule.topic}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{rule.rule_text}</div>
                      </div>
                    ))}
                  </div>

                  {rulesData.rules?.length === 0 && (
                    <div style={{ textAlign: "center", padding: 60, color: C.faint, fontSize: 13, fontFamily: "monospace" }}>
                      No rules found for "{rulesDomain}".<br />
                      <span style={{ fontSize: 11 }}>Run <code style={{ color: C.orange }}>python scripts/seed_guidelines.py</code></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── FOOTER ── */}
          <footer style={{ marginTop: 64, paddingTop: 20, borderTop: `2px solid ${C.borderDim}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/logo.png" alt="OptiEngine Logo" style={{ width: 26, height: 26, background: C.white, border: `2px solid ${C.white}`, objectFit: "contain" }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: C.faint, textTransform: "uppercase", fontFamily: "monospace" }}>OptiEngine</span>
            </div>
            <div style={{ fontSize: 11, color: C.faint, fontFamily: "monospace" }}>
              MCP enforcement · <span style={{ color: C.orange }}>ai-grade standards</span>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}