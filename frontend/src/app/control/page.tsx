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

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <div
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid #1e293b`,
        borderTop: `2px solid #22c55e`,
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
        background: rule.approved ? "#0a1628" : "#0a0f1e",
        border: `1px solid ${rule.approved ? "#3b82f644" : "#1e293b"}`,
        borderRadius: 8,
        padding: "12px 14px",
        opacity: rule.approved ? 1 : 0.5,
        transition: "all 0.2s",
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
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <span
            style={{
              fontSize: 9,
              padding: "2px 7px",
              borderRadius: 3,
              background: `${statusColor}22`,
              color: statusColor,
              fontWeight: 700,
              fontFamily: "monospace",
            }}
          >
            {statusLabel}
          </span>
          {!rule.ingested && (
            <button
              onClick={() => setEditing((e) => !e)}
              style={{
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 3,
                border: "1px solid #334155",
                background: "transparent",
                color: "#64748b",
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
            background: "#060b14",
            border: "1px solid #3b82f6",
            borderRadius: 4,
            padding: "6px 8px",
            color: "#94a3b8",
            fontSize: 11,
            fontFamily: "monospace",
            resize: "vertical",
          }}
        />
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.6, paddingLeft: 26 }}>
          {rule.rule_text}
        </p>
      )}

      {rule.error && (
        <p style={{ margin: "6px 0 0 26px", fontSize: 10, color: "#ef4444" }}>
          Error: {rule.error}
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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060b14; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#060b14",
          color: "#e2e8f0",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          padding: 24,
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 28,
            paddingBottom: 18,
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg,#22c55e,#16a34a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 900,
              color: "#fff",
              boxShadow: "0 0 16px #22c55e44",
            }}
          >
            O
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>
              OptiEngine{" "}
              <span style={{ color: "#22c55e" }}>Control Plane</span>
            </h1>
            <p style={{ margin: 0, fontSize: 10, color: "#475569" }}>
              Staff Engineer · ADR Auto-Ingestion
            </p>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: "#475569", textAlign: "right" }}>
            <div>
              {OPTIENGINE_URL}
            </div>
            <div style={{ color: "#22c55e" }}>● backend</div>
          </div>
        </div>

        {/* ── STAGE: IDLE / INPUT ── */}
        {(stage === "idle" || stage === "error") && (
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
                        background: "#060b14",
                        border: "1px solid #1e293b",
                        borderRadius: 6,
                        color: "#e2e8f0",
                        padding: "8px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
                        cursor: "pointer",
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
                        background: "#060b14",
                        border: "1px solid #1e293b",
                        borderRadius: 6,
                        color: "#e2e8f0",
                        padding: "8px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
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
                        background: "#060b14",
                        border: "1px solid #1e293b",
                        borderRadius: 6,
                        color: "#e2e8f0",
                        padding: "8px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
                      }}
                    />
                  ),
                },
              ].map((field) => (
                <div key={field.label}>
                  <label
                    style={{ fontSize: 9, color: "#64748b", display: "block", marginBottom: 5 }}
                  >
                    {field.label}
                  </label>
                  {field.content}
                </div>
              ))}
            </div>

            {/* ADR textarea */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <label style={{ fontSize: 9, color: "#64748b" }}>
                  ADR / TECHNICAL DOCUMENT — paste markdown or plain text
                </label>
                <button
                  onClick={() => setAdrText(SAMPLE_ADR)}
                  style={{
                    fontSize: 9,
                    padding: "2px 9px",
                    borderRadius: 4,
                    border: "1px solid #22c55e44",
                    background: "#22c55e11",
                    color: "#22c55e",
                    cursor: "pointer",
                    fontFamily: "monospace",
                  }}
                >
                  load sample ADR
                </button>
              </div>
              <textarea
                value={adrText}
                onChange={(e) => setAdrText(e.target.value)}
                rows={14}
                placeholder={`# ADR-0014: State Management Strategy\n\n## Decision\nWe will use React Query for server state...\n\n## Rules\n- useEffect + fetch is forbidden\n- Every useQuery must define staleTime...`}
                style={{
                  width: "100%",
                  background: "#0a0f1e",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  padding: "12px 14px",
                  color: "#e2e8f0",
                  fontSize: 11,
                  fontFamily: "monospace",
                  resize: "vertical",
                  lineHeight: 1.7,
                }}
              />
              <div style={{ marginTop: 4, fontSize: 10, color: "#334155" }}>
                {adrText.split(/\s+/).filter(Boolean).length} words ·{" "}
                {adrText.length} characters
              </div>
            </div>

            {/* Error */}
            {stage === "error" && errorMsg && (
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

            {/* Extract button */}
            <button
              onClick={handleExtract}
              disabled={!adrText.trim()}
              style={{
                padding: "10px 28px",
                borderRadius: 8,
                border: "none",
                cursor: adrText.trim() ? "pointer" : "not-allowed",
                background: adrText.trim()
                  ? "linear-gradient(135deg,#22c55e,#16a34a)"
                  : "#1e293b",
                color: adrText.trim() ? "#000" : "#475569",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "monospace",
                boxShadow: adrText.trim() ? "0 0 16px #22c55e44" : "none",
                transition: "all 0.2s",
              }}
            >
              Extract Rules and Conventions
            </button>
          </div>
        )}

        {/* ── STAGE: EXTRACTING ── */}
        {stage === "extracting" && (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              animation: "fadeIn 0.3s ease",
            }}
          >
            <Spinner size={32} />
            <div style={{ marginTop: 16, fontSize: 13, color: "#94a3b8" }}>
              Groq reading your ADR...
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "#475569" }}>
              Extracting atomic enforceable rules · model: {`llama-3.1-8b-instant`}
            </div>
          </div>
        )}

        {/* ── STAGE: REVIEWING ── */}
        {stage === "reviewing" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            {/* Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
                marginBottom: 18,
              }}
            >
              {[
                { label: "Rules Extracted", value: rules.length, color: "#22c55e" },
                { label: "Approved", value: approvedCount, color: "#3b82f6" },
                { label: "Skipped", value: rules.length - approvedCount, color: "#f59e0b" },
                { label: "Tokens Used", value: tokensUsed, color: "#c084fc" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "#0a0f1e",
                    borderRadius: 8,
                    padding: "12px 14px",
                    border: `1px solid ${s.color}22`,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#475569" }}>{s.label}</div>
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
              <div style={{ fontSize: 10, color: "#64748b" }}>
                REVIEW EXTRACTED RULES — toggle to approve/skip · click edit to modify
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() =>
                    setRules((r) => r.map((x) => ({ ...x, approved: true })))
                  }
                  style={{
                    fontSize: 10,
                    padding: "3px 10px",
                    borderRadius: 4,
                    border: "1px solid #22c55e44",
                    background: "#22c55e11",
                    color: "#22c55e",
                    cursor: "pointer",
                    fontFamily: "monospace",
                  }}
                >
                  approve all
                </button>
                <button
                  onClick={() =>
                    setRules((r) => r.map((x) => ({ ...x, approved: false })))
                  }
                  style={{
                    fontSize: 10,
                    padding: "3px 10px",
                    borderRadius: 4,
                    border: "1px solid #ef444444",
                    background: "#ef444411",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontFamily: "monospace",
                  }}
                >
                  skip all
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
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleIngest}
                disabled={approvedCount === 0}
                style={{
                  padding: "10px 28px",
                  borderRadius: 8,
                  border: "none",
                  cursor: approvedCount > 0 ? "pointer" : "not-allowed",
                  background:
                    approvedCount > 0
                      ? "linear-gradient(135deg,#22c55e,#16a34a)"
                      : "#1e293b",
                  color: approvedCount > 0 ? "#000" : "#475569",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  boxShadow: approvedCount > 0 ? "0 0 16px #22c55e44" : "none",
                  transition: "all 0.2s",
                }}
              >
                ✓ Ingest {approvedCount} Rule{approvedCount !== 1 ? "s" : ""} into ChromaDB
              </button>
              <button
                onClick={handleReset}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "1px solid #1e293b",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: 13,
                  fontFamily: "monospace",
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE: INGESTING ── */}
        {stage === "ingesting" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Spinner />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Ingesting {ingestProgress.done} / {ingestProgress.total}...
              </span>
            </div>
            <div style={{ height: 6, background: "#1e293b", borderRadius: 3 }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  background: "linear-gradient(90deg,#22c55e88,#22c55e)",
                  width: `${(ingestProgress.done / ingestProgress.total) * 100}%`,
                  transition: "width 0.3s ease",
                  boxShadow: "0 0 8px #22c55e",
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
        )}

        {/* ── STAGE: DONE ── */}
        {stage === "done" && (
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
                  onToggle={() => {}}
                  onEdit={() => {}}
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
        )}
      </div>
    </>
  );
}