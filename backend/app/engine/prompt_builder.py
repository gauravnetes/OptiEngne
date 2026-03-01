import os
import time
import logging
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Client initialization — lazy, not at import time
# -------------------------------------------------------------------

_groq_client: Groq | None = None


def _get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set in environment.")
        _groq_client = Groq(api_key=api_key)
    return _groq_client


# -------------------------------------------------------------------
# Constants
# -------------------------------------------------------------------

MODEL = "llama-3.1-8b-instant"
TEMPERATURE = 0.1       # Low — you want deterministic rule injection, not creativity
MAX_TOKENS = 2048       # Enhanced prompts can be long
MAX_RETRIES = 2
RETRY_BASE_DELAY = 1.0  # seconds


# -------------------------------------------------------------------
# System prompt template
# -------------------------------------------------------------------

SYSTEM_PROMPT_TEMPLATE = """You are a Staff Engineer intercepting a junior developer's code generation prompt.

Your task is to rewrite their prompt into a precise, detailed engineering specification that explicitly enforces all mandatory organizational rules listed below.

REWRITING RULES:
1. Every [MANDATORY] rule MUST appear in your output as a hard, non-negotiable requirement.
2. Use strong directive language: MUST, REQUIRED, NON-NEGOTIABLE, ENFORCE.
3. Do NOT soften, summarize, or omit any rule. If a rule says "use RS256", the output must say "use RS256".
4. Preserve the developer's original intent completely — only add requirements, never remove them.
5. The output must be self-contained. The downstream coding agent must need nothing else to generate fully compliant code.
6. Output ONLY the rewritten prompt. No preamble. No "Here is the rewritten prompt:". No explanation.

MANDATORY ORGANIZATIONAL RULES:
{rules_block}
"""


def _build_rules_block(rules: list[dict]) -> str:
    """Format rules with explicit [MANDATORY] tags so the LLM treats them as hard constraints."""
    lines = []
    for i, rule in enumerate(rules, start=1):
        lines.append(f"{i}. [MANDATORY] {rule.get('rule_text', '')}")
    return "\n".join(lines)


# -------------------------------------------------------------------
# Public API
# -------------------------------------------------------------------

def enhance_prompt_with_rules(junior_prompt: str, rules: list[dict]) -> str:
    """
    Rewrite a junior developer's prompt to explicitly enforce organizational rules.

    Falls back gracefully if Groq is unavailable — appends rules as raw text
    so the IDE agent still has the constraints, just without LLM synthesis.

    Args:
        junior_prompt: The raw prompt from the developer.
        rules: List of rule texts retrieved from ChromaDB.

    Returns:
        The enhanced prompt string.
    """
    if not rules:
        logger.info("No rules provided — returning original prompt unchanged.")
        return junior_prompt

    rules_block = _build_rules_block(rules)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(rules_block=rules_block)

    last_exception = None

    for attempt in range(MAX_RETRIES):
        try:
            client = _get_groq_client()
            completion = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": junior_prompt},
                ],
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
            )

            enhanced = completion.choices[0].message.content.strip()

            logger.info(
                f"Groq synthesis complete — model={MODEL}, "
                f"rules_injected={len(rules)}, attempt={attempt + 1}"
            )
            return enhanced

        except Exception as e:
            last_exception = e
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    f"Groq call failed (attempt {attempt + 1}/{MAX_RETRIES}): {e}. "
                    f"Retrying in {delay}s..."
                )
                time.sleep(delay)
            else:
                logger.error(
                    f"All {MAX_RETRIES} Groq attempts failed. "
                    f"Last error: {e}",
                    exc_info=True
                )

    # --- Graceful degradation fallback ---
    # Groq is down. We still give the agent the rules as structured text.
    # This is better than nothing and keeps the dev unblocked.
    logger.warning("Falling back to raw rule injection (no LLM synthesis).")
    rules_text = "\n".join([f"- [MANDATORY] {r}" for r in rules])
    return (
        f"{junior_prompt}\n\n"
        f"MANDATORY ORGANIZATIONAL REQUIREMENTS (enforce all of these):\n"
        f"{rules_text}"
    )