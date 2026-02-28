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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ContextEngine starting up...")
    try:
        from app.db.chroma_client import get_chroma_client, get_embedding_function
        get_chroma_client()
        get_embedding_function()
        logger.info("ChromaDB and embedding model ready.")
    except Exception as e:
        logger.critical(f"Startup failed during warm-up: {e}", exc_info=True)
        raise
    yield
    logger.info("ContextEngine shutting down.")


app = FastAPI(
    title="ContextEngine / OptiEngine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "ContextEngine",
        "status": "online",
        "docs": "/docs",
        "health": "/api/v1/health",
        "mcp": "runs via stdio — see app/api/mcp_server.py",
    }