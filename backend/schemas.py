from pydantic import BaseModel
from typing import Optional, Dict

class CodeContext(BaseModel):
    language: str
    existing_code: str
    variable_names: list[str]
    structs_or_classes: Optional[str] = None

class OptimizeRequest(BaseModel):
    org_id: str                   # Identifies the Tier 1 namespace
    intent: str                   # What is the agent trying to solve? (e.g., "Find shortest path")
    context: CodeContext          # The developer's local environment

class OptimizeResponse(BaseModel):
    status: str
    source_tier: str              # "Tier 1 (Org)", "Tier 2 (Global + Hydration)", or "Tier 3 (Synthesis)"
    time_complexity: str
    optimized_code: str
    metrics: Dict[str, float]     # {"latency_ms": 120, "tokens_saved": 1500}