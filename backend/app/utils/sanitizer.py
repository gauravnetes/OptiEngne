"""
app/utils/sanitizer.py
-----------------------
Prompt injection defense. Shared by both the MCP tool and the REST endpoint
so protection is consistent regardless of which path a request enters through.
"""

import re
import logging

logger = logging.getLogger(__name__)

# Patterns that indicate an attempt to override system instructions.
# Ordered roughly by severity / specificity.
_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|system|above)\s*(prompt|instruction|rule|guideline)?s?",
    r"disregard\s+(the\s+)?(above|previous|system|all)",
    r"forget\s+(all\s+)?(previous|prior|above|your)",
    r"override\s+(all\s+)?(rule|instruction|guideline|system)",
    r"bypass\s+(the\s+)?(rule|guideline|standard|policy|system)",
    r"do\s+not\s+follow\s+(the\s+)?(rule|instruction|guideline)",
    r"you\s+are\s+now\s+a",
    r"new\s+(system\s+)?instruction",
    r"act\s+as\s+if\s+(you\s+have\s+no|there\s+are\s+no)\s+rule",
]

_INJECTION_RE = re.compile(
    "|".join(_INJECTION_PATTERNS),
    flags=re.IGNORECASE,
)


def sanitize_prompt(prompt: str) -> tuple[str, bool]:
    """
    Scan a developer prompt for injection attempts.

    Returns:
        (sanitized_prompt, was_flagged)

    Detected patterns are replaced with [REDACTED] so the prompt
    remains usable but the injection attempt is neutered.
    """
    if _INJECTION_RE.search(prompt):
        sanitized = _INJECTION_RE.sub("[REDACTED]", prompt)
        logger.warning(
            "SECURITY: Prompt injection pattern detected and redacted.\n"
            f"  Original : {prompt[:200]}\n"
            f"  Sanitized: {sanitized[:200]}"
        )
        return sanitized, True

    return prompt, False