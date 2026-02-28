import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Security, Depends, Query
from fastapi.security import APIKeyHeader

from app.schemas.payloads import GuidelineIngest, PromptRequest, EnhancedPromptResponse
from app.db.retriever import ingest_rule, retrieve_relevant_rules, list_rules
from app.engine.prompt_builder import enhance_prompt_with_rules
from app.utils.sanitizer import sanitize_prompt

logger = logging.getLogger(__name__)

router = APIRouter()

# -------------------------------------------------------------------
# API Key authentication — required for all write (ingest) operations.
# Read operations (/enhance, /rules) are intentionally open since they
# only retrieve processed output, never raw guidelines.
# -------------------------------------------------------------------

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)


def _verify_ingest_key(key: str = Security(_api_key_header)) -> str:
    """
    Validates the X-API-Key header against the INGEST_API_KEY env var.
    Only Tech Leads / CI pipelines should hold this key.
    """
    expected_key = os.getenv("INGEST_API_KEY")
    if not expected_key:
        logger.critical("INGEST_API_KEY is not set. Ingestion endpoint is locked.")
        raise HTTPException(
            status_code=503,
            detail="Server misconfiguration: INGEST_API_KEY not set."
        )
    if key != expected_key:
        logger.warning("Unauthorized ingestion attempt with invalid API key.")
        raise HTTPException(status_code=403, detail="Invalid API key.")
    return key


# -------------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------------

@router.post(
    "/ingest",
    summary="Ingest a coding guideline (Tech Lead only)",
    description=(
        "Push an organizational rule into the vector database. "
        "Requires a valid X-API-Key header. Ingestion is idempotent — "
        "pushing the same rule twice returns the existing document ID."
    ),
)
async def ingest_guideline(
    payload: GuidelineIngest,
    _key: str = Depends(_verify_ingest_key),
):
    """Ingest a rule into the domain-isolated ChromaDB collection."""
    try:
        doc_id = ingest_rule(
            domain=payload.domain,
            project=payload.project or "All",
            topic=payload.topic,
            rule_text=payload.rule_text,
        )
        logger.info(
            f"Rule ingested — domain={payload.domain}, topic='{payload.topic}', id={doc_id}"
        )
        return {
            "status": "success",
            "doc_id": doc_id,
            "domain": payload.domain,
            "topic": payload.topic,
        }
    except Exception as e:
        logger.error(f"Ingestion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/enhance",
    response_model=EnhancedPromptResponse,
    summary="Enhance a developer prompt (REST test endpoint)",
    description=(
        "Retrieves relevant organizational rules and rewrites the prompt. "
        "This is the REST equivalent of the MCP tool — useful for testing "
        "and the Streamlit control plane."
    ),
)
async def enhance_prompt(payload: PromptRequest):
    """Full RAG + synthesis pipeline over REST."""
    try:
        # Sanitize for injection before anything else
        clean_prompt, was_flagged = sanitize_prompt(payload.junior_prompt)
        if was_flagged:
            payload = PromptRequest(
                junior_prompt=clean_prompt,
                domain=payload.domain,
                project=payload.project,
            )

        relevant_rules = retrieve_relevant_rules(payload)
        enhanced_text = enhance_prompt_with_rules(payload.junior_prompt, relevant_rules)

        degraded = (enhanced_text == payload.junior_prompt and bool(relevant_rules))

        return EnhancedPromptResponse(
            original_prompt=payload.junior_prompt,
            enhanced_prompt=enhanced_text,
            applied_rules=relevant_rules,
            rules_count=len(relevant_rules),
            domain=payload.domain,
            degraded=degraded,
        )
    except Exception as e:
        logger.error(f"Enhancement failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/rules",
    summary="List ingested rules",
    description="Returns all rules in the knowledge base, optionally filtered by domain. Useful for the Streamlit control plane.",
)
async def get_rules(domain: Optional[str] = Query(default=None, description="Filter by domain")):
    """List all rules, with optional domain filter."""
    try:
        rules = list_rules(domain=domain)
        return {
            "count": len(rules),
            "domain_filter": domain,
            "rules": rules,
        }
    except Exception as e:
        logger.error(f"Failed to list rules: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/health",
    summary="Health check",
)
async def health_check():
    """Simple liveness probe — verifies FastAPI is up and ChromaDB is reachable."""
    from app.db.chroma_client import get_chroma_client
    try:
        client = get_chroma_client()
        collections = client.list_collections()
        return {
            "status": "healthy",
            "collections": [c.name for c in collections],
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Unhealthy: {e}")