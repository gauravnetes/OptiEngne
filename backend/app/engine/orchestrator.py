from app.schemas.payloads import OptimizeRequest, OptimizeResponse
from app.db.vector_store import search_tier1, search_tier2, insert_tier1, insert_tier2
from app.engine.hydration import hydrate_algorithm
from app.engine.synthesis import synthesize_algorithm
import time
import uuid

def process_optimization(request: OptimizeRequest) -> OptimizeResponse:
    start_time = time.time()
    
    # ==========================================
    # STEP 1: Check Tier 1 (Org Cache)
    # ==========================================
    t1_results = search_tier1(request.org_id, request.intent)
    
    # Check if we have a high-confidence match (distance < 1.0)
    if t1_results['distances'][0] and t1_results['distances'][0][0] < 1.0:
        metadata = t1_results['metadatas'][0][0]
        # Must match the requested language to be a valid Tier 1 hit
        if metadata['language'] == request.context.language:
            latency = round((time.time() - start_time) * 1000, 2)
            return OptimizeResponse(
                status="success",
                source_tier="Tier 1 (Org Cache)",
                time_complexity=metadata['time_complexity'],
                optimized_code=metadata['optimized_code'],
                metrics={"latency_ms": latency, "tokens_saved": 1500} # Simulated token savings
            )

    # ==========================================
    # STEP 2: Check Tier 2 (Global Cache) + Hydration
    # ==========================================
    t2_results = search_tier2(request.intent)
    
    if t2_results['distances'][0] and t2_results['distances'][0][0] < 1.0:
        metadata = t2_results['metadatas'][0][0]
        pure_code = metadata['optimized_code']
        time_complexity = metadata['time_complexity']
        
        # Hydrate the pure C++ algorithm into the user's specific context/language
        hydrated_code = hydrate_algorithm(pure_code, request.context)
        
        # Save this new specific code to the Org's Tier 1 Cache for next time
        doc_id = str(uuid.uuid4())
        insert_tier1(request.org_id, doc_id, request.intent, hydrated_code, request.context.language, time_complexity)
        
        latency = round((time.time() - start_time) * 1000, 2)
        return OptimizeResponse(
            status="success",
            source_tier="Tier 2 (Global Cache + Hydration)",
            time_complexity=time_complexity,
            optimized_code=hydrated_code,
            metrics={"latency_ms": latency, "tokens_saved": 1400} 
        )

    # ==========================================
    # STEP 3: Fallback to Tier 3 (Synthesis)
    # ==========================================
    # Heavy mathematical reasoning from scratch
    synth_result = synthesize_algorithm(request)
    
    # Save the pure mathematical truth to the Global Cache
    global_doc_id = str(uuid.uuid4())
    insert_tier2(global_doc_id, request.intent, synth_result["pure_cpp_code"], synth_result["time_complexity"])
    
    # Hydrate it for the user immediately
    hydrated_code = hydrate_algorithm(synth_result["pure_cpp_code"], request.context)
    
    # Save the specific implementation to the Org Cache
    org_doc_id = str(uuid.uuid4())
    insert_tier1(request.org_id, org_doc_id, request.intent, hydrated_code, request.context.language, synth_result["time_complexity"])
    
    latency = round((time.time() - start_time) * 1000, 2)
    return OptimizeResponse(
        status="success",
        source_tier="Tier 3 (Active Synthesis)",
        time_complexity=synth_result["time_complexity"],
        optimized_code=hydrated_code,
        metrics={"latency_ms": latency, "tokens_saved": 0} # We burned tokens here
    )