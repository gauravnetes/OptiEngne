import hashlib
import logging
from typing import Optional

from app.db.chroma_client import get_domain_collection
from app.schemas.payloads import PromptRequest

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Tuning constants — adjust these based on your rule corpus quality
# -------------------------------------------------------------------

# Cosine distance threshold (0 = identical, 2 = opposite).
# Rules with distance above this are considered irrelevant and dropped.
# Start at 0.55; tighten toward 0.40 as your corpus grows.
# Cosine distance: 0=identical, 2=opposite.
# Calibration guide (enable DEBUG logging to see real distances):
#   < 0.30   near-duplicate match
#   0.30-0.70  semantically related (target zone)
#   0.70-1.20  loosely related, still worth including for governance
#   > 1.20   likely irrelevant
# Start at 1.0, tighten as your corpus grows.
RELEVANCE_THRESHOLD = 1.0

# How many candidates to pull from each collection before filtering
CANDIDATE_POOL_SIZE = 8

# Maximum rules to pass to the LLM synthesizer (controls token cost)
MAX_RULES_TO_APPLY = 5


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def _make_doc_id(domain: str, project: str, rule_text: str) -> str:
    """
    Generate a deterministic document ID from content.
    Prevents duplicate rules being ingested — ingestion becomes idempotent.
    """
    content = f"{domain.lower()}:{project.lower()}:{rule_text.strip().lower()}"
    return hashlib.sha256(content.encode()).hexdigest()[:24]


def _query_collection(collection, query_text: str, n_results: int) -> list[dict]:
    """
    Query a single collection and return a flat list of result dicts
    with rule_text, distance, domain, topic.
    Returns empty list if collection has no documents.
    """
    try:
        count = collection.count()
        if count == 0:
            return []

        # Don't request more results than documents exist
        actual_n = min(n_results, count)

        results = collection.query(
            query_texts=[query_text],
            n_results=actual_n,
            include=["metadatas", "distances"]
        )

        hits = []
        if results["metadatas"] and results["metadatas"][0]:
            for meta, distance in zip(results["metadatas"][0], results["distances"][0]):
                hits.append({
                    "rule_text": meta.get("rule_text", ""),
                    "topic": meta.get("topic", ""),
                    "domain": meta.get("domain", ""),
                    "project": meta.get("project", "All"),
                    "distance": distance,
                })
        return hits

    except Exception as e:
        logger.error(f"Collection query failed: {e}", exc_info=True)
        return []


# -------------------------------------------------------------------
# Public API
# -------------------------------------------------------------------

def ingest_rule(domain: str, project: str, topic: str, rule_text: str) -> str:
    """
    Ingest a single rule into its domain-isolated collection.
    Idempotent — re-ingesting the same rule returns the existing ID.

    Returns the document ID.
    """
    collection = get_domain_collection(domain)
    doc_id = _make_doc_id(domain, project, rule_text)

    # Idempotency check — skip if already exists
    existing = collection.get(ids=[doc_id])
    if existing["ids"]:
        logger.info(f"Rule already exists (id={doc_id}), skipping ingestion.")
        return doc_id

    # The document text is what gets embedded — lead with meaningful content
    document_text = f"{topic}: {rule_text}"

    collection.add(
        ids=[doc_id],
        documents=[document_text],
        metadatas=[{
            "domain": domain,
            "project": project,
            "topic": topic,
            "rule_text": rule_text,
            "version": 1,
        }]
    )

    logger.info(
        f"Ingested rule — domain={domain}, project={project}, "
        f"topic='{topic}', id={doc_id}"
    )
    return doc_id


def retrieve_relevant_rules(
    request: PromptRequest,
    max_rules: int = MAX_RULES_TO_APPLY
) -> list[dict]:
    """
    Retrieve semantically relevant rules for a developer prompt.

    Strategy:
    1. Query the 'Global' collection (org-wide rules always apply).
    2. Query the domain-specific collection (e.g. 'Backend').
    3. Merge results, apply relevance threshold, deduplicate, sort by relevance.
    4. Return the top `max_rules` rule dicts.
    """
    query_text = request.junior_prompt
    domain = request.domain

    # --- Step 1: Global rules ---
    global_collection = get_domain_collection("Global")
    global_hits = _query_collection(global_collection, query_text, CANDIDATE_POOL_SIZE)

    # --- Step 2: Domain-specific rules (skip if domain IS Global) ---
    domain_hits = []
    if domain.lower() != "global":
        domain_collection = get_domain_collection(domain)
        domain_hits = _query_collection(domain_collection, query_text, CANDIDATE_POOL_SIZE)

    all_hits = global_hits + domain_hits

    if not all_hits:
        logger.info(f"No rules found for domain='{domain}'")
        return []

    # Log ALL candidate distances so you can calibrate RELEVANCE_THRESHOLD
    logger.info(
        f"RAG candidates for domain='{domain}' — "
        f"{len(all_hits)} hits | distances: "
        + str([f"{h['topic'][:20]}={h['distance']:.3f}" for h in sorted(all_hits, key=lambda x: x['distance'])])
    )

    # --- Step 3: Filter by relevance threshold ---
    relevant_hits = [h for h in all_hits if h["distance"] < RELEVANCE_THRESHOLD]

    if not relevant_hits:
        closest = min(all_hits, key=lambda h: h["distance"])
        logger.warning(
            f"No rules passed threshold ({RELEVANCE_THRESHOLD}). "
            f"Closest: topic='{closest['topic']}' distance={closest['distance']:.3f}. "
            f"Consider raising RELEVANCE_THRESHOLD in retriever.py."
        )
        return []

    # --- Step 4: Deduplicate by rule_text, sort by distance (ascending = more relevant) ---
    seen = set()
    deduped = []
    for hit in sorted(relevant_hits, key=lambda h: h["distance"]):
        if hit["rule_text"] not in seen:
            seen.add(hit["rule_text"])
            deduped.append(hit)

    selected = deduped[:max_rules]

    logger.info(
        f"Retrieved {len(selected)} rules for domain='{domain}' | "
        f"distances: {[round(h['distance'], 3) for h in selected]}"
    )

    return selected


def list_rules(domain: Optional[str] = None) -> list[dict]:
    """
    List all ingested rules, optionally filtered by domain.
    Useful for the Streamlit control plane.
    """
    if domain:
        collections_to_check = [get_domain_collection(domain)]
    else:
        # List all guideline collections
        client_collections = get_domain_collection("Global")._client.list_collections()
        collections_to_check = [
            get_domain_collection(col.name.replace("guidelines_", "").title())
            for col in client_collections
            if col.name.startswith("guidelines_")
        ]

    all_rules = []
    for collection in collections_to_check:
        if collection.count() == 0:
            continue
        results = collection.get(include=["metadatas"])
        for meta in results.get("metadatas", []):
            all_rules.append(meta)

    return all_rules