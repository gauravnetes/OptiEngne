from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    prompt: str

@app.post("/api/v1/optimize")
async def optimize_code(query: QueryRequest):
    return {
        "status": "success",
        "original_complexity": "O(n^2)",
        "optimized_complexity": "O(n)",
        "optimized_code": "int result = 0;\n// C++ logic here",
        "tokens_saved": 850,
        "time_saved_ms": 1420
    }