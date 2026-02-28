from pydantic import BaseModel, Field, field_validator
from typing import List, Optional


# Extend this set as your org adds new engineering domains
VALID_DOMAINS = {"Global", "Backend", "Web", "AI", "Mobile", "Data", "Devops"}


class GuidelineIngest(BaseModel):
    domain: str = Field(..., description="Engineering domain — e.g. 'Backend', 'Web', 'AI', 'Global'")
    project: Optional[str] = Field(default="All", description="Specific project name or 'All'")
    topic: str = Field(..., min_length=3, max_length=200, description="Short label for the rule topic")
    rule_text: str = Field(..., min_length=10, max_length=2000, description="The full rule text")

    @field_validator("domain")
    @classmethod
    def normalize_domain(cls, v: str) -> str:
        """Title-case and strip whitespace to prevent 'backend' vs 'Backend' mismatches."""
        normalized = v.strip().title()
        
        if normalized == "Ai": 
            normalized = "AI"
        if normalized not in VALID_DOMAINS:
            raise ValueError(
                f"Domain '{normalized}' is not recognized. "
                f"Valid domains: {sorted(VALID_DOMAINS)}"
            )
        return normalized

    @field_validator("rule_text")
    @classmethod
    def rule_text_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("rule_text cannot be blank or whitespace only.")
        return stripped

    @field_validator("topic")
    @classmethod
    def topic_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("topic cannot be blank.")
        return stripped


class PromptRequest(BaseModel):
    junior_prompt: str = Field(
        ...,
        min_length=5,
        max_length=4000,
        description="The raw prompt from the developer"
    )
    domain: str = Field(
        default="Global",
        description="The engineering domain the developer is working in"
    )
    project: str = Field(default="All", description="Specific project scope")

    @field_validator("domain")
    @classmethod
    def normalize_domain(cls, v: str) -> str:
        return v.strip().title()


class EnhancedPromptResponse(BaseModel):
    original_prompt: str
    enhanced_prompt: str
    applied_rules: List[str]
    rules_count: int = Field(description="Number of rules injected into the enhanced prompt")
    domain: str
    degraded: bool = Field(
        default=False,
        description="True if enhancement failed and the response is a fallback"
    )
    