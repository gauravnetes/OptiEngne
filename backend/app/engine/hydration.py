from app.core.llm_clients import groq_client
from app.schemas.payloads import CodeContext

def hydrate_algorithm(pure_code: str, context: CodeContext) -> str:
    """
    Translates pure algorithmic logic into the user's specific language and codebase context.
    """
    if not groq_client:
        raise ValueError("Groq client not initialized. Check API key.")

    prompt = f"""
    You are an expert compiler and software architect.
    Take the following optimal algorithm (likely in C++) and translate it into {context.language}.
    
    PURE ALGORITHM:
    {pure_code}
    
    USER'S LOCAL CONTEXT:
    Existing Structs/Classes: {context.structs_or_classes}
    Variables to map: {context.variable_names}
    
    REQUIREMENTS:
    - Maintain the exact time and space complexity of the pure algorithm.
    - Adapt the logic to seamlessly fit into the user's provided structs and variable names.
    - Output ONLY the raw executable {context.language} code. No markdown, no explanations.
    """

    completion = groq_client.chat.completions.create(
        model="llama3-8b-8192", # Extremely fast model for syntax translation
        messages=[
            {"role": "system", "content": "You are a code translation engine. Output only code."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1, # Keep it deterministic
        max_tokens=1024
    )

    return completion.choices[0].message.content.strip()