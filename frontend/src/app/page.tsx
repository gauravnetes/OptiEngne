"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────
type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "ONLINE";

interface NaiveApproach {
  complexity: string;
  tokens_used: number;
  execution_time_ms: number;
}

interface OptiEngineApproach {
  complexity: string;
  tokens_used: number;
  execution_time_ms: number;
  language: string;
  code_snippet: string;
}

interface InterceptPayload {
  problem_type: string;
  match_confidence: string;
  prompt: string;
  naive_approach: NaiveApproach;
  optiengine_approach: OptiEngineApproach;
}

interface WsMessage {
  type: string;
  payload: InterceptPayload;
}

interface GlobalMetrics {
  totalIntercepts: number;
  tokensSaved: number;
  computeSavedMs: number;
}

// ── Font helpers ────────────────────────────────────────────────────
const pixel = "font-[family-name:var(--font-inter)]";
const grotesk = "font-[family-name:var(--font-space-grotesk)]";

// ── WebSocket URL ───────────────────────────────────────────────────
const WS_URL = "ws://localhost:8000/ws/telemetry";

export default function Home() {
  // ── Real State ──────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("CONNECTING");
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics>({
    totalIntercepts: 0,
    tokensSaved: 0,
    computeSavedMs: 0,
  });
  const [activeIntercept, setActiveIntercept] = useState<InterceptPayload | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── WebSocket Hook ──────────────────────────────────────────────
  useEffect(() => {
    setConnectionStatus("CONNECTING");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("ONLINE");
    };

    ws.onclose = () => {
      setConnectionStatus("DISCONNECTED");
    };

    ws.onerror = () => {
      setConnectionStatus("DISCONNECTED");
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data: WsMessage = JSON.parse(event.data);

        if (data.type === "MCP_INTERCEPT" && data.payload) {
          const payload = data.payload;

          // Update the active intercept with the full payload
          setActiveIntercept(payload);

          // Mathematically update cumulative metrics
          const tokenDiff =
            payload.naive_approach.tokens_used -
            payload.optiengine_approach.tokens_used;
          const timeDiff =
            payload.naive_approach.execution_time_ms -
            payload.optiengine_approach.execution_time_ms;

          setGlobalMetrics((prev) => ({
            totalIntercepts: prev.totalIntercepts + 1,
            tokensSaved: prev.tokensSaved + tokenDiff,
            computeSavedMs: prev.computeSavedMs + timeDiff,
          }));
        }
      } catch {
        // Silently ignore malformed messages
      }
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────
  const msToSec = (ms: number) => (ms / 1000).toFixed(2) + "s";
  const promptTokens = activeIntercept
    ? activeIntercept.prompt.split(/\s+/).filter(Boolean).length
    : 0;

  const computeSavedPercent =
    globalMetrics.computeSavedMs > 0
      ? ((globalMetrics.computeSavedMs / (globalMetrics.computeSavedMs + 120)) * 100).toFixed(1)
      : "0";

  return (
    <div className="min-h-screen bg-[#050505] bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:16px_16px] text-gray-300">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* ═══════════════════════════════════════════════════════════
            HEADER
            ═══════════════════════════════════════════════════════════ */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className={`${pixel} text-7xl sm:text-8xl lg:text-9xl text-white font-black tracking-tighter leading-none`}>
              OPTIENGINE
            </h1>
            <p className={`${grotesk} text-xs sm:text-sm text-white/40 uppercase tracking-[0.3em] mt-2`}>
              Algorithmic Optimization Engine — MCP Protocol
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection Status Badge — bound to WebSocket state */}
            <div
              className={`font-bold uppercase text-xs px-3 py-1.5 tracking-wider transition-colors duration-150 ${connectionStatus === "ONLINE"
                  ? "bg-white text-black shadow-brutal"
                  : connectionStatus === "CONNECTING"
                    ? "bg-yellow-400 text-black shadow-[4px_4px_0px_0px_rgba(250,204,21,0.5)] animate-brutal-pulse"
                    : "bg-red-500 text-white shadow-[4px_4px_0px_0px_rgba(239,68,68,0.5)]"
                }`}
            >
              {connectionStatus === "ONLINE"
                ? "MCP: ONLINE"
                : connectionStatus === "CONNECTING"
                  ? "MCP: CONNECTING..."
                  : "MCP: DISCONNECTED"}
            </div>
            <div className={`${pixel} text-[10px] text-white/30 uppercase`}>
              v0.1.0
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════
            TELEMETRY SCOREBOARD — bound to globalMetrics
            ═══════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Total Intercepts",
              value: globalMetrics.totalIntercepts > 0 ? String(globalMetrics.totalIntercepts) : "0",
              accent: "text-cyan-400",
            },
            {
              label: "Tokens Saved",
              value: globalMetrics.tokensSaved > 0 ? globalMetrics.tokensSaved.toLocaleString() : "—",
              accent: "text-orange-500",
            },
            {
              label: "Compute Saved",
              value: globalMetrics.computeSavedMs > 0 ? `${computeSavedPercent}%` : "—",
              accent: "text-cyan-400",
            },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className="border-2 border-white/10 bg-[#111] p-5 shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)]"
            >
              <span className={`${grotesk} text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-3`}>
                {label}
              </span>
              <span className={`${pixel} text-5xl sm:text-6xl font-black ${accent} block leading-none`}>
                {value}
              </span>
            </div>
          ))}
        </section>

        {/* ═══════════════════════════════════════════════════════════
            INPUT SECTION — shows the intercepted prompt
            ═══════════════════════════════════════════════════════════ */}
        <section className="border-2 border-white/10 bg-[#111] shadow-brutal">
          {/* Input label bar */}
          <div className="border-b-2 border-white/10 px-5 py-2.5 flex justify-between items-center">
            <span className={`${grotesk} text-[10px] uppercase tracking-[0.3em] text-white/40`}>
              INPUT :: INTERCEPTED_PROMPT
            </span>
            <span className={`${pixel} text-xs text-white/30`}>
              {activeIntercept ? `${activeIntercept.prompt.length} chars / ${promptTokens} tokens` : "0 chars / 0 tokens"}
            </span>
          </div>

          {/* Prompt Display */}
          <div className={`transition-colors duration-150 ${activeIntercept ? "bg-[#151515]" : ""}`}>
            <div className={`${grotesk} w-full min-h-[100px] p-5 text-sm ${activeIntercept ? "text-gray-300" : "text-white/20"}`}>
              {activeIntercept
                ? activeIntercept.prompt
                : connectionStatus === "ONLINE"
                  ? "// Listening for MCP intercepts on ws://localhost:8000..."
                  : connectionStatus === "CONNECTING"
                    ? "// Establishing WebSocket connection..."
                    : "// WebSocket disconnected. Check backend server."}
            </div>
          </div>

          {/* Status indicator bar */}
          <div className={`
            border-t-2 border-white/10 uppercase tracking-[0.3em] text-sm py-3 px-5
            text-left ${pixel}
            ${connectionStatus === "ONLINE"
              ? "bg-[#111] text-emerald-400/50"
              : connectionStatus === "CONNECTING"
                ? "bg-yellow-400/10 text-yellow-400/50 animate-brutal-pulse"
                : "bg-red-500/10 text-red-500/50"
            }
          `}>
            {connectionStatus === "ONLINE"
              ? "▸ LISTENING ON ws://localhost:8000/ws/telemetry"
              : connectionStatus === "CONNECTING"
                ? "▸ CONNECTING TO MCP TRANSPORT..."
                : "▸ CONNECTION LOST — RETRYING..."}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            LIVE MCP PIPELINE — renders when intercept data exists
            ═══════════════════════════════════════════════════════════ */}
        {activeIntercept && (
          <section className="border-2 border-white/10 bg-[#111] shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)]">
            <div className="border-b-2 border-white/10 px-5 py-2.5 flex justify-between items-center">
              <span className={`${grotesk} text-[10px] uppercase tracking-[0.3em] text-white/40`}>
                LIVE_MCP_PIPELINE
              </span>
              <span className={`${pixel} text-[10px] uppercase tracking-wider text-emerald-400`}>
                DELIVERED
              </span>
            </div>
            <div className="px-5 py-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0 overflow-x-auto">
              {/* Block 1: IDE */}
              <div className="border-2 border-white/10 bg-[#0a0a0a] px-4 py-3 flex-shrink-0">
                <span className={`${pixel} text-xs text-white/50 uppercase tracking-wider`}>
                  Claude.exe / IDE
                </span>
              </div>

              <ArrowRight className="text-cyan-400/40 w-6 h-6 mx-2 flex-shrink-0 hidden sm:block" />
              <span className={`${pixel} text-cyan-400/40 text-xs sm:hidden text-center`}>───▶</span>

              {/* Block 2: Intercept */}
              <div className="border-2 border-cyan-500/30 bg-cyan-500/5 px-4 py-3 flex-shrink-0">
                <span className={`${pixel} text-xs text-cyan-400 uppercase tracking-wider`}>
                  OptiEngine Intercept
                </span>
              </div>

              <ArrowRight className="text-cyan-400/40 w-6 h-6 mx-2 flex-shrink-0 hidden sm:block" />
              <span className={`${pixel} text-cyan-400/40 text-xs sm:hidden text-center`}>───▶</span>

              {/* Block 3: Vector Search */}
              <div className="border-2 border-white/10 bg-[#0a0a0a] px-4 py-3 flex-shrink-0">
                <span className={`${pixel} text-xs text-white/50 uppercase tracking-wider`}>
                  ChromaDB Vector Search
                </span>
              </div>

              <ArrowRight className="text-emerald-400/40 w-6 h-6 mx-2 flex-shrink-0 hidden sm:block" />
              <span className={`${pixel} text-emerald-400/40 text-xs sm:hidden text-center`}>───▶</span>

              {/* Block 4: Payload */}
              <div className="border-2 border-emerald-500/50 bg-emerald-500/5 px-4 py-3 flex-shrink-0">
                <span className={`${pixel} text-xs text-emerald-400 uppercase tracking-wider`}>
                  Optimal {activeIntercept.optiengine_approach.language} Payload Served
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════
            RESULT SECTION — Split-Screen Comparison
            ═══════════════════════════════════════════════════════════ */}
        {activeIntercept ? (
          <section className="flex flex-col gap-4">
            {/* Result Header */}
            <div className="border-2 border-white/10 bg-[#111] p-5 shadow-brutal flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className={`${grotesk} text-[10px] uppercase tracking-[0.3em] text-white/40 block mb-1`}>
                  Detected Problem Type
                </span>
                <span className={`${pixel} text-2xl sm:text-3xl text-white font-bold`}>
                  {activeIntercept.problem_type}
                </span>
              </div>
              <div className="sm:text-right">
                <span className={`${grotesk} text-[10px] uppercase tracking-[0.3em] text-white/40 block mb-1`}>
                  Match Confidence
                </span>
                <span className={`${pixel} text-4xl sm:text-5xl text-emerald-400 font-bold leading-none`}>
                  {activeIntercept.match_confidence}
                </span>
              </div>
            </div>

            {/* Split Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ── Column A: Naive AI ──────────────────────────── */}
              <div className="border-2 border-red-500/40 bg-[#111] shadow-[6px_6px_0px_0px_rgba(220,38,38,1)] flex flex-col">
                {/* Title bar */}
                <div className="border-b-2 border-red-500/30 px-5 py-3 bg-red-500/5">
                  <span className={`${pixel} text-sm text-red-500 uppercase tracking-wider`}>
                    [ NAIVE_AI_APPROACH ]
                  </span>
                </div>

                {/* Stats */}
                <div className="flex flex-col">
                  <div className="border-b-2 border-white/5 px-5 py-4">
                    <span className={`${grotesk} text-[10px] uppercase tracking-[0.25em] text-white/30 block mb-1`}>
                      Time Complexity
                    </span>
                    <span className={`${pixel} text-4xl sm:text-5xl text-red-500 font-black`}>
                      {activeIntercept.naive_approach.complexity}
                    </span>
                  </div>
                  <div className="border-b-2 border-white/5 px-5 py-4">
                    <span className={`${grotesk} text-[10px] uppercase tracking-[0.25em] text-white/30 block mb-1`}>
                      Tokens Wasted
                    </span>
                    <span className={`${pixel} text-4xl sm:text-5xl text-red-500 font-black`}>
                      {activeIntercept.naive_approach.tokens_used.toLocaleString()}
                    </span>
                  </div>
                  <div className="px-5 py-4">
                    <span className={`${grotesk} text-[10px] uppercase tracking-[0.25em] text-white/30 block mb-1`}>
                      Execution Time
                    </span>
                    <span className={`${pixel} text-4xl sm:text-5xl text-red-500 font-black`}>
                      {msToSec(activeIntercept.naive_approach.execution_time_ms)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Column B: OptiEngine ────────────────────────── */}
              <div className="border-2 border-emerald-500/40 bg-[#111] shadow-[6px_6px_0px_0px_rgba(16,185,129,1)] flex flex-col">
                {/* Title bar */}
                <div className="border-b-2 border-emerald-500/30 px-5 py-3 bg-emerald-500/5">
                  <span className={`${pixel} text-sm text-emerald-400 uppercase tracking-wider`}>
                    [ OPTIENGINE_OPTIMIZED ]
                  </span>
                </div>

                {/* Stats */}
                <div className="flex flex-col">
                  <div className="border-b-2 border-white/5 px-5 py-4">
                    <span className={`${grotesk} text-[10px] uppercase tracking-[0.25em] text-white/30 block mb-1`}>
                      Upgraded Complexity
                    </span>
                    <span className={`${pixel} text-4xl sm:text-5xl text-emerald-400 font-black`}>
                      {activeIntercept.optiengine_approach.complexity}
                    </span>
                  </div>
                  <div className="border-b-2 border-white/5 px-5 py-4">
                    <span className={`${grotesk} text-[10px] uppercase tracking-[0.25em] text-white/30 block mb-1`}>
                      Tokens Used
                    </span>
                    <span className={`${pixel} text-4xl sm:text-5xl text-emerald-400 font-black`}>
                      {activeIntercept.optiengine_approach.tokens_used}
                    </span>
                  </div>
                  <div className="border-b-2 border-white/5 px-5 py-4">
                    <span className={`${grotesk} text-[10px] uppercase tracking-[0.25em] text-white/30 block mb-1`}>
                      Execution Time
                    </span>
                    <span className={`${pixel} text-4xl sm:text-5xl text-emerald-400 font-black`}>
                      {msToSec(activeIntercept.optiengine_approach.execution_time_ms)}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* ── PAYLOAD DELIVERED TO AGENT ─────────────────────── */}
            <div className="border-2 border-white/10 bg-[#0a0a0a] shadow-[6px_6px_0px_0px_rgba(16,185,129,0.5)] border-l-4 border-l-emerald-500">
              <div className="border-b-2 border-white/10 px-5 py-2.5 flex justify-between items-center">
                <span className={`${pixel} text-sm text-emerald-400 uppercase tracking-wider`}>
                  [ PAYLOAD_DELIVERED_TO_AGENT ]
                </span>
                <span className={`${grotesk} text-[10px] text-white/30 uppercase tracking-wider`}>
                  {activeIntercept.optiengine_approach.language} • optimized
                </span>
              </div>
              <pre className={`${grotesk} px-6 py-5 text-sm text-emerald-400/80 leading-relaxed overflow-auto whitespace-pre`}>
                {activeIntercept.optiengine_approach.code_snippet}
              </pre>
            </div>
          </section>
        ) : (
          /* Awaiting state — no data yet */
          <section className="border-2 border-white/10 bg-[#111] p-6 shadow-brutal">
            <div className="flex flex-col gap-4">
              <p className={`${pixel} text-xs uppercase tracking-widest ${connectionStatus === "ONLINE" ? "text-emerald-400/30" : "text-white/20"
                }`}>
                {connectionStatus === "ONLINE"
                  ? "MCP server connected. Awaiting intercept events..."
                  : connectionStatus === "CONNECTING"
                    ? "Establishing connection to MCP transport..."
                    : "WebSocket disconnected. No data available."}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  "Intercept",
                  "Tokenize",
                  "Optimize",
                  "Deploy",
                ].map((step, i) => (
                  <div key={step} className="border border-white/5 bg-[#0d0d0d] px-3 py-2.5 flex items-center gap-2">
                    <span className={`${pixel} text-xs text-white/15`}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={`${grotesk} text-[10px] uppercase tracking-wider text-white/25`}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════
            FOOTER
            ═══════════════════════════════════════════════════════════ */}
        <footer className="border-t border-white/5 pt-4 pb-2 flex flex-col sm:flex-row sm:justify-between gap-2">
          <div className="flex items-center gap-4">
            {[
              { label: "Engine", value: "v0.1" },
              { label: "Protocol", value: "MCP/2.0" },
              { label: "Transport", value: "WebSocket" },
            ].map(({ label, value }) => (
              <span key={label} className={`${grotesk} text-[10px] uppercase tracking-wider text-white/20`}>
                {label}: <span className="text-white/40">{value}</span>
              </span>
            ))}
          </div>
          <span className={`${pixel} text-[10px] text-white/15 uppercase`}>
            ws://localhost:8000/ws/telemetry
          </span>
        </footer>

      </div>
    </div>
  );
}
