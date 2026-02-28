"""
scripts/seed_nexus_synth.py
----------------------------
Seeds project-specific guidelines for:
  - Nexus Web  (enterprise ecommerce dashboard)
  - Synth AI   (AI content generator)

Run AFTER seed_guidelines.py (which handles Global + domain-level rules).
This script adds the project-scoped rules that are specific to each product.

Usage:
    python scripts/seed_nexus_synth.py
"""

import os
import sys
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
INGEST_URL = f"{BASE_URL}/api/v1/ingest"
HEALTH_URL = f"{BASE_URL}/api/v1/health"
API_KEY = os.getenv("INGEST_API_KEY")

if not API_KEY:
    print("ERROR: INGEST_API_KEY is not set in your .env file.")
    sys.exit(1)

HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# ====================================================================
# NEXUS WEB — Enterprise Ecommerce Dashboard
# Domain: Web  |  Project: NexusWeb
# Focus: Databases, Sales APIs, UI State, Dashboard Performance
# ====================================================================

NEXUS_GUIDELINES = [

    # ── UI State Management ──────────────────────────────────────────

    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "State Management — Architecture",
        "rule_text": (
            "Use Zustand for all global client-side state in Nexus Web. "
            "Redux is not approved. Server state (API responses, sales data, order lists) "
            "MUST be managed exclusively with React Query (TanStack Query v5). "
            "Never store server-fetched data in Zustand — Zustand is for UI state only "
            "(sidebar open/closed, active filters, modal state, theme)."
        ),
    },
    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "State Management — Slices",
        "rule_text": (
            "Each Zustand store must be split into feature slices — one slice per domain "
            "(e.g., useCartStore, useFilterStore, useDashboardUIStore). "
            "Never create a single monolithic store. "
            "Each slice must be defined in its own file under src/store/slices/."
        ),
    },
    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "React Query — Cache Configuration",
        "rule_text": (
            "All React Query hooks in Nexus Web must explicitly set staleTime and gcTime. "
            "Sales summary data: staleTime=5min. Order lists: staleTime=1min. "
            "Product catalog: staleTime=10min. "
            "Never use the default staleTime=0 for dashboard data — it causes "
            "unnecessary refetches on every focus event in a multi-tab enterprise environment."
        ),
    },
    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "Optimistic Updates",
        "rule_text": (
            "All mutation hooks (order status updates, inventory edits) MUST implement "
            "optimistic updates using React Query's onMutate/onError/onSettled pattern. "
            "Never make the user wait for a server round-trip for status changes. "
            "Always roll back on error and surface a toast notification."
        ),
    },

    # ── Database & API Layer ─────────────────────────────────────────

    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "API Layer — Abstraction",
        "rule_text": (
            "All API calls in Nexus Web MUST go through the centralized API client "
            "at src/lib/apiClient.ts. Never call fetch() or axios directly from a component "
            "or hook. The API client handles auth headers, base URL, error normalization, "
            "and request timeout (default 10s). "
            "Each endpoint gets its own typed function in src/api/<domain>.ts."
        ),
    },
    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "Sales Data — Pagination",
        "rule_text": (
            "All sales and order list endpoints MUST use cursor-based pagination, not offset. "
            "Never load more than 50 records per page in the dashboard. "
            "Use React Query's useInfiniteQuery for scrollable lists. "
            "Offset pagination is forbidden for any table with more than 1000 potential rows."
        ),
    },
    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "Database Queries — Performance",
        "rule_text": (
            "All database queries that power dashboard charts or KPI cards MUST be "
            "pre-aggregated views or materialized views — never raw row scans at request time. "
            "Any query touching the orders table must include an indexed date range filter. "
            "N+1 query patterns are forbidden — use JOIN or batch loading. "
            "Query execution time must be logged; anything over 500ms triggers a warning log."
        ),
    },
    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "API Error Handling — Dashboard",
        "rule_text": (
            "Every React Query hook in Nexus Web must handle three states explicitly: "
            "loading (show skeleton, never spinner on data that was previously loaded), "
            "error (show inline error with retry button, never crash the whole dashboard), "
            "empty (show a meaningful empty state, never a blank panel). "
            "Use ErrorBoundary at the widget level, not at the page level."
        ),
    },

    # ── Dashboard UI ─────────────────────────────────────────────────

    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "Chart Components — Library",
        "rule_text": (
            "All charts in Nexus Web MUST use Recharts. D3 direct DOM manipulation is "
            "forbidden in React components. "
            "Every chart component must accept a loading prop that renders a skeleton. "
            "Charts must be wrapped in ResponsiveContainer — never hardcode pixel dimensions. "
            "Chart color palettes must use the design token scale, never arbitrary hex values."
        ),
    },
    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "Performance — Code Splitting",
        "rule_text": (
            "All dashboard route components must be lazy-loaded using React.lazy() and Suspense. "
            "The initial bundle must not exceed 200KB gzipped. "
            "Heavy components (data tables, chart dashboards, export modals) must be "
            "dynamically imported. Use Next.js dynamic() with ssr:false for client-only widgets."
        ),
    },
    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "TypeScript — Data Contracts",
        "rule_text": (
            "All API response shapes in Nexus Web must have corresponding TypeScript interfaces "
            "defined in src/types/api.ts. Never use 'any' for API response types. "
            "Use Zod for runtime validation of all external API responses before they enter "
            "React Query cache. If a response fails Zod validation, log the mismatch and "
            "surface a user-facing error rather than silently passing malformed data."
        ),
    },
    {
        "domain": "Web",
        "project": "NexusWeb",
        "topic": "Role-Based Access — UI",
        "rule_text": (
            "All dashboard sections must check user role before rendering sensitive data. "
            "Revenue figures, customer PII, and margin data are visible to 'admin' and "
            "'manager' roles only. Use a usePermission(role) hook — never inline role checks "
            "in JSX. Unauthorized sections must render a PermissionGate component, "
            "never return null silently."
        ),
    },

]


# ====================================================================
# SYNTH AI — AI Content Generator
# Domain: AI  |  Project: SynthAI
# Focus: LLM Integration, Prompt Handling, Streaming, AI Safety
# ====================================================================

SYNTH_GUIDELINES = [

    # ── LLM Integration ──────────────────────────────────────────────

    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "LLM Client — Abstraction Layer",
        "rule_text": (
            "Never call any LLM provider SDK (OpenAI, Anthropic, Groq) directly from "
            "a route handler or service. All LLM calls MUST go through the centralized "
            "LLMClient abstraction at app/llm/client.py. "
            "This abstraction handles provider switching, retry logic, timeout enforcement, "
            "token counting, and cost logging. "
            "The provider must be configurable via environment variable (LLM_PROVIDER), "
            "not hardcoded."
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "LLM — Model Selection",
        "rule_text": (
            "Synth AI uses a tiered model strategy. "
            "Short-form content (< 500 tokens output): use groq/llama3-8b-8192 for latency. "
            "Long-form content (articles, reports): use claude-3-5-haiku or gpt-4o-mini. "
            "Never use GPT-4o or Claude Opus for bulk generation — cost will be unacceptable. "
            "Model selection must be driven by content_type in the request, not hardcoded per route."
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Token Budget — Enforcement",
        "rule_text": (
            "Every LLM call in Synth AI must enforce an explicit max_tokens budget. "
            "Content generation endpoints: max 2048 output tokens. "
            "Summary endpoints: max 512 tokens. "
            "Never pass max_tokens=None or omit it. "
            "If the user requests output that would exceed the budget, split into chunks "
            "rather than removing the limit. Log estimated cost per request."
        ),
    },

    # ── Prompt Handling ──────────────────────────────────────────────

    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Prompt Architecture — System / User Separation",
        "rule_text": (
            "All prompts in Synth AI MUST use the structured message array format "
            "(system / user / assistant roles). Never construct prompts by concatenating "
            "strings or f-strings that mix system instructions with user input. "
            "System prompts live in app/prompts/<feature>.py as versioned constants. "
            "User input is always passed as the 'user' role message, never injected "
            "into the system prompt."
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Prompt Injection Defense",
        "rule_text": (
            "All user-supplied text passed to an LLM must be sanitized before use. "
            "Run the input through the PromptSanitizer at app/safety/sanitizer.py. "
            "This checks for role-override attempts, instruction-injection patterns, "
            "and jailbreak signals. Flagged inputs must be logged with severity=WARNING "
            "and the request rejected with HTTP 422 and error code PROMPT_INJECTION_DETECTED. "
            "Never silently pass a flagged prompt to the LLM."
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Prompt Versioning",
        "rule_text": (
            "Every system prompt in Synth AI must have a version identifier (e.g., BLOG_V2, "
            "SUMMARY_V3). When a prompt is changed, the old version must be kept in git history "
            "with a comment explaining what changed and why. "
            "The active version must be logged with every LLM call so production issues "
            "can be traced to the exact prompt version that was active."
        ),
    },

    # ── Response Streaming ───────────────────────────────────────────

    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Streaming — Server-Sent Events",
        "rule_text": (
            "All content generation endpoints in Synth AI that return more than 100 tokens "
            "MUST stream the response using Server-Sent Events (SSE). "
            "Never buffer a full LLM response and return it as a single JSON body — "
            "this causes unacceptable perceived latency. "
            "Use FastAPI's StreamingResponse with media_type='text/event-stream'. "
            "Each SSE chunk must follow the format: data: {json_chunk}\\n\\n"
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Streaming — Frontend Consumption",
        "rule_text": (
            "The Synth AI frontend MUST consume streaming responses using the EventSource API "
            "or fetch with ReadableStream — never polling. "
            "Display content progressively as chunks arrive, do not buffer client-side. "
            "Implement a stop generation button that closes the stream and cancels the "
            "server-side request via an AbortController. "
            "Always show a streaming indicator (blinking cursor or typing animation)."
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Streaming — Error Handling",
        "rule_text": (
            "Streaming endpoints must handle mid-stream errors gracefully. "
            "If the LLM provider errors mid-generation, send a final SSE event with "
            "event: error and a user-friendly message before closing the stream. "
            "Never let a streaming connection hang open indefinitely — enforce a "
            "60-second hard timeout on the LLM call. "
            "The client must handle the error event and show a retry option."
        ),
    },

    # ── AI Safety ────────────────────────────────────────────────────

    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Output Moderation — Content Safety",
        "rule_text": (
            "All LLM-generated content MUST pass through the output moderation layer at "
            "app/safety/moderator.py before being returned to the user or stored. "
            "This checks for: harmful instructions, PII leakage, hallucinated citations, "
            "and policy violations. "
            "Content that fails moderation must be blocked and logged with the full "
            "prompt + response pair for review. Never surface unmoderated AI output."
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Hallucination Mitigation",
        "rule_text": (
            "Synth AI content generation prompts must include explicit anti-hallucination "
            "instructions: 'If you are uncertain about a fact, state the uncertainty explicitly. "
            "Do not invent citations, statistics, or quotes.' "
            "For factual content types (news summaries, research), temperature must be set "
            "to 0.2 or lower. For creative content, temperature must not exceed 0.9. "
            "Temperature must always be explicit — never rely on provider defaults."
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "PII — AI Pipeline",
        "rule_text": (
            "User-supplied inputs to Synth AI content generation must never include PII "
            "that gets forwarded to external LLM APIs. "
            "Run inputs through the PII detector at app/safety/pii_detector.py before "
            "any external API call. Detected PII must be anonymized or rejected. "
            "Store only anonymized versions of prompts in generation logs. "
            "This applies to all providers — OpenAI, Anthropic, Groq, and any future additions."
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "Rate Limiting — LLM Endpoints",
        "rule_text": (
            "All content generation endpoints must enforce per-user rate limits. "
            "Free tier: 10 generations per hour. Pro tier: 100 per hour. "
            "Use a Redis sliding window counter, not in-memory (won't survive restarts). "
            "Return 429 with a JSON body containing: limit, remaining, reset_at (UTC timestamp). "
            "Implement exponential backoff guidance in the error response."
        ),
    },
    {
        "domain": "AI",
        "project": "SynthAI",
        "topic": "LLM Response Validation",
        "rule_text": (
            "Never trust raw LLM output for structured data. "
            "When Synth AI requests structured output (JSON, metadata, tags), "
            "always validate the response through a Pydantic schema. "
            "Implement retry logic (max 2 retries) for malformed structured responses "
            "before surfacing an error. "
            "Log malformed response rate per prompt version — a rate above 5% means "
            "the prompt needs improvement."
        ),
    },

]


# ====================================================================
# Seeder
# ====================================================================

ALL_GUIDELINES = [
    ("Nexus Web", NEXUS_GUIDELINES),
    ("Synth AI",  SYNTH_GUIDELINES),
]


def wait_for_server(max_attempts: int = 8) -> bool:
    for attempt in range(max_attempts):
        try:
            r = httpx.get(HEALTH_URL, timeout=3)
            if r.status_code == 200:
                print(f"Server healthy. Collections: {r.json().get('collections', [])}\n")
                return True
        except httpx.ConnectError:
            pass
        print(f"  Waiting for server... attempt {attempt+1}/{max_attempts}")
        time.sleep(2)
    return False


def seed():
    print("\n╔══════════════════════════════════════════════════╗")
    print("║   OptiEngine — Nexus Web + Synth AI Seeder      ║")
    print("╚══════════════════════════════════════════════════╝\n")

    if not wait_for_server():
        print("ERROR: Server not reachable. Run: uvicorn main:app --port 8000")
        sys.exit(1)

    total_success = 0
    total_failed  = 0

    with httpx.Client(timeout=30) as client:
        for project_name, guidelines in ALL_GUIDELINES:
            print(f"── {project_name} ({len(guidelines)} rules) ──────────────────────")
            for i, rule in enumerate(guidelines, 1):
                try:
                    r = client.post(INGEST_URL, headers=HEADERS, json=rule)
                    if r.status_code == 200:
                        doc_id = r.json().get("doc_id", "?")
                        print(f"  [{i:02d}] ✓  [{rule['domain']:6s}] {rule['topic']:<45s} {doc_id[:10]}...")
                        total_success += 1
                    else:
                        print(f"  [{i:02d}] ✗  [{rule['domain']:6s}] {rule['topic']:<45s} HTTP {r.status_code}")
                        print(f"        {r.text[:120]}")
                        total_failed += 1
                except Exception as e:
                    print(f"  [{i:02d}] ✗  Error: {e}")
                    total_failed += 1
            print()

    print(f"{'─'*60}")
    print(f"  Total ingested : {total_success}")
    print(f"  Total failed   : {total_failed}")
    print(f"\n  View Nexus rules : {BASE_URL}/api/v1/rules?domain=Web")
    print(f"  View Synth rules : {BASE_URL}/api/v1/rules?domain=AI\n")


if __name__ == "__main__":
    seed()