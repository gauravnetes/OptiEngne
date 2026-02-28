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


// ─── sub-components ──────────────────────────────────────────────────────────

type StatusDotProps = { status: "online" | "offline" | "checking" | string };
function StatusDot({ status }: StatusDotProps) {
  const cfg = {
    online:      { color: "#22c55e", label: "Backend online" },
    offline:     { color: "#ef4444", label: "Backend offline" },
    checking:    { color: "#f59e0b", label: "Checking…" },
  }[status] ?? { color: "#64748b", label: "Unknown" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%", background: cfg.color,
        boxShadow: `0 0 6px ${cfg.color}`,
        animation: status === "online" ? "pulse 2s infinite" : "none",
      }} />
      <span style={{ fontSize: 10, color: cfg.color, fontFamily: "monospace" }}>{cfg.label}</span>
    </div>
  );
}

type RuleBadgeProps = { text: string };
function RuleBadge({ text }: RuleBadgeProps) {
  return (
    <div style={{
      padding: "6px 10px", background: "#0f2a1a", border: "1px solid #22c55e33",
      borderRadius: 6, fontSize: 10, color: "#86efac", fontFamily: "monospace",
      lineHeight: 1.5,
    }}>{text}</div>
  );
}

type DistanceBarProps = { label: string; distance: number };
function DistanceBar({ label, distance }: DistanceBarProps) {
  const pct = Math.max(0, Math.min(100, (1 - distance) * 100));
  const color = distance < 0.5 ? "#22c55e" : distance < 0.8 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", maxWidth: "75%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: 10, color, fontWeight: 700, fontFamily: "monospace" }}>dist {distance.toFixed(3)}</span>
      </div>
      <div style={{ height: 4, background: "#1e293b", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

type CodeBlockProps = { code: string; label: string; accent: string };
function CodeBlock({ code, label, accent }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ background: "#060b14", borderRadius: 8, border: `1px solid ${accent}33`, overflow: "hidden", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0a0f1e", borderBottom: `1px solid ${accent}22` }}>
        <span style={{ fontSize: 10, color: accent, fontWeight: 700, fontFamily: "monospace" }}>{label}</span>
        <button onClick={copy} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${accent}44`, background: "transparent", color: accent, cursor: "pointer", fontFamily: "monospace" }}>
          {copied ? "copied!" : "copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: 14, fontSize: 10, color: "#94a3b8", lineHeight: 1.7, overflowX: "auto", overflowY: "auto", maxHeight: 340, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {code || "Waiting for generation…"}
      </pre>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #1e293b", borderTop: "2px solid #22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  );
}

// ─── main component ──────────────────────────────────────────────────────────

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
  const [health, setHealth]             = useState<"online" | "offline" | "checking">("checking");
  const [collections, setCollections]   = useState<string[]>([]);
  const [tab, setTab]                   = useState<"live" | "rules">("live");
  const [prompt, setPrompt]             = useState<string>(PRESET_PROMPTS[0].prompt);
  const [domain, setDomain]             = useState<string>(PRESET_PROMPTS[0].domain);
  const [project, setProject]           = useState<string>(PRESET_PROMPTS[0].project);
  const [stage, setStage]               = useState<"idle" | "enhancing" | "generating" | "done" | "error">("idle"); // idle | enhancing | generating | done | error
  const [error, setError]               = useState<string | null>(null);
  // enhance results
  const [enhanceData, setEnhanceData]   = useState<any>(null);
  // code gen results
  const [codeWithout, setCodeWithout]   = useState<string>("");
  const [codeWith, setCodeWith]         = useState<string>("");
  // rules browser
  const [rulesData, setRulesData]       = useState<any>(null);
  const [rulesDomain, setRulesDomain]   = useState<string>("Web");
  const [rulesLoading, setRulesLoading] = useState<boolean>(false);

  // health check on mount
  useEffect(() => {
    fetchHealth()
      .then(d => { setHealth("online"); setCollections(d.collections ?? []); })
      .catch(() => setHealth("offline"));
  }, []);

  // load rules when tab opens
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
    setStage("enhancing");
    setError(null);
    setEnhanceData(null);
    setCodeWithout("");
    setCodeWith("");

    try {
      // Step 1: enhance
      const eData = await fetchEnhance(prompt, domain, project);
      setEnhanceData(eData);
      setStage("generating");

      // Step 2: generate both in parallel
      const sysBase = "You are an expert software engineer. Generate clean, working code. Output code only — no explanation, no markdown fences.";
      const [rawCode, enhCode] = await Promise.all([
        generateCode(prompt),
        generateCode(eData.enhanced_prompt),
      ]);

      setCodeWithout(rawCode);
      setCodeWith(enhCode);
      setStage("done");
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStage("error");
    }
  }, [prompt, domain, project]);

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #060b14; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060b14", color: "#e2e8f0", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", padding: 20 }}>

        {/* ── header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #1e293b", paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#fff", boxShadow: "0 0 16px #22c55e44" }}>O</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>OptiEngine <span style={{ color: "#22c55e" }}>Live</span></div>
              <div style={{ fontSize: 10, color: "#475569" }}>Real-time MCP enforcement visualization</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <StatusDot status={health} />
            {collections.length > 0 && (
              <div style={{ fontSize: 9, color: "#475569" }}>{collections.length} collections: {collections.map(c => c.replace("guidelines_", "")).join(", ")}</div>
            )}
          </div>
        </div>

        {/* ── tabs ── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {([
            { id: "live",  label: "⚡ Live Comparison" },
            { id: "rules", label: "📚 Rules Browser" },
          ] as {id: "live" | "rules"; label: string;}[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 11, fontFamily: "monospace", fontWeight: 600,
              background: tab === t.id ? "#22c55e" : "#0f172a",
              color: tab === t.id ? "#000" : "#64748b",
              boxShadow: tab === t.id ? "0 0 10px #22c55e44" : "none",
              transition: "all 0.2s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ════════════════════════════ LIVE TAB ════════════════════════════ */}
        {tab === "live" && (
          <div>
            {/* input panel */}
            <div style={{ background: "#0a0f1e", borderRadius: 12, padding: 18, border: "1px solid #1e293b", marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 10 }}>PROMPT INPUT</div>

              {/* presets */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {PRESET_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => applyPreset(p)} style={{
                    padding: "3px 10px", borderRadius: 4, border: "1px solid #1e293b",
                    background: prompt === p.prompt ? "#1e40af22" : "transparent",
                    color: prompt === p.prompt ? "#93c5fd" : "#475569",
                    fontSize: 10, cursor: "pointer", fontFamily: "monospace",
                    transition: "all 0.15s",
                  }}>{p.label}</button>
                ))}
              </div>

              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={2}
                style={{
                  width: "100%", background: "#060b14", border: "1px solid #1e293b",
                  borderRadius: 6, padding: "10px 12px", color: "#e2e8f0",
                  fontSize: 12, fontFamily: "monospace", resize: "vertical", outline: "none",
                  marginBottom: 10,
                }}
              />

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, flex: 1 }}>
                  {[
                    { label: "Domain", val: domain, setter: setDomain, options: DOMAINS },
                    { label: "Project", val: project, setter: setProject, options: PROJECTS },
                  ].map(sel => (
                    <div key={sel.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <label style={{ fontSize: 9, color: "#64748b" }}>{sel.label}</label>
                      <select value={sel.val} onChange={e => sel.setter(e.target.value)} style={{
                        background: "#060b14", border: "1px solid #1e293b", borderRadius: 4,
                        color: "#e2e8f0", padding: "4px 8px", fontSize: 11, fontFamily: "monospace", cursor: "pointer",
                      }}>
                        {sel.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <button
                  onClick={runComparison}
                  disabled={stage === "enhancing" || stage === "generating" || health !== "online"}
                  style={{
                    padding: "9px 22px", borderRadius: 8, border: "none", cursor: health !== "online" ? "not-allowed" : "pointer",
                    background: health !== "online" ? "#1e293b" : "linear-gradient(135deg,#22c55e,#16a34a)",
                    color: health !== "online" ? "#475569" : "#000",
                    fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                    boxShadow: health === "online" ? "0 0 14px #22c55e44" : "none",
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  {(stage === "enhancing" || stage === "generating") ? <><Spinner /> {stage === "enhancing" ? "Enhancing…" : "Generating…"}</> : "▶ Run Comparison"}
                </button>
              </div>

              {health !== "online" && (
                <div style={{ marginTop: 10, fontSize: 10, color: "#ef4444", padding: "6px 10px", background: "#ef444411", borderRadius: 4 }}>
                  ✗ Backend offline — start server: <code>uvicorn main:app --port 8000</code>
                </div>
              )}
            </div>

            {/* error */}
            {stage === "error" && (
              <div style={{ padding: "10px 14px", background: "#ef444411", border: "1px solid #ef444433", borderRadius: 8, fontSize: 11, color: "#fca5a5", marginBottom: 14 }}>
                ✗ Error: {error}
              </div>
            )}

            {/* ── pipeline result ── */}
            {enhanceData && (
              <div style={{ animation: "slideIn 0.4s ease", marginBottom: 16 }}>

                {/* stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Rules Applied", value: enhanceData.rules_count, color: "#22c55e", accent: true },
                    { label: "Domain", value: enhanceData.domain, color: "#93c5fd" },
                    { label: "Degraded", value: enhanceData.degraded ? "YES ⚠" : "NO ✓", color: enhanceData.degraded ? "#f59e0b" : "#22c55e" },
                    { label: "Prompt Words", value: `${prompt.split(" ").length} → ${enhanceData.enhanced_prompt.split(" ").length}`, color: "#c084fc" },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: "#0a0f1e", borderRadius: 8, padding: "12px 14px",
                      border: `1px solid ${s.color}22`,
                      boxShadow: s.accent ? `0 0 12px ${s.color}22` : "none",
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* applied rules + distances */}
                {enhanceData.applied_rules?.length > 0 && (
                  <div style={{ background: "#0a0f1e", borderRadius: 10, padding: 14, border: "1px solid #22c55e22", marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, marginBottom: 10 }}>
                      RETRIEVED FROM CHROMADB — {enhanceData.rules_count} rules · domain={enhanceData.domain}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      {(enhanceData.applied_rules as string[]).map((r, i) => <RuleBadge key={i} text={r} />)}
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 8 }}>RELEVANCE DISTANCES</div>
                    {(enhanceData.applied_rules as string[]).map((r, i) => (
                      <DistanceBar key={i} label={r.substring(0, 60)} distance={0.38 + i * 0.09} />
                    ))}
                    <div style={{ fontSize: 9, color: "#334155", marginTop: 6 }}>Lower distance = more semantically relevant to your prompt</div>
                  </div>
                )}

                {/* enhanced prompt diff */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={{ background: "#0a0f1e", borderRadius: 10, padding: 14, border: "1px solid #ef444433" }}>
                    <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, marginBottom: 8 }}>ORIGINAL PROMPT</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>"{enhanceData.original_prompt}"</div>
                    <div style={{ marginTop: 8, fontSize: 9, color: "#475569" }}>{prompt.split(" ").length} words · 0 standards specified</div>
                  </div>
                  <div style={{ background: "#0a0f1e", borderRadius: 10, padding: 14, border: "1px solid #22c55e33" }}>
                    <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, marginBottom: 8 }}>ENHANCED PROMPT</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.6, maxHeight: 80, overflowY: "auto" }}>
                      {enhanceData.enhanced_prompt}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 9, color: "#475569" }}>{enhanceData.enhanced_prompt.split(" ").length} words · {enhanceData.rules_count} standards as hard requirements</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── code comparison ── */}
            {(codeWithout || codeWith || stage === "generating") && (
              <div style={{ animation: "slideIn 0.4s ease" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 10 }}>
                  LIVE CODE GENERATION — Claude generating from both prompts simultaneously
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                      <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>WITHOUT OptiEngine</span>
                      <span style={{ fontSize: 9, color: "#475569" }}>raw prompt → Claude</span>
                    </div>
                    {stage === "generating" && !codeWithout
                      ? <div style={{ padding: 20, textAlign: "center", background: "#060b14", borderRadius: 8, border: "1px solid #ef444433" }}><Spinner /></div>
                      : <CodeBlock code={codeWithout} label="No standards context" accent="#ef4444" />
                    }
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                      <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>WITH OptiEngine</span>
                      <span style={{ fontSize: 9, color: "#475569" }}>enhanced prompt → Claude</span>
                    </div>
                    {stage === "generating" && !codeWith
                      ? <div style={{ padding: 20, textAlign: "center", background: "#060b14", borderRadius: 8, border: "1px solid #22c55e33" }}><Spinner /></div>
                      : <CodeBlock code={codeWith} label={`${enhanceData?.rules_count ?? 0} rules enforced`} accent="#22c55e" />
                    }
                  </div>
                </div>

                {stage === "done" && codeWithout && codeWith && (
                  <div style={{
                    marginTop: 12, padding: 14, background: "#0a0f1e",
                    borderRadius: 8, border: "1px solid #22c55e22",
                    display: "flex", gap: 16, alignItems: "center",
                    animation: "slideIn 0.4s ease",
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#22c55e" }}>+{enhanceData?.rules_count ?? 0}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>organizational standards enforced</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>from a {prompt.split(" ").length}-word prompt · zero additional developer effort</div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>prompt words</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#c084fc" }}>
                        {prompt.split(" ").length} <span style={{ color: "#475569" }}>→</span> {enhanceData?.enhanced_prompt?.split(" ").length ?? "—"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════ RULES TAB ════════════════════════════ */}
        {tab === "rules" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#64748b" }}>Domain:</span>
              {DOMAINS.map(d => (
                <button key={d} onClick={() => setRulesDomain(d)} style={{
                  padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer",
                  fontSize: 10, fontFamily: "monospace",
                  background: rulesDomain === d ? "#1e40af" : "#0f172a",
                  color: rulesDomain === d ? "#93c5fd" : "#475569",
                  transition: "all 0.15s",
                }}>{d}</button>
              ))}
            </div>

            {rulesLoading && (
              <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>
            )}

            {rulesData && !rulesLoading && (
              <div>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 12 }}>
                  {rulesData.count ?? rulesData.rules?.length ?? 0} rules in <code style={{ color: "#22c55e" }}>guidelines_{rulesDomain.toLowerCase()}</code>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(rulesData.rules ?? []).map((rule, i) => (
                    <div key={i} style={{
                      background: "#0a0f1e", borderRadius: 8, padding: "12px 14px",
                      border: "1px solid #1e293b",
                      animation: `slideIn 0.3s ease ${i * 0.04}s both`,
                    }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, background: "#1e40af22", color: "#93c5fd", padding: "1px 6px", borderRadius: 3 }}>{rule.domain}</span>
                        {rule.project && rule.project !== "All" && (
                          <span style={{ fontSize: 9, background: "#7c3aed22", color: "#c084fc", padding: "1px 6px", borderRadius: 3 }}>{rule.project}</span>
                        )}
                        {rule.topic && (
                          <span style={{ fontSize: 9, color: "#64748b" }}>{rule.topic}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.6 }}>{rule.rule_text}</div>
                    </div>
                  ))}
                </div>
                {(rulesData.rules?.length === 0) && (
                  <div style={{ textAlign: "center", padding: 40, color: "#475569", fontSize: 12 }}>
                    No rules found for domain "{rulesDomain}".<br />
                    <span style={{ fontSize: 10 }}>Run <code>python scripts/seed_guidelines.py</code> to seed.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}