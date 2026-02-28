import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import router

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("ContextEngine.Main")


# -------------------------------------------------------------------
# Lifespan — warm up ChromaDB and embedding model at startup
# so the first real request isn't slow
# -------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ContextEngine starting up...")
    try:
        from app.db.chroma_client import get_chroma_client, get_embedding_function
        get_chroma_client()       # Initialize ChromaDB connection
        get_embedding_function()  # Download / load embedding model
        logger.info("ChromaDB and embedding model ready.")
    except Exception as e:
        logger.critical(f"Startup failed during warm-up: {e}", exc_info=True)
        raise

    yield  # Server is running

    logger.info("ContextEngine shutting down.")


# -------------------------------------------------------------------
# App
# -------------------------------------------------------------------

app = FastAPI(
    title="ContextEngine / OptiEngine",
    description=(
        "A local MCP server that intercepts developer prompts and rewrites them "
        "to enforce organizational coding standards via RAG + LLM synthesis."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — needed for the Streamlit control plane to call the REST API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten this in production to your Streamlit host
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the API routes under /api/v1
app.include_router(router, prefix="/api/v1")


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "ContextEngine",
        "status": "online",
        "docs": "/docs",
        "health": "/api/v1/health",
    }