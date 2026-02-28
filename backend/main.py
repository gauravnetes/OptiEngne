from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router as api_router
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="OptiEngine API",
    description="Multi-tiered algorithmic optimization and contextual hydration engine.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    """Simple health check to verify the server is running."""
    return {"status": "OptiEngine is online and listening."}