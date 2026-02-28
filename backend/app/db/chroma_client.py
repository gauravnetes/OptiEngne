import os
import logging
from functools import lru_cache

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

CHROMA_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_data")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.PersistentClient:
    """
    Lazily initialize and cache the ChromaDB client.
    Using lru_cache ensures we only ever create one client instance,
    and the import never fails at startup if the DB path is missing.
    """
    try:
        os.makedirs(CHROMA_PATH, exist_ok=True)
        client = chromadb.PersistentClient(
            path=CHROMA_PATH,
            settings=Settings(anonymized_telemetry=False)
        )
        logger.info(f"ChromaDB client initialized at path: {CHROMA_PATH}")
        return client
    except Exception as e:
        logger.critical(f"Failed to initialize ChromaDB client: {e}")
        raise RuntimeError(f"ChromaDB initialization failed: {e}") from e


@lru_cache(maxsize=1)
def get_embedding_function() -> embedding_functions.SentenceTransformerEmbeddingFunction:
    """
    Lazily initialize and cache the embedding function.
    The SentenceTransformer model download happens only once.
    """
    try:
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL
        )
        logger.info(f"Embedding model loaded: {EMBEDDING_MODEL}")
        return ef
    except Exception as e:
        logger.critical(f"Failed to load embedding model '{EMBEDDING_MODEL}': {e}")
        raise RuntimeError(f"Embedding model initialization failed: {e}") from e


def get_domain_collection(domain: str) -> chromadb.Collection:
    """
    Returns a per-domain ChromaDB collection.
    Each domain gets hard-isolated storage — no metadata filter leakage possible.
    'Global' rules live in their own collection and are always queried alongside
    the domain-specific one.
    """
    client = get_chroma_client()
    ef = get_embedding_function()

    # Sanitize domain name for use as a collection name
    safe_domain = domain.lower().strip().replace(" ", "_")
    collection_name = f"guidelines_{safe_domain}"

    collection = client.get_or_create_collection(
        name=collection_name,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}  # Cosine distance for semantic similarity
    )
    return collection