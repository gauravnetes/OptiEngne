import re
import logging

from mcp.server.fastmcp import FastMCP

from app.schemas.payloads import PromptRequest
from app.db.retriever import retrieve_relevant_rules
from app.engine.prompt_builder import enhance_prompt_with_rules
from app.utils.sanitizer import sanitize_prompt

# -------------------------------------------------------------------
# Logging
# -------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)
logger = logging.getLogger("ContextEngine.MCP")

# -------------------------------------------------------------------
# MCP Server
# -------------------------------------------------------------------

mcp = FastMCP("ContextEngine")




# -------------------------------------------------------------------
# MCP Tool
# -------------------------------------------------------------------

@mcp.tool()
def enhance_development_prompt(
    junior_prompt: str,
    domain: str = "Global",
    project: str = "All"
) -> str:
    """
    CRITICAL TOOL: You MUST call this tool EVERY TIME before generating,
    refactoring, or modifying any code.

    Pass the user's raw prompt and their engineering domain (e.g., 'Backend',
    'Web', 'AI', 'Data'). This tool retrieves mandatory organizational coding
    standards and rewrites the prompt to ensure full policy compliance.

    Do NOT write any code until you receive and use the enhanced prompt
    returned by this tool.

    Args:
        junior_prompt: The developer's raw, unmodified prompt.
        domain: The engineering domain (e.g., 'Backend', 'Web', 'AI'). Defaults to 'Global'.
        project: The specific project name. Defaults to 'All'.

    Returns:
        An enhanced, policy-compliant prompt for the coding agent.
    """
    logger.info(
        f"Intercepted prompt | domain={domain} | project={project} | "
        f"prompt_preview='{junior_prompt[:80]}...'"
    )

    # --- Step 1: Sanitize for prompt injection ---
    sanitized_prompt, was_flagged = sanitize_prompt(junior_prompt)
    if was_flagged:
        logger.warning(
            f"SECURITY: Prompt injection pattern detected and redacted. "
            f"Original: '{junior_prompt[:120]}'"
        )

    try:
        # --- Step 2: Validate and package the request ---
        request = PromptRequest(
            junior_prompt=sanitized_prompt,
            domain=domain,
            project=project
        )

        # --- Step 3: Retrieve relevant organizational rules from ChromaDB ---
        relevant_rules = retrieve_relevant_rules(request)

        if not relevant_rules:
            logger.info(
                f"No matching organizational rules found for domain='{domain}'. "
                f"Returning original prompt with a notice."
            )
            return (
                f"[CONTEXT ENGINE: NO DOMAIN RULES FOUND]\n"
                f"No organizational standards matched this prompt for domain '{domain}'.\n"
                f"Proceeding with standard best practices. Your tech lead should review output.\n\n"
                f"Original request: {sanitized_prompt}"
            )

        # --- Step 4: Synthesize the Senior Prompt via Groq ---
        enhanced_prompt = enhance_prompt_with_rules(sanitized_prompt, relevant_rules)

        logger.info(
            f"Enhancement complete | rules_applied={len(relevant_rules)} | "
            f"domain={domain}"
        )

        # --- Step 5: Return the enhanced prompt to the IDE agent ---
        return (
            f"[CONTEXT ENGINE: {len(relevant_rules)} ORGANIZATIONAL STANDARD(S) APPLIED]\n"
            f"You MUST strictly follow every requirement in this enhanced prompt:\n\n"
            f"{enhanced_prompt}"
        )

    except Exception as e:
        # --- Loud degradation — do NOT silently pass through ---
        logger.error(
            f"ContextEngine encountered an unrecoverable error: {e}",
            exc_info=True
        )
        return (
            f"[CONTEXT ENGINE: DEGRADED MODE — STANDARDS NOT APPLIED]\n"
            f"WARNING: The organizational standards pipeline failed. "
            f"This code MUST be reviewed by a senior engineer before merge.\n"
            f"Error: {type(e).__name__}\n\n"
            f"Original request: {sanitized_prompt}"
        )


# -------------------------------------------------------------------
# Entry point
# -------------------------------------------------------------------

if __name__ == "__main__":
    logger.info("ContextEngine MCP Server starting — waiting for IDE connections...")
    mcp.run(transport="stdio")