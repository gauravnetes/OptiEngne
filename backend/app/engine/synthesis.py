from app.core.llm_clients import gemini_model
from app.schemas.payloads import OptimizeRequest
import time

def synthesize_algorithm(request: OptimizeRequest) -> dict:
    """
    Tier 3 Fallback: Uses a heavy reasoning model to generate the optimal algorithm from scratch.
    """
    if not gemini_model:
        raise ValueError("Gemini client not initialized. Check API key.")

    prompt = f"""
    You are an elite competitive programmer. 
    The user is trying to solve this problem: {request.intent}
    
    Their current naive approach is written in {request.context.language}:
    {request.context.existing_code}
    
    TASK:
    1. Determine the absolute mathematically optimal time and space complexity for this problem.
    2. Write the pure, highly optimized solution in C++. 
    3. Return ONLY a JSON object with this exact structure:
       {{"time_complexity": "O(...)", "pure_cpp_code": "..."}}
    """
    
    start_time = time.time()
    # Using Gemini for deep reasoning
    response = gemini_model.generate_content(prompt)
    latency = round((time.time() - start_time) * 1000, 2)
    
    # In a real app, you'd parse the JSON safely. 
    # For the hackathon, we assume the LLM followed the JSON instruction.
    import json
    # Strip markdown code blocks if the LLM added them
    clean_text = response.text.replace("```json", "").replace("```", "").strip()
    result = json.loads(clean_text)
    
    return {
        "pure_cpp_code": result["pure_cpp_code"],
        "time_complexity": result["time_complexity"],
        "latency_ms": latency
    }