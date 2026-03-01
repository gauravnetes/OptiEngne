"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedRule {
  topic: string;
  rule_text: string;
  approved: boolean;
  ingested?: boolean;
  doc_id?: string;
  error?: string;
}

type Stage = "idle" | "extracting" | "reviewing" | "ingesting" | "done" | "error";

const DOMAINS = ["Global", "Web", "Backend", "AI", "Mobile", "Data", "DevOps"];
const OPTIENGINE_URL = process.env.NEXT_PUBLIC_OPTIENGINE_URL ?? "http://localhost:8000";

// ─── Sample ADR for demo ──────────────────────────────────────────────────────

const C = {
  bg: "#0c0c0c",
  card: "#111111",
  orange: "#ff5c00",
  sky: "#00c2ff",
  white: "#ffffff",
  light: "#e0e0e0",
  muted: "#a0a0a0",
  faint: "#666666",
  red: "#ff3b3b",
  green: "#00d26a",
  purple: "#b57bee",
  border: "#f0f0f0",
  borderDim: "#2a2a2a",
} as const;

const sh = (color: string = C.border, n = 4) => `${n}px ${n}px 0 ${color}`;

const SAMPLE_ADR = `# ADR-0014: Client-Side State Management Strategy

## Status
Accepted

## Context
Our dashboard has grown to 12+ pages with complex data fetching requirements. 
We currently use a mix of useState, useEffect, and prop drilling which has led to:
- Inconsistent loading states across components
- Cache invalidation bugs causing stale data
- Waterfall requests degrading performance
- No standardized error handling pattern

## Decision
We will adopt a two-library approach:
1. **React Query (TanStack Query v5)** for all server state
2. **Zustand** for all client-only UI state

Server state is defined as: any data that originates from an API or database.
UI state is defined as: ephemeral state that does not need to be persisted (modals, sidebar, filters).

## Rules
- React Query MUST be used for all data fetching. The useEffect + fetch pattern is forbidden.
- Every useQuery call MUST define an explicit staleTime. The default staleTime of 0 is forbidden.
- Sales summary data staleTime MUST be 5 minutes. Order list data MUST be 1 minute.
- Zustand MUST be split into feature slices. A monolithic store is forbidden.
- Server-fetched data MUST NOT be stored in Zustand.
- All mutations MUST implement optimistic updates using onMutate/onError/onSettled.
- React Query hooks MUST handle three explicit states: loading (skeleton), error (inline retry), empty (meaningful message).

## Consequences
Positive: Consistent patterns, automatic caching, background refetch, devtools support.
Negative: Bundle size increase (~13kb). Mitigation: lazy-load pages.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function extractRules(
  adrText: string,
  domain: string
): Promise<{ rules: Omit<ExtractedRule, "approved">[]; tokensUsed: number }> {
  const r = await fetch("/api/extract-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adrText, domain }),
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

async function ingestRule(
  rule: ExtractedRule,
  domain: string,
  project: string,
  ingestKey: string
): Promise<{ doc_id: string }> {
  const r = await fetch(`${OPTIENGINE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": ingestKey,
    },
    body: JSON.stringify({
      domain,
      project,
      topic: rule.topic,
      rule_text: rule.rule_text,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ size = 20, color = C.green }: { size?: number, color?: string }) {
  return (
    <div
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `3px solid ${color}22`,
        borderTop: `3px solid ${color}`,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

function RuleCard({
  rule,
  index,
  onToggle,
  onEdit,
}: {
  rule: ExtractedRule;
  index: number;
  onToggle: (i: number) => void;
  onEdit: (i: number, field: "topic" | "rule_text", val: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const statusColor = rule.ingested
    ? "#22c55e"
    : rule.error
      ? "#ef4444"
      : rule.approved
        ? "#3b82f6"
        : "#475569";

  const statusLabel = rule.ingested
    ? "✓ ingested"
    : rule.error
      ? "✗ failed"
      : rule.approved
        ? "approved"
        : "skipped";

  return (
    <div
      style={{
        background: rule.approved ? C.card : C.bg,
        border: `2px solid ${rule.approved ? C.borderDim : C.borderDim}`,
        boxShadow: rule.approved ? sh(C.borderDim, 3) : "none",
        padding: "16px 20px",
        opacity: rule.approved ? 1 : 0.4,
        transition: "all 0.15s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 8,
        }}
      >
        {/* Checkbox + topic */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <input
            type="checkbox"
            checked={rule.approved}
            onChange={() => onToggle(index)}
            disabled={!!rule.ingested}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#22c55e" }}
          />
          {editing ? (
            <input
              value={rule.topic}
              onChange={(e) => onEdit(index, "topic", e.target.value)}
              style={{
                flex: 1,
                background: "#060b14",
                border: "1px solid #3b82f6",
                borderRadius: 4,
                padding: "3px 8px",
                color: "#e2e8f0",
                fontSize: 12,
                fontFamily: "monospace",
              }}
            />
          ) : (
            <span
              style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", fontFamily: "monospace" }}
            >
              {index + 1}. {rule.topic}
            </span>
          )}
        </div>
        {/* Status + edit */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              background: rule.ingested ? C.green : rule.error ? C.red : rule.approved ? C.sky : C.faint,
              color: C.bg,
              fontWeight: 800,
              textTransform: "uppercase",
              fontFamily: "monospace",
              letterSpacing: "0.05em",
            }}
          >
            {statusLabel}
          </span>
          {!rule.ingested && (
            <button
              onClick={() => setEditing((e) => !e)}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                border: `2px solid ${C.borderDim}`,
                background: C.bg,
                color: C.white,
                fontWeight: 800,
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "monospace",
              }}
            >
              {editing ? "done" : "edit"}
            </button>
          )}
        </div>
      </div>

      {/* Rule text */}
      {editing ? (
        <textarea
          value={rule.rule_text}
          onChange={(e) => onEdit(index, "rule_text", e.target.value)}
          rows={3}
          style={{
            width: "100%",
            background: C.bg,
            border: `2px solid ${C.sky}`,
            padding: "12px 16px",
            color: C.white,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            resize: "vertical",
            outline: "none",
          }}
        />
      ) : (
        <p style={{ margin: 0, fontSize: 16, color: C.white, lineHeight: 1.6, paddingLeft: 34 }}>
          {rule.rule_text}
        </p>
      )}

      {rule.error && (
        <p style={{ margin: "10px 0 0 34px", fontSize: 14, color: C.red, fontFamily: "monospace", fontWeight: 700 }}>
          ✗ Error: {rule.error}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ControlPlane() {
  const [adrText, setAdrText] = useState("");
  const [domain, setDomain] = useState("Web");
  const [project, setProject] = useState("NexusWeb");
  const [ingestKey, setIngestKey] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [rules, setRules] = useState<ExtractedRule[]>([]);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [ingestProgress, setIngestProgress] = useState({ done: 0, total: 0 });

  const approvedCount = rules.filter((r) => r.approved).length;
  const ingestedCount = rules.filter((r) => r.ingested).length;
  const failedCount = rules.filter((r) => r.error).length;

  // ── Extract ────────────────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!adrText.trim()) return;
    setStage("extracting");
    setErrorMsg("");
    setRules([]);

    try {
      const { rules: extracted, tokensUsed: t } = await extractRules(adrText, domain);
      setRules(extracted.map((r) => ({ ...r, approved: true })));
      setTokensUsed(t);
      setStage("reviewing");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Extraction failed");
      setStage("error");
    }
  };

  // ── Toggle / edit rule ─────────────────────────────────────────────────────
  const toggleRule = (i: number) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, approved: !r.approved } : r)));

  const editRule = (i: number, field: "topic" | "rule_text", val: string) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));

  // ── Ingest approved ────────────────────────────────────────────────────────
  const handleIngest = async () => {
    if (!ingestKey.trim()) {
      setErrorMsg("INGEST_API_KEY required — check your .env or enter it above");
      return;
    }

    const toIngest = rules.filter((r) => r.approved && !r.ingested);
    setStage("ingesting");
    setIngestProgress({ done: 0, total: toIngest.length });

    const updated = [...rules];

    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].approved || updated[i].ingested) continue;
      try {
        const { doc_id } = await ingestRule(updated[i], domain, project, ingestKey);
        updated[i] = { ...updated[i], ingested: true, doc_id };
      } catch (e: unknown) {
        updated[i] = {
          ...updated[i],
          error: e instanceof Error ? e.message : "Ingest failed",
        };
      }
      setRules([...updated]);
      setIngestProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setStage("done");
  };

  const handleReset = () => {
    setStage("idle");
    setRules([]);
    setAdrText("");
    setErrorMsg("");
    setTokensUsed(0);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=clash-display@700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.borderDim}; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.faint}; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          color: C.white,
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          padding: "40px 32px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 40,
            paddingBottom: 24,
            borderBottom: `2px solid ${C.borderDim}`,
          }}
        >
          <img src="/logo.png" alt="OptiEngine" style={{ width: 48, height: 48, background: C.white, border: `2px solid ${C.white}`, boxShadow: sh(C.white, 3), objectFit: "contain" }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: C.white, textTransform: "uppercase", fontFamily: "'ClashDisplay-Bold', 'ClashDisplay', 'Arial Black', sans-serif" }}>
              Control <span style={{ color: C.green }}>Plane</span>
            </h1>
            <p style={{ margin: 0, marginTop: 4, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "monospace" }}>
              Staff Engineer / ADR Ingestion
            </p>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 13, color: C.faint, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
            <div>{OPTIENGINE_URL}</div>
            <div style={{ color: C.green, marginTop: 4 }}>● BACKEND ONLINE</div>
          </div>
        </div>

        {
          (stage === "idle" || stage === "error") && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {/* Config row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 2fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {[
                  {
                    label: "Domain",
                    content: (
                      <select
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        style={{
                          width: "100%",
                          background: C.bg,
                          border: `2px solid ${C.borderDim}`,
                          color: C.white,
                          padding: "16px 18px",
                          fontSize: 16,
                          fontFamily: "monospace",
                          cursor: "pointer",
                          fontWeight: 700,
                          outline: "none",
                        }}
                      >
                        {DOMAINS.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    ),
                  },
                  {
                    label: "Project",
                    content: (
                      <input
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        placeholder="e.g. NexusWeb"
                        style={{
                          width: "100%",
                          background: C.bg,
                          border: `2px solid ${C.borderDim}`,
                          color: C.white,
                          padding: "16px 18px",
                          fontSize: 16,
                          fontFamily: "monospace",
                          fontWeight: 700,
                          outline: "none",
                        }}
                      />
                    ),
                  },
                  {
                    label: "Ingest API Key",
                    content: (
                      <input
                        type="password"
                        value={ingestKey}
                        onChange={(e) => setIngestKey(e.target.value)}
                        placeholder="Your INGEST_API_KEY from .env"
                        style={{
                          width: "100%",
                          background: C.bg,
                          border: `2px solid ${C.borderDim}`,
                          color: C.white,
                          padding: "16px 18px",
                          fontSize: 16,
                          fontFamily: "monospace",
                          fontWeight: 700,
                          outline: "none",
                        }}
                      />
                    ),
                  },
                ].map((field) => (
                  <div key={field.label}>
                    <label
                      style={{ fontSize: 13, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 10 }}
                    >
                      {field.label}
                    </label>
                    {field.content}
                  </div>
                ))}
              </div>

              {/* ADR textarea */}
              <div style={{ marginBottom: 24, border: `2px solid ${C.borderDim}`, padding: 20, background: C.card, boxShadow: sh(C.borderDim, 6) }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 12, height: 12, background: C.sky, border: `2px solid ${C.sky}` }} />
                    <label style={{ fontSize: 13, color: C.light, fontWeight: 800, textTransform: "uppercase", fontFamily: "monospace", letterSpacing: "0.08em" }}>
                      ADR / Technical Document
                    </label>
                  </div>
                  <button
                    onClick={() => setAdrText(SAMPLE_ADR)}
                    style={{
                      fontSize: 12,
                      padding: "6px 14px",
                      border: `2px solid ${C.borderDim}`,
                      background: C.bg,
                      color: C.white,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      cursor: "pointer",
                      fontFamily: "monospace",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.sky}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.borderDim}
                  >
                    Load Sample
                  </button>
                </div>
                <textarea
                  value={adrText}
                  onChange={(e) => setAdrText(e.target.value)}
                  rows={16}
                  placeholder={`# ADR-0014: State Management Strategy\n\n## Decision\nWe will use React Query for server state...\n\n## Rules\n- useEffect + fetch is forbidden\n- Every useQuery must define staleTime...`}
                  style={{
                    width: "100%",
                    background: C.bg,
                    border: `2px solid ${C.borderDim}`,
                    padding: "16px 20px",
                    color: C.white,
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    resize: "vertical",
                    lineHeight: 1.7,
                    outline: "none",
                  }}
                  onFocus={e => e.target.style.borderColor = C.sky}
                  onBlur={e => e.target.style.borderColor = C.borderDim}
                />
                <div style={{ marginTop: 12, fontSize: 12, color: C.faint, fontFamily: "monospace", fontWeight: 700 }}>
                  {adrText.split(/\s+/).filter(Boolean).length} WORDS ·{" "}
                  {adrText.length} CHARS
                </div>
              </div>

              {/* Error */}
              {stage === "error" && errorMsg && (
                <div
                  style={{
                    padding: "12px 18px",
                    background: C.bg,
                    border: `2px solid ${C.red}`,
                    boxShadow: sh(C.red, 4),
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "monospace",
                    color: C.red,
                    marginBottom: 20,
                  }}
                >
                  ✗ {errorMsg}
                </div>
              )}

              {/* Extract button */}
              <button
                onClick={handleExtract}
                disabled={!adrText.trim()}
                style={{
                  width: "100%",
                  padding: "18px 0",
                  border: `2px solid ${adrText.trim() ? C.green : C.borderDim}`,
                  boxShadow: adrText.trim() ? sh(C.green, 6) : "none",
                  cursor: adrText.trim() ? "pointer" : "not-allowed",
                  background: adrText.trim() ? C.green : C.bg,
                  color: adrText.trim() ? C.bg : C.faint,
                  fontSize: 18,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontFamily: "monospace",
                  transition: "transform 0.1s, box-shadow 0.1s",
                }}
                onMouseDown={e => { if (adrText.trim()) { e.currentTarget.style.transform = "translate(4px, 4px)"; e.currentTarget.style.boxShadow = "none"; } }}
                onMouseUp={e => { if (adrText.trim()) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = sh(C.green, 6); } }}
                onMouseLeave={e => { if (adrText.trim()) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = sh(C.green, 6); } }}
              >
                Extract Rules and Conventions
              </button>
            </div>
          )
        }

        {/* ── STAGE: EXTRACTING ── */}
        {
          stage === "extracting" && (
            <div
              style={{
                textAlign: "center",
                padding: "100px 40px",
                animation: "fadeIn 0.3s ease",
              }}
            >
              <Spinner size={64} color={C.green} />
              <div style={{ marginTop: 32, fontSize: 24, fontWeight: 800, color: C.white, fontFamily: "monospace" }}>
                EXTRACTING STANDARDS
              </div>
              <div style={{ marginTop: 12, fontSize: 14, color: C.muted, fontWeight: 700, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Groq Llama-3 parsing technical documentation
              </div>
            </div>
          )
        }

        {/* ── STAGE: REVIEWING ── */}
        {
          stage === "reviewing" && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 16,
                  marginBottom: 32,
                }}
              >
                {[
                  { label: "Rules Extracted", value: rules.length, color: C.green },
                  { label: "Approved", value: approvedCount, color: C.sky },
                  { label: "Skipped", value: rules.length - approvedCount, color: C.orange },
                  { label: "Tokens Used", value: tokensUsed, color: C.purple },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: C.card,
                      padding: "20px",
                      border: `2px solid ${s.color}`,
                      boxShadow: sh(s.color, 4),
                    }}
                  >
                    <div style={{ fontSize: 13, color: C.light, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>{s.label}</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, background: C.sky, border: `2px solid ${C.sky}` }} />
                  <div style={{ fontSize: 15, color: C.white, fontWeight: 800, textTransform: "uppercase", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                    REVIEW EXTRACTED RULES
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setRules((r) => r.map((x) => ({ ...x, approved: true })))}
                    style={{
                      fontSize: 13,
                      padding: "6px 16px",
                      border: `2px solid ${C.green}`,
                      background: C.bg,
                      color: C.green,
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Approve All
                  </button>
                  <button
                    onClick={() => setRules((r) => r.map((x) => ({ ...x, approved: false })))}
                    style={{
                      fontSize: 13,
                      padding: "6px 16px",
                      border: `2px solid ${C.red}`,
                      background: C.bg,
                      color: C.red,
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Skip All
                  </button>
                </div>
              </div>

              {/* Rule cards */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}
              >
                {rules.map((rule, i) => (
                  <RuleCard
                    key={i}
                    rule={rule}
                    index={i}
                    onToggle={toggleRule}
                    onEdit={editRule}
                  />
                ))}
              </div>

              {/* Error */}
              {errorMsg && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#ef444411",
                    border: "1px solid #ef444433",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "#fca5a5",
                    marginBottom: 12,
                  }}
                >
                  ✗ {errorMsg}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 16 }}>
                <button
                  onClick={handleIngest}
                  disabled={approvedCount === 0}
                  style={{
                    flex: 1,
                    padding: "16px 24px",
                    border: `2px solid ${approvedCount > 0 ? C.sky : C.borderDim}`,
                    boxShadow: approvedCount > 0 ? sh(C.sky, 6) : "none",
                    cursor: approvedCount > 0 ? "pointer" : "not-allowed",
                    background: approvedCount > 0 ? C.sky : C.bg,
                    color: approvedCount > 0 ? C.bg : C.faint,
                    fontSize: 16,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontFamily: "monospace",
                    transition: "transform 0.1s, box-shadow 0.1s",
                  }}
                  onMouseDown={e => { if (approvedCount > 0) { e.currentTarget.style.transform = "translate(4px, 4px)"; e.currentTarget.style.boxShadow = "none"; } }}
                  onMouseUp={e => { if (approvedCount > 0) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = sh(C.sky, 6); } }}
                  onMouseLeave={e => { if (approvedCount > 0) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = sh(C.sky, 6); } }}
                >
                  Ingest {approvedCount} Rule{approvedCount !== 1 ? "s" : ""}
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    padding: "16px 32px",
                    border: `2px solid ${C.borderDim}`,
                    background: C.card,
                    color: C.light,
                    fontSize: 16,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontFamily: "monospace",
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          )
        }

        {/* ── STAGE: INGESTING ── */}
        {
          stage === "ingesting" && (
            <div style={{ animation: "fadeIn 0.3s ease", padding: "80px 0", textAlign: "center" }}>
              <div
                style={{
                  marginBottom: 24,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <Spinner size={48} color={C.sky} />
                <span style={{ fontSize: 20, color: C.white, fontWeight: 800, fontFamily: "monospace", textTransform: "uppercase" }}>
                  Ingesting {ingestProgress.done} / {ingestProgress.total}...
                </span>
              </div>
              <div style={{ height: 6, background: C.borderDim, border: `1px solid ${C.borderDim}`, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    background: C.sky,
                    width: `${(ingestProgress.done / ingestProgress.total) * 100}%`,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14 }}>
                {rules.map((rule, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 10px",
                      background: "#0a0f1e",
                      borderRadius: 5,
                      opacity: rule.approved ? 1 : 0.3,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>
                      {!rule.approved
                        ? "○"
                        : rule.ingested
                          ? "✓"
                          : rule.error
                            ? "✗"
                            : "⋯"}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: rule.ingested
                          ? "#22c55e"
                          : rule.error
                            ? "#ef4444"
                            : "#94a3b8",
                        fontFamily: "monospace",
                      }}
                    >
                      {rule.topic}
                    </span>
                    {rule.doc_id && (
                      <span style={{ fontSize: 9, color: "#334155", marginLeft: "auto" }}>
                        {rule.doc_id.slice(0, 10)}...
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        }

        {/* ── STAGE: DONE ── */}
        {
          stage === "done" && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              {/* Success banner */}
              <div
                style={{
                  padding: "20px 24px",
                  background: "#0a1628",
                  border: "1px solid #22c55e44",
                  borderRadius: 12,
                  marginBottom: 20,
                  boxShadow: "0 0 24px #22c55e11",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 40,
                      fontWeight: 900,
                      color: "#22c55e",
                      lineHeight: 1,
                    }}
                  >
                    {ingestedCount}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>
                      rules ingested into ChromaDB
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      domain: {domain} · project: {project}
                    </div>
                  </div>
                  {failedCount > 0 && (
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#ef4444" }}>{failedCount} failed</div>
                    </div>
                  )}
                </div>

                {/* What happens next */}
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#060b14",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "#64748b",
                    lineHeight: 1.7,
                  }}
                >
                  <span style={{ color: "#22c55e", fontWeight: 700 }}>What happens next →</span>{" "}
                  These {ingestedCount} rules are now live in the{" "}
                  <code style={{ color: "#93c5fd" }}>guidelines_{domain.toLowerCase()}</code>{" "}
                  collection. The next developer prompt in Cursor matching these standards
                  will automatically receive them as{" "}
                  <span style={{ color: "#f59e0b" }}>[MANDATORY]</span> directives.
                  No IDE restart required.
                </div>
              </div>

              {/* Final rule list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20 }}>
                {rules.map((rule, i) => (
                  <RuleCard
                    key={i}
                    rule={rule}
                    index={i}
                    onToggle={() => { }}
                    onEdit={() => { }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleReset}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: "linear-gradient(135deg,#22c55e,#16a34a)",
                    color: "#000",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "monospace",
                    boxShadow: "0 0 16px #22c55e44",
                  }}
                >
                  + Ingest Another ADR
                </button>
                <a
                  href={`${OPTIENGINE_URL}/api/v1/rules?domain=${domain}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                    background: "transparent",
                    color: "#64748b",
                    fontSize: 13,
                    fontFamily: "monospace",
                    cursor: "pointer",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  View DB ↗
                </a>
              </div>
            </div>
          )
        }
      </div >
    </>
  );
}