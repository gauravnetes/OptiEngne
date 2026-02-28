import os
from groq import Groq
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# 1. Initialize Groq (For Contextual Hydration)
groq_api_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

# 2. Initialize Gemini (For Heavy Synthesis Fallback)
gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)
    # Using Gemini 1.5 Flash for speed, or Pro for deep reasoning
    gemini_model = genai.GenerativeModel('gemini-1.5-flash') 
else:
    gemini_model = None