from fastapi import APIRouter, HTTPException
from app.schemas.payloads import OptimizeRequest, OptimizeResponse
from app.engine.orchestrator import process_optimization
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_endpoint(request: OptimizeRequest):
    """
    The main entry point for OptiEngine.
    Expects the user's intent, target language, and local code context.
    Routes through Tier 1 (Org), Tier 2 (Global), or Tier 3 (Synthesis).
    """
    
    logger.info(f"Received optimization request from Org: {request.org_id}")
    logger.info(f"Intent: {request.intent} | Target Language: {request.context.language}")
    
    try:
        result = process_optimization(request)
        logger.info(f"Optimization successful. Source: {result.source_tier}")
        return result
    
    except Exception as e:
        logger.error(f"Optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))