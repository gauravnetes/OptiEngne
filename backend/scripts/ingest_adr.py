"""
scripts/ingest_adr.py
─────────────────────
Reads an ADR (markdown file or stdin), uses Groq to extract
atomic enforceable rules, shows them for approval, then
ingests approved rules into OptiEngine via /api/v1/ingest.

Usage:
  # From a file
  python scripts/ingest_adr.py --file docs/adr/0012-state-management.md --domain Web --project NexusWeb

  # Paste text directly (opens editor)
  python scripts/ingest_adr.py --domain AI --project SynthAI

  # Fully automatic, no approval prompt (CI mode)
  python scripts/ingest_adr.py --file docs/adr/0012.md --domain Web --auto
"""

import argparse
import json
import os
import sys
import tempfile
import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL   = os.getenv("API_BASE_URL", "http://localhost:8000")
INGEST_URL = f"{BASE_URL}/api/v1/ingest"
HEALTH_URL = f"{BASE_URL}/api/v1/health"
INGEST_KEY = os.getenv("INGEST_API_KEY")
GROQ_KEY   = os.getenv("GROQ_API_KEY")

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
MODEL      = "llama-3.1-8b-instant"

VALID_DOMAINS  = ["Global", "Web", "Backend", "AI", "Mobile", "Data", "DevOps"]

EXTRACT_SYSTEM = """You are a Staff Engineer extracting enforceable coding standards from Architecture Decision Records (ADRs) or technical documentation.

Your job: read the document and extract ATOMIC, SPECIFIC, ENFORCEABLE rules that a code generator must follow.

Rules for good rule extraction:
- Each rule must be ONE specific requirement (not "follow good practices")
- Each rule must be actionable by a code generator
- Use MUST / MUST NOT / ALWAYS / NEVER language
- Include the WHY briefly if it helps enforcement
- Ignore rationale sections, history, and background — extract only requirements
- Extract 5-15 rules per document

Return ONLY a JSON array. No explanation, no markdown, no preamble.

Format:
[
  {
    "topic": "Short descriptive topic (e.g. 'State Management — Library')",
    "rule_text": "Full enforceable rule text using MUST/NEVER language..."
  },
  ...
]"""


def check_server() -> bool:
    try:
        r = httpx.get(HEALTH_URL, timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def extract_rules_with_groq(adr_text: str, domain: str) -> list[dict]:
    if not GROQ_KEY:
        print("ERROR: GROQ_API_KEY not set in .env")
        sys.exit(1)

    user_msg = f"Domain context: {domain}\n\nDocument:\n\n{adr_text[:8000]}"

    r = httpx.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": EXTRACT_SYSTEM},
                {"role": "user",   "content": user_msg},
            ],
            "temperature": 0.1,
            "max_tokens": 2048,
        },
        timeout=30,
    )

    if r.status_code != 200:
        print(f"ERROR: Groq returned {r.status_code}: {r.text[:200]}")
        sys.exit(1)

    raw = r.json()["choices"][0]["message"]["content"].strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]

    try:
        rules = json.loads(raw)
        if not isinstance(rules, list):
            raise ValueError("Expected a JSON array")
        return rules
    except Exception as e:
        print(f"ERROR: Groq returned malformed JSON: {e}")
        print(f"Raw output:\n{raw[:500]}")
        sys.exit(1)


def print_rules(rules: list[dict], domain: str, project: str):
    print(f"\n{'─'*60}")
    print(f"  Extracted {len(rules)} rules  |  domain={domain}  |  project={project}")
    print(f"{'─'*60}")
    for i, rule in enumerate(rules, 1):
        print(f"\n  [{i:02d}] {rule.get('topic', 'No topic')}")
        text = rule.get("rule_text", "")
        # Word-wrap at 70 chars
        words = text.split()
        line = "       "
        for word in words:
            if len(line) + len(word) > 72:
                print(line)
                line = "       " + word + " "
            else:
                line += word + " "
        if line.strip():
            print(line)
    print(f"\n{'─'*60}")


def approve_rules(rules: list[dict]) -> list[dict]:
    print("\n  Review extracted rules.")
    print("  Press ENTER to approve all, or enter rule numbers to SKIP (e.g. '2 5 7'):")
    print("  (or type 'abort' to cancel)\n")

    choice = input("  > ").strip().lower()

    if choice == "abort":
        print("  Aborted.")
        sys.exit(0)

    if not choice:
        return rules

    skip_indices = set()
    for part in choice.split():
        try:
            skip_indices.add(int(part) - 1)
        except ValueError:
            pass

    approved = [r for i, r in enumerate(rules) if i not in skip_indices]
    skipped  = len(rules) - len(approved)
    print(f"\n  Approved {len(approved)} rules, skipped {skipped}.")
    return approved


def ingest_rules(rules: list[dict], domain: str, project: str) -> tuple[int, int]:
    if not INGEST_KEY:
        print("ERROR: INGEST_API_KEY not set in .env")
        sys.exit(1)

    headers = {"X-API-Key": INGEST_KEY, "Content-Type": "application/json"}
    success = 0
    failed  = 0

    print(f"\n  Ingesting {len(rules)} rules into OptiEngine...\n")

    with httpx.Client(timeout=30) as client:
        for i, rule in enumerate(rules, 1):
            payload = {
                "domain":    domain,
                "project":   project,
                "topic":     rule.get("topic", f"Rule {i}"),
                "rule_text": rule.get("rule_text", ""),
            }
            try:
                r = client.post(INGEST_URL, headers=headers, json=payload)
                if r.status_code == 200:
                    doc_id = r.json().get("doc_id", "?")
                    print(f"  ✓  [{i:02d}] {rule.get('topic', '')[:50]:<50} {doc_id[:8]}...")
                    success += 1
                else:
                    print(f"  ✗  [{i:02d}] {rule.get('topic', '')[:50]:<50} HTTP {r.status_code}")
                    failed += 1
            except Exception as e:
                print(f"  ✗  [{i:02d}] Error: {e}")
                failed += 1

    return success, failed


def read_from_editor() -> str:
    print("  No file specified. Opening editor to paste ADR text...")
    print("  (paste your ADR, save and close the editor)\n")
    import subprocess

    with tempfile.NamedTemporaryFile(suffix=".md", mode="w", delete=False) as f:
        f.write("# Paste your ADR or technical documentation here\n\n")
        tmpfile = f.name

    editor = os.environ.get("EDITOR", "notepad" if sys.platform == "win32" else "nano")
    subprocess.call([editor, tmpfile])

    with open(tmpfile) as f:
        content = f.read()

    os.unlink(tmpfile)
    return content


def main():
    parser = argparse.ArgumentParser(description="Ingest an ADR into OptiEngine")
    parser.add_argument("--file",    "-f", help="Path to ADR markdown file")
    parser.add_argument("--domain",  "-d", required=True, choices=VALID_DOMAINS)
    parser.add_argument("--project", "-p", default="All", help="Project name (default: All)")
    parser.add_argument("--auto",    "-y", action="store_true", help="Skip approval prompt")
    args = parser.parse_args()

    print("\n╔══════════════════════════════════════════╗")
    print("║   OptiEngine — ADR Ingestion Pipeline    ║")
    print("╚══════════════════════════════════════════╝\n")

    # Health check
    print("  Checking server...", end=" ", flush=True)
    if not check_server():
        print("OFFLINE")
        print(f"  ERROR: Server not reachable at {BASE_URL}")
        print("  Run: uvicorn main:app --port 8000")
        sys.exit(1)
    print("online ✓")

    # Read ADR
    if args.file:
        if not os.path.exists(args.file):
            print(f"  ERROR: File not found: {args.file}")
            sys.exit(1)
        with open(args.file) as f:
            adr_text = f.read()
        print(f"  File: {args.file} ({len(adr_text)} chars)")
    else:
        adr_text = read_from_editor()

    if not adr_text.strip():
        print("  ERROR: Empty document.")
        sys.exit(1)

    # Extract
    print(f"\n  Extracting rules with Groq ({MODEL})...", end=" ", flush=True)
    rules = extract_rules_with_groq(adr_text, args.domain)
    print(f"{len(rules)} rules extracted ✓")

    # Show
    print_rules(rules, args.domain, args.project)

    # Approve
    if not args.auto:
        rules = approve_rules(rules)
    else:
        print(f"  Auto mode: approving all {len(rules)} rules.")

    if not rules:
        print("  No rules to ingest.")
        sys.exit(0)

    # Ingest
    success, failed = ingest_rules(rules, args.domain, args.project)

    print(f"\n{'─'*60}")
    print(f"  ✓ Ingested : {success}")
    print(f"  ✗ Failed   : {failed}")
    print(f"\n  View rules: {BASE_URL}/api/v1/rules?domain={args.domain}")
    print()


if __name__ == "__main__":
    main()