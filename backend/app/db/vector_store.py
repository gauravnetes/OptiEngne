from app.db.chroma_client import chroma_client, huggingface_ef
from typing import List, Dict, Any

tier1_collection = chroma_client.get_or_create_collection(
    name="tier1_org_cache",
    embedding_function=huggingface_ef
)

tier2_collection = chroma_client.get_or_create_collection(
    name="tier2_global_cache",
    embedding_function=huggingface_ef
)

def search_tier1(org_id: str, query: str, n_results: int = 1):
    results = tier1_collection.query(
        query_texts=[query],
        n_results=n_results,
        where={"org_id": org_id} 
    )
    return results

def search_tier2(query: str, n_results: int = 1):
    results = tier2_collection.query(
        query_texts=[query],
        n_results=n_results
    )
    return results

def insert_tier1(org_id: str, doc_id: str, problem_intent: str, optimized_code: str, language: str, time_complexity: str):
    tier1_collection.add(
        ids=[doc_id],
        documents=[problem_intent],
        metadatas=[{
            "org_id": org_id,
            "language": language,
            "optimized_code": optimized_code,
            "time_complexity": time_complexity
        }]
    )

def insert_tier2(doc_id: str, problem_intent: str, pure_cpp_code: str, time_complexity: str):
    tier2_collection.add(
        ids=[doc_id],
        documents=[problem_intent],
        metadatas=[{
            "language": "C++",
            "optimized_code": pure_cpp_code,
            "time_complexity": time_complexity
        }]
    )