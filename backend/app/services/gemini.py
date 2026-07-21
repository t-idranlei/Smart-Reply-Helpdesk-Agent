from google import genai
from google.genai import errors as genai_errors
import json
import re
from typing import List, Dict, Optional
from app.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

PRIMARY_MODEL = "gemini-2.5-flash"
FALLBACK_MODEL = "gemini-2.5-flash-lite"


def test_connection() -> dict:
    """Simple test to verify Gemini is working."""
    try:
        response = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents="Say 'Hello! I am working!' in exactly 5 words."
        )
        return {
            "success": True,
            "response": response.text.strip(),
            "message": "✅ Gemini is connected and working!"
        }
    except Exception as e:
        return {
            "success": False,
            "response": None,
            "message": f"❌ Gemini error: {str(e)}"
        }


async def classify_email(email_body: str, email_subject: str) -> dict:
    """Classify email using Gemini."""
    prompt = f"""
    Analyze this customer email and return a JSON response.
    
    SUBJECT: {email_subject}
    BODY: {email_body[:500]}
    
    Return ONLY valid JSON with these fields:
    - category: one of ["complaint", "inquiry", "request", "appreciation", "general"]
    - priority: one of ["low", "medium", "high", "urgent"]
    - action_items: list of 1-3 specific actions needed
    - sentiment: one of ["positive", "neutral", "negative"]
    
    Example:
    {{"category": "inquiry", "priority": "medium", "action_items": ["reset password"], "sentiment": "neutral"}}
    """
    
    try:
        response = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents=prompt
        )
        text = response.text.strip()
        # Extract JSON
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end > start:
            json_str = text[start:end]
            return json.loads(json_str)
        else:
            return {
                "category": "general",
                "priority": "medium",
                "action_items": ["review email"],
                "sentiment": "neutral"
            }
    except genai_errors.ServerError as e:
        print(f"⚠️ Primary model error: {e}, falling back to {FALLBACK_MODEL}")
        try:
            response = client.models.generate_content(
                model=FALLBACK_MODEL,
                contents=prompt
            )
            text = response.text.strip()
            start = text.find('{')
            end = text.rfind('}') + 1
            if start != -1 and end > start:
                json_str = text[start:end]
                return json.loads(json_str)
            else:
                return {
                    "category": "general",
                    "priority": "medium",
                    "action_items": ["review email"],
                    "sentiment": "neutral"
                }
        except Exception as e2:
            print(f"❌ Fallback model also failed: {e2}")
            return {
                "category": "general",
                "priority": "medium",
                "action_items": ["review email"],
                "sentiment": "neutral"
            }
    except Exception as e:
        print(f"❌ Classification error: {e}")
        return {
            "category": "general",
            "priority": "medium",
            "action_items": ["review email"],
            "sentiment": "neutral"
        }


async def search_knowledge(query: str, top_k: int = 3) -> List[Dict]:
    """Search knowledge base for relevant documents."""
    return []


async def generate_draft(
    email_body: str,
    email_subject: str,
    sender_name: str,
    context: List[str],
    tone: str = "professional",
    max_length: int = 150,
    language: str = "en"
) -> dict:
    """Generate a draft reply with dynamic confidence self-score."""
    
    context_text = ""
    if context:
        context_text = "\n\nRELEVANT KNOWLEDGE BASE:\n" + "\n".join([
            f"- {doc[:300]}..." for doc in context if doc
        ])
    
    prompt = f"""
    You are an AI support agent. Generate a helpful draft reply to this customer email.
    
    CUSTOMER NAME: {sender_name}
    SUBJECT: {email_subject}
    BODY: {email_body[:800]}
    {context_text}
    
    TONE: {tone}
    MAX WORDS: {max_length}
    LANGUAGE: {language}
    
    Generate a reply that:
    1. Addresses the customer by name: {sender_name}
    2. Acknowledges the customer's issue
    3. Provides helpful information (use context if available)
    4. Gives clear next steps
    5. Is concise (max {max_length} words)
    
    Return in this format:
    SUBJECT: [Your draft subject line]
    BODY: [Your draft email body]
    
    ---
    
    IMPORTANT: After generating the draft, rate your confidence in this reply from 0 to 100.
    Consider:
    - Did I correctly understand the customer's issue? (0-25)
    - Is the context relevant and correctly applied? (0-25)
    - Is the tone appropriate? (0-25)
    - Would this reply actually help the customer? (0-25)
    
    CONFIDENCE: [Your score from 0-100]
    """
    
    try:
        response = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents=prompt
        )
        text = response.text.strip()
        
        subject = ""
        body = text
        confidence = 0.75
        
        if "SUBJECT:" in text and "BODY:" in text:
            parts = text.split("BODY:")
            subject_part = parts[0].replace("SUBJECT:", "").strip()
            body = parts[1].strip() if len(parts) > 1 else ""
            subject = subject_part
        
        # Extract confidence score
        confidence_match = re.search(r'CONFIDENCE:\s*(\d+)', text)
        if confidence_match:
            confidence = int(confidence_match.group(1)) / 100
            body = re.sub(r'\n*CONFIDENCE:\s*\d+\s*\n*', '', body).strip()
        
        confidence = max(0.0, min(1.0, confidence))
        
        return {
            "subject": subject or f"Re: {email_subject}",
            "body": body,
            "confidence": round(confidence, 2)
        }
    except genai_errors.ServerError as e:
        print(f"⚠️ Primary model error: {e}, falling back to {FALLBACK_MODEL}")
        try:
            response = client.models.generate_content(
                model=FALLBACK_MODEL,
                contents=prompt
            )
            text = response.text.strip()
            
            subject = ""
            body = text
            confidence = 0.75
            
            if "SUBJECT:" in text and "BODY:" in text:
                parts = text.split("BODY:")
                subject_part = parts[0].replace("SUBJECT:", "").strip()
                body = parts[1].strip() if len(parts) > 1 else ""
                subject = subject_part
            
            confidence_match = re.search(r'CONFIDENCE:\s*(\d+)', text)
            if confidence_match:
                confidence = int(confidence_match.group(1)) / 100
                body = re.sub(r'\n*CONFIDENCE:\s*\d+\s*\n*', '', body).strip()
            
            confidence = max(0.0, min(1.0, confidence))
            
            return {
                "subject": subject or f"Re: {email_subject}",
                "body": body,
                "confidence": round(confidence, 2)
            }
        except Exception as e2:
            print(f"❌ Fallback model also failed: {e2}")
            return {
                "subject": f"Re: {email_subject}",
                "body": "Thank you for your email. Our team will review this and get back to you shortly.",
                "confidence": 0.50
            }
    except Exception as e:
        print(f"❌ Draft generation error: {e}")
        return {
            "subject": f"Re: {email_subject}",
            "body": "Thank you for your email. Our team will review this and get back to you shortly.",
            "confidence": 0.50
        }