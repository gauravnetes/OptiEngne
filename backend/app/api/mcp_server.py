from mcp.server.fastmcp import FastMCP
from app.schemas.payloads import OptimizeRequest, CodeContext
from app.engine.orchestrator import process_optimization
import logging

mcp = FastMCP("OptiEngine")
logger = logging.getLogger(__name__)

@mcp.tool()
def optimize_algorithm(intent: str, language: str, existing_code: str, variable_names: list[str]) -> str:
    """
    CRITICAL TOOL: Use this whenever a user asks to optimize, speed up, or improve the time/space complexity of code.
    Pass the user's mathematical goal as the intent, their target language, their naive code, and a list of key variable names.
    """
    logger.info(f"Agent called optimize_algorithm for intent: {intent}")
    
    try:
        context = CodeContext(
            language=language,
            existing_code=existing_code,
            variable_names=variable_names
        )
        
        request = OptimizeRequest(
            org_id="hackathon_demo_org", # We hardcode this for the live demo
            intent=intent,
            context=context
        )
        
        result = process_optimization(request)
        
        response = f"""
Optimization Complete! (Source: {result.source_tier})
New Time Complexity: {result.time_complexity}

Optimized {language} Code:
{result.optimized_code}

Metrics: Saved {result.metrics['tokens_saved']} tokens. Latency: {result.metrics['latency_ms']}ms.
"""
        return response

    except Exception as e:
        return f"OptiEngine failed to process the request: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport="stdio")