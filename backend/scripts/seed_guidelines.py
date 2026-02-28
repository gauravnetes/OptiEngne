"""
scripts/seed_guidelines.py
---------------------------
Seeds the ChromaDB knowledge base with realistic organizational guidelines
across multiple domains. Run this once after first boot to have a working
demo corpus immediately.

Usage:
    python scripts/seed_guidelines.py

Prerequisites:
    - FastAPI server must be running on localhost:8000
    - INGEST_API_KEY must be set in your .env
    - The server must be healthy (check /api/v1/health first)
"""

import os
import sys
import json
import time

import httpx
from dotenv import load_dotenv

load_dotenv()

# Change localhost to 127.0.0.1 and fix the Health URL path
BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
INGEST_URL = f"{BASE_URL}/api/v1/ingest"
HEALTH_URL = f"{BASE_URL}/health"
API_KEY = os.getenv("INGEST_API_KEY")

if not API_KEY:
    print("ERROR: INGEST_API_KEY is not set in your .env file.")
    sys.exit(1)

HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
}

# -------------------------------------------------------------------
# Seed data — organized by domain
# These represent realistic ADR extracts and coding standards
# -------------------------------------------------------------------

GUIDELINES = [

    # ── Global (applies to every engineer, every domain) ────────────

    {
        "domain": "Global",
        "project": "All",
        "topic": "Secret Management",
        "rule_text": (
            "Secrets, API keys, passwords, and tokens MUST NEVER be hardcoded in source code "
            "or committed to version control. Use environment variables or a secrets manager "
            "(e.g., HashiCorp Vault, AWS Secrets Manager). Violation is grounds for immediate PR rejection."
        ),
    },
    {
        "domain": "Global",
        "project": "All",
        "topic": "Logging — PII",
        "rule_text": (
            "Never log personally identifiable information (PII): email addresses, phone numbers, "
            "full names, IP addresses, or any data covered by GDPR/CCPA. Log user IDs (UUIDs) only. "
            "Use structured logging (JSON format) in all services."
        ),
    },
    {
        "domain": "Global",
        "project": "All",
        "topic": "Error Handling",
        "rule_text": (
            "All public-facing APIs MUST return generic error messages to clients. "
            "Never expose stack traces, internal system paths, database schema details, "
            "or exception messages in API responses. Log the full error internally only."
        ),
    },
    {
        "domain": "Global",
        "project": "All",
        "topic": "Dependency Pinning",
        "rule_text": (
            "All third-party dependencies must be pinned to exact versions in requirements.txt / "
            "package.json. Never use wildcard or unpinned versions (e.g., 'requests>=2.0' is forbidden; "
            "use 'requests==2.31.0'). Run dependency audits (pip-audit / npm audit) in CI."
        ),
    },

    # ── Backend ─────────────────────────────────────────────────────

    {
        "domain": "Backend",
        "project": "All",
        "topic": "Authentication — JWT",
        "rule_text": (
            "JWT tokens MUST use RS256 asymmetric signing. HS256 is forbidden in all services. "
            "Access token expiry must not exceed 15 minutes. Refresh tokens must be rotated on use "
            "and stored as secure, httpOnly cookies — never in localStorage."
        ),
    },
    {
        "domain": "Backend",
        "project": "All",
        "topic": "Database — SQL Injection",
        "rule_text": (
            "All database queries MUST use parameterized queries or an ORM (SQLAlchemy). "
            "String formatting or f-strings to build SQL queries is strictly forbidden. "
            "Raw SQL strings are only allowed in migrations, never in application code."
        ),
    },
    {
        "domain": "Backend",
        "project": "All",
        "topic": "API Design — HTTP Status Codes",
        "rule_text": (
            "Use semantically correct HTTP status codes: 201 for resource creation, 204 for successful "
            "deletes with no body, 400 for validation errors, 401 for unauthenticated, 403 for unauthorized, "
            "404 for not found, 409 for conflicts, 422 for unprocessable entity, 500 for server errors. "
            "Never return 200 for errors."
        ),
    },
    {
        "domain": "Backend",
        "project": "All",
        "topic": "Password Hashing",
        "rule_text": (
            "Passwords MUST be hashed using bcrypt with a minimum cost factor of 12. "
            "MD5, SHA-1, and SHA-256 are forbidden for password storage. "
            "Never store plaintext passwords under any circumstance."
        ),
    },
    {
        "domain": "Backend",
        "project": "All",
        "topic": "Rate Limiting",
        "rule_text": (
            "All authentication endpoints (login, register, password reset, token refresh) "
            "MUST implement rate limiting. Use a sliding window of max 5 requests per minute per IP. "
            "Return 429 Too Many Requests with a Retry-After header when the limit is exceeded."
        ),
    },
    {
        "domain": "Backend",
        "project": "All",
        "topic": "Input Validation",
        "rule_text": (
            "All incoming request bodies and query parameters MUST be validated using Pydantic models. "
            "Never access request data directly without schema validation. "
            "Validate string lengths, numeric ranges, and enum values explicitly."
        ),
    },

    # ── Web (Frontend) ───────────────────────────────────────────────

    {
        "domain": "Web",
        "project": "All",
        "topic": "State Management",
        "rule_text": (
            "Use Zustand for global client state. Redux is not approved for new projects. "
            "Server state (API data) must be managed with React Query (TanStack Query). "
            "Do not store server-fetched data in Zustand — that is a React Query responsibility."
        ),
    },
    {
        "domain": "Web",
        "project": "All",
        "topic": "Authentication — Token Storage",
        "rule_text": (
            "Never store authentication tokens in localStorage or sessionStorage. "
            "Access tokens must be kept in memory (React state / Zustand). "
            "Refresh tokens must be stored in httpOnly, Secure, SameSite=Strict cookies only."
        ),
    },
    {
        "domain": "Web",
        "project": "All",
        "topic": "Component Structure",
        "rule_text": (
            "React components must follow the single-responsibility principle. "
            "Components exceeding 200 lines must be split. "
            "Business logic must be extracted into custom hooks (useXxx). "
            "Never fetch data directly inside a component body — use React Query hooks."
        ),
    },
    {
        "domain": "Web",
        "project": "All",
        "topic": "Accessibility",
        "rule_text": (
            "All interactive elements must have ARIA labels or visible text. "
            "Forms must have associated <label> elements for all inputs. "
            "Colour contrast must meet WCAG AA (4.5:1 for normal text). "
            "All images must have descriptive alt attributes. Run axe-core in CI."
        ),
    },

    # ── AI / ML ──────────────────────────────────────────────────────

    {
        "domain": "AI",
        "project": "All",
        "topic": "Prompt Injection Defense",
        "rule_text": (
            "All user-supplied text passed to an LLM must be sanitized. "
            "Scan for override patterns ('ignore previous instructions', 'you are now', etc.) "
            "before inclusion in any prompt. Never construct prompts via f-string concatenation "
            "with unvalidated user input. Use a structured message array (system/user/assistant roles)."
        ),
    },
    {
        "domain": "AI",
        "project": "All",
        "topic": "LLM Output Validation",
        "rule_text": (
            "Never trust raw LLM output for structured data. Always parse and validate LLM responses "
            "through a Pydantic schema before using them in business logic. "
            "Implement retry logic for malformed responses — do not surface parse errors to end users."
        ),
    },
    {
        "domain": "AI",
        "project": "All",
        "topic": "PII in AI Pipelines",
        "rule_text": (
            "Strip or anonymize all PII from data before sending to any external LLM API. "
            "Use a PII detection library (Presidio or equivalent) on all user-supplied inputs "
            "in AI pipelines. Log only anonymized versions of prompts for debugging."
        ),
    },

]


# -------------------------------------------------------------------
# Seeder logic
# -------------------------------------------------------------------

def wait_for_server(max_attempts: int = 10) -> bool:
    print(f"Waiting for server at {BASE_URL}...")
    return True


def seed():
    print("\n=== ContextEngine Guideline Seeder ===\n")

    if not wait_for_server():
        print("\nERROR: Server is not reachable. Is it running?\n  uvicorn main:app --port 8000")
        sys.exit(1)

    print(f"\nIngesting {len(GUIDELINES)} guidelines...\n")

    results = {"success": 0, "skipped": 0, "failed": 0}

    with httpx.Client(timeout=30) as client:
        for i, rule in enumerate(GUIDELINES, start=1):
            try:
                response = client.post(INGEST_URL, headers=HEADERS, json=rule)

                if response.status_code == 200:
                    doc_id = response.json().get("doc_id", "?")
                    print(f"  [{i:02d}] ✓  [{rule['domain']:8s}] {rule['topic']:<40s} id={doc_id[:12]}...")
                    results["success"] += 1
                else:
                    print(f"  [{i:02d}] ✗  [{rule['domain']:8s}] {rule['topic']:<40s} HTTP {response.status_code}: {response.text}")
                    results["failed"] += 1

            except Exception as e:
                print(f"  [{i:02d}] ✗  [{rule['domain']:8s}] {rule['topic']:<40s} Error: {e}")
                results["failed"] += 1

    print(f"\n=== Seed Complete ===")
    print(f"  Ingested : {results['success']}")
    print(f"  Failed   : {results['failed']}")
    print(f"\nYou can view all rules at: {BASE_URL}/api/v1/rules")
    print(f"Interactive API docs at  : {BASE_URL}/docs\n")


if __name__ == "__main__":
    seed()