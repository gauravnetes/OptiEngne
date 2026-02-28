from pydantic import BaseModel, Field
from typing import Optional, Dict

class CodeContext(BaseModel):
    language: str = Field(..., description="Target language (e.g., 'Go', 'JavaScript', 'C++')")
    existing_code: str = Field(..., description="The naive code the agent wants to optimize")
    variable_names: list[str] = Field(default_factory=list, description="Local variable names to map")
    structs_or_classes: Optional[str] = Field(default=None, description="Local struct/class definitions")

class OptimizeRequest(BaseModel):
    org_id: str = Field(..., description="Identifier for the Tier 1 cache namespace")
    intent: str = Field(..., description="The mathematical or algorithmic goal")
    context: CodeContext

class OptimizeResponse(BaseModel):
    status: str
    source_tier: str
    time_complexity: str
    optimized_code: str
    metrics: Dict[str, float]