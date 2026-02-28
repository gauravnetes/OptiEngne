"use client";

import { useState } from "react";

// ── Structured result type ──────────────────────────────────────────
interface OptimizationResult {
  match_confidence: string;
  problem_type: string;
  naive_approach: {
    complexity: string;
    tokens_used: number;
    execution_time_ms: number;
  };
  optiengine_approach: {
    complexity: string;
    tokens_used: number;
    execution_time_ms: number;
    language: string;
    code_snippet: string;
  };
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const handleSubmit = () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setLoading(false);
      setResult({
        match_confidence: "98%",
        problem_type: "Graph Traversal",
        naive_approach: {
          complexity: "O(V³)",
          tokens_used: 1250,
          execution_time_ms: 15400,
        },
        optiengine_approach: {
          complexity: "O((V+E) log V)",
          tokens_used: 0,
          execution_time_ms: 120,
          language: "C++",
          code_snippet: `#include <queue>
#include <vector>
using namespace std;

// Dijkstra's with priority queue
// Time: O((V+E) log V)
vector<int> dijkstra(
  vector<vector<pair<int,int>>>& graph,
  int src
) {
  int V = graph.size();
  vector<int> dist(V, INT_MAX);
  priority_queue<
    pair<int,int>,
    vector<pair<int,int>>,
    greater<pair<int,int>>
  > pq;

  dist[src] = 0;
  pq.push({0, src});

  while (!pq.empty()) {
    auto [d, u] = pq.top();
    pq.pop();
    if (d > dist[u]) continue;
    for (auto& [v, w] : graph[u]) {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        pq.push({dist[v], v});
      }
    }
  }
  return dist;
}`,
        },
      });
    }, 1500);
  };

  // ── Helper: format ms to seconds ──────────────────────────────────
  const msToSec = (ms: number) => (ms / 1000).toFixed(2) + "s";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 flex flex-col">
      {/* ═══════════════════════════════════════════════════════════
          HEADER SECTION — Top Grid Block
          ═══════════════════════════════════════════════════════════ */}
      <header className="border border-gray-800 rounded-none">
        {/* Top status bar */}
        <div className="border-b border-gray-800 px-6 py-2 flex justify-between items-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gray-600">
            sys::optiengine_v0.1.0
          </span>
          <div className="flex gap-4 items-center">
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
              status:
              <span className="text-green-500 ml-1">■</span>
              <span className="ml-1">online</span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
              mode: intercept
            </span>
          </div>
        </div>

        {/* Main title block */}
        <div className="px-6 py-12 md:py-16 lg:py-20">
          <h1
            className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter leading-none text-white"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            OPTIENGINE
          </h1>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:gap-6">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-gray-500">
              Algorithmic Optimization Engine // Intercept &amp; Upgrade
            </p>
            <div className="hidden sm:block h-px flex-1 bg-gray-800" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mt-1 sm:mt-0">
              build::2026.02.28
            </p>
          </div>
        </div>

        {/* Grid decoration row */}
        <div className="grid grid-cols-4 border-t border-gray-800">
          {["PARSE", "TOKENIZE", "OPTIMIZE", "DEPLOY"].map((label) => (
            <div
              key={label}
              className="border-r border-gray-800 last:border-r-0 px-4 py-2 text-center"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">
                {label}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT — Middle Grid Blocks
          ═══════════════════════════════════════════════════════════ */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* Left: Input + Button */}
        <div className="flex flex-col border border-gray-800 border-t-0">
          {/* Input label bar */}
          <div className="border-b border-gray-800 px-6 py-2 flex justify-between items-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gray-500">
              input::prompt_source
            </span>
            <span className="font-mono text-[10px] text-gray-600">
              {prompt.length} chars
            </span>
          </div>

          {/* Textarea container */}
          <div className="flex-1 focus-within:bg-gray-900 transition-colors duration-200">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="// Enter your prompt here for algorithmic optimization..."
              className="w-full h-full min-h-[240px] lg:min-h-[320px] bg-transparent p-6 font-mono text-sm text-gray-300 placeholder-gray-700 focus:outline-none resize-none"
            />
          </div>

          {/* Action Button — Bottom Grid Block of Input */}
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || loading}
            className={`
              border-t border-gray-800 font-mono uppercase tracking-[0.25em] text-sm py-4 px-6
              transition-all duration-100 text-left
              ${loading
                ? "bg-blue-600 text-white animate-brutalist-pulse cursor-wait"
                : !prompt.trim()
                  ? "bg-gray-900 text-gray-700 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-white hover:text-black cursor-pointer"
              }
            `}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-blink">▌</span>
                {">> INTERCEPTING_PROMPT..."}
              </span>
            ) : (
              ">> EXECUTE_OPTIMIZATION"
            )}
          </button>
        </div>

        {/* Right: Info / Status Panel */}
        <div className="flex flex-col border border-gray-800 border-t-0 lg:border-l-0">
          {/* Panel header */}
          <div className="border-b border-gray-800 px-6 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gray-500">
              output::result_stream
            </span>
          </div>

          {/* ─── CONDITIONAL RESULT AREA ─────────────────────────── */}
          <div className="flex-1 font-mono text-sm">
            {result ? (
              /* ═══ SPLIT-SCREEN RESULT VIEW ═══════════════════════ */
              <div className="flex flex-col h-full">
                {/* Top Result Header — Problem type + Confidence */}
                <div className="border-b border-gray-800 px-4 py-3 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 block">
                      problem_type
                    </span>
                    <span className="text-white text-base font-bold">
                      {result.problem_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 block">
                      match_confidence
                    </span>
                    <span className="text-emerald-400 text-2xl font-bold">
                      {result.match_confidence}
                    </span>
                  </div>
                </div>

                {/* ─── Split Grid: Naive vs OptiEngine ────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 flex-1">
                  {/* Column A — Naive AI (Left) */}
                  <div className="border-b md:border-b-0 md:border-r border-gray-800 flex flex-col">
                    {/* Title bar */}
                    <div className="border-b border-gray-800 px-4 py-2 bg-gray-900/50">
                      <span className="text-red-500 text-sm uppercase tracking-[0.2em]">
                        [ NAIVE_AI_APPROACH ]
                      </span>
                    </div>
                    {/* Stats grid */}
                    <div className="flex flex-col flex-1">
                      {/* Time Complexity */}
                      <div className="border-b border-gray-800 px-4 py-3">
                        <span className="text-[10px] uppercase tracking-widest text-gray-600 block">
                          Time Complexity
                        </span>
                        <span className="text-red-500 text-xl font-bold">
                          {result.naive_approach.complexity}
                        </span>
                      </div>
                      {/* Tokens Wasted */}
                      <div className="border-b border-gray-800 px-4 py-3">
                        <span className="text-[10px] uppercase tracking-widest text-gray-600 block">
                          Tokens Wasted
                        </span>
                        <span className="text-red-500 text-xl font-bold">
                          {result.naive_approach.tokens_used.toLocaleString()}
                        </span>
                      </div>
                      {/* Execution Time */}
                      <div className="px-4 py-3">
                        <span className="text-[10px] uppercase tracking-widest text-gray-600 block">
                          Execution Time
                        </span>
                        <span className="text-red-500 text-xl font-bold">
                          {msToSec(result.naive_approach.execution_time_ms)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column B — OptiEngine (Right) */}
                  <div className="flex flex-col">
                    {/* Title bar */}
                    <div className="border-b border-gray-800 px-4 py-2 bg-gray-900/50">
                      <span className="text-emerald-400 text-sm uppercase tracking-[0.2em]">
                        [ OPTIENGINE_OPTIMIZED ]
                      </span>
                    </div>
                    {/* Stats grid */}
                    <div className="flex flex-col">
                      {/* Upgraded Complexity */}
                      <div className="border-b border-gray-800 px-4 py-3">
                        <span className="text-[10px] uppercase tracking-widest text-gray-600 block">
                          Upgraded Complexity
                        </span>
                        <span className="text-emerald-400 text-xl font-bold">
                          {result.optiengine_approach.complexity}
                        </span>
                      </div>
                      {/* Tokens Used */}
                      <div className="border-b border-gray-800 px-4 py-3">
                        <span className="text-[10px] uppercase tracking-widest text-gray-600 block">
                          Tokens Used
                        </span>
                        <span className="text-emerald-400 text-xl font-bold">
                          {result.optiengine_approach.tokens_used}
                        </span>
                      </div>
                      {/* Execution Time */}
                      <div className="border-b border-gray-800 px-4 py-3">
                        <span className="text-[10px] uppercase tracking-widest text-gray-600 block">
                          Execution Time
                        </span>
                        <span className="text-emerald-400 text-xl font-bold">
                          {msToSec(result.optiengine_approach.execution_time_ms)}
                        </span>
                      </div>
                    </div>

                    {/* Code Snippet — Terminal Block */}
                    <div className="border-t border-emerald-900 bg-black flex-1 flex flex-col">
                      <div className="border-b border-gray-800 px-4 py-2 flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-gray-600">
                          code_snippet
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-emerald-400/60">
                          {result.optiengine_approach.language}
                        </span>
                      </div>
                      <pre className="px-4 py-3 text-xs text-emerald-400/80 leading-relaxed overflow-auto flex-1 whitespace-pre">
                        {result.optiengine_approach.code_snippet}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="flex flex-col gap-3 text-gray-600 p-6">
                <div className="h-3 w-3/4 bg-gray-800 animate-brutalist-pulse" />
                <div className="h-3 w-1/2 bg-gray-800 animate-brutalist-pulse" />
                <div className="h-3 w-2/3 bg-gray-800 animate-brutalist-pulse" />
                <p className="mt-4 text-[10px] uppercase tracking-widest text-gray-600">
                  processing pipeline active...
                </p>
              </div>
            ) : (
              <div className="text-gray-700 flex flex-col gap-2 p-6">
                <p className="text-[10px] uppercase tracking-widest">
                  awaiting input...
                </p>
                <div className="mt-4 border border-gray-800 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                    capabilities
                  </p>
                  {[
                    "Prompt compression",
                    "Token optimization",
                    "Clarity enhancement",
                    "Latency reduction",
                  ].map((cap) => (
                    <div
                      key={cap}
                      className="py-1 border-b border-gray-800 last:border-b-0 text-xs text-gray-500"
                    >
                      → {cap}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 border-t border-gray-800">
            {[
              { label: "Tokens", value: prompt.split(/\s+/).filter(Boolean).length.toString() },
              { label: "Latency", value: result ? msToSec(result.optiengine_approach.execution_time_ms) : loading ? "..." : "—" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="border-r border-gray-800 last:border-r-0 px-4 py-3"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600 block">
                  {label}
                </span>
                <span className="font-mono text-lg text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════
          FOOTER — Bottom Grid Block
          ═══════════════════════════════════════════════════════════ */}
      <footer className="border border-gray-800 border-t-0 grid grid-cols-2 md:grid-cols-4">
        {[
          { label: "Engine", value: "OptiEngine v0.1" },
          { label: "Protocol", value: "INTERCEPT/2.0" },
          { label: "Uptime", value: "99.97%" },
          { label: "Region", value: "GLOBAL-EDGE" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="border-r border-gray-800 last:border-r-0 px-4 py-3"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600 block">
              {label}
            </span>
            <span className="font-mono text-xs text-gray-400">{value}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}
