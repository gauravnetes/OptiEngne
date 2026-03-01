import re
import logging

from mcp.server.fastmcp import FastMCP

from app.schemas.payloads import PromptRequest
from app.db.retriever import retrieve_relevant_rules
from app.engine.prompt_builder import enhance_prompt_with_rules
from app.utils.sanitizer import sanitize_prompt

# -------------------------------------------------------------------
# Eager Module Loading
# -------------------------------------------------------------------
try:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")
    startup_logger = logging.getLogger("ContextEngine.Startup")
    startup_logger.info("Pre-loading ChromaDB and embedding model at startup...")
    from app.db.chroma_client import get_chroma_client, get_embedding_function
    get_chroma_client()
    get_embedding_function()
    startup_logger.info("ContextEngine startup complete — ready to serve requests instantly.")
except Exception as _startup_err:
    print(f"Failed to pre-load resources: {_startup_err}")

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

def _resolve_domain(file_path: str) -> str:
    path_lower = file_path.lower()
    if "backend" in path_lower or "api" in path_lower or file_path.endswith(".py"):
        return "Backend"
    if "frontend" in path_lower or "web" in path_lower or file_path.endswith((".ts", ".tsx", ".js", ".jsx")):
        return "Web"
    if "data" in path_lower or "ml" in path_lower or "ai" in path_lower:
        return "AI"
    return "Global"

import json

@mcp.tool()
def get_org_context(file_path: str, content: str, org_id: str = "global") -> str:
    """
    Called by the Guardian Extension when a user saves a file.
    Returns the organizational compliance checklist and a mermaid architecture diagram.
    """
    logger.info(f"Guardian analyzing file: {file_path}")
    domain = _resolve_domain(file_path)

    try:
        request = PromptRequest(junior_prompt=content, domain=domain, project="Guardian")
        rules = retrieve_relevant_rules(request)

        checklist = []
        if rules:
            for rule in rules:
                topic = rule.get("topic", "")
                dist = rule.get("distance", 0)
                relevance = max(0, min(100, int((1 - dist) * 100)))
                rule_domain = rule.get("domain", domain)

                prefix = f"[{topic.upper()}]" if topic else "[RULE]"
                checklist.append(
                    f"{prefix} ({relevance}% relevance | {rule_domain}) — "
                    f"{rule.get('rule_text', '')}"
                )
        else:
            checklist = [
                f"[INFO] No organizational rules found for domain '{domain}'.",
                "[INFO] Proceeding with standard best practices.",
                "[ACTION] Code should be reviewed by a senior engineer before merge."
            ]
        
        # Placeholder for the mermaid diagram 
        mermaid_diagram = "graph TD\n  A[File Saved] --> B[Rule Engine]\n  B --> C[Compliance Passed]"

        result = {
            "compliance_checklist": checklist,
            "mermaid_diagram": mermaid_diagram,
            "org_id": org_id,
            "domain": domain,
            "file_path": file_path,
        }

        logger.info(f"Guardian context built | domain={domain} | rules={len(rules)}")
        return json.dumps(result)

    except Exception as e:
        logger.error(f"Guardian context failed: {e}", exc_info=True)
        error_result = {
            "compliance_checklist": [
                f"[ERROR] ContextEngine: {type(e).__name__}: {str(e)}"
            ],
            "mermaid_diagram": f"graph TD\n  A[Error] --> B[{type(e).__name__}]",
            "org_id": org_id,
            "domain": domain,
            "file_path": file_path,
        }
        return json.dumps(error_result)


if __name__ == "__main__":
    logger.info("ContextEngine MCP Server starting — waiting for IDE connections...")
    mcp.run(transport="stdio")