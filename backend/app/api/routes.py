from fastapi import APIRouter, HTTPException, status
from datetime import datetime
import uuid
import time
import re

from app.models import (
    ReplyRequest,
    ReplyData,
    StandardResponse,
    ErrorDetail,
    success_response,
    error_response
)
from app.services.gemini import classify_email, generate_draft  # ← Removed search_knowledge
from app.services.knowledge_service import knowledge_service  # ← Added this

router = APIRouter(tags=["reply"])

# Confidence threshold - drafts below this need human review
CONFIDENCE_THRESHOLD = 0.70

# Weight for confidence calculation
BASE_WEIGHT = 0.6
CONTEXT_WEIGHT = 0.4


def extract_sender_name(email_body: str, sender_email: str) -> str:
    """Extract sender name from email body or fallback to email."""
    
    # Try to extract from email body
    patterns = [
        r"(?:I am|I'm|my name is|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
        r"(?:thanks|thank you|regards|sincerely|best),?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
        r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*$",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, email_body, re.MULTILINE | re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    # Fallback: extract from email
    username = sender_email.split('@')[0]
    name_parts = re.sub(r'[._-]', ' ', username).title()
    
    return name_parts if name_parts else "Valued Customer"


@router.post(
    "/reply",
    response_model=StandardResponse,
    responses={
        200: {"description": "Success", "model": StandardResponse},
        400: {"description": "Validation Error", "model": StandardResponse},
        429: {"description": "Rate Limit", "model": StandardResponse},
        503: {"description": "AI Service Unavailable", "model": StandardResponse},
        500: {"description": "Internal Error", "model": StandardResponse}
    }
)
async def generate_reply(request: ReplyRequest):
    """
    Generate an AI-powered draft reply for a customer email.
    
    This endpoint:
    1. Classifies the email (category, priority, sentiment)
    2. Searches knowledge base for relevant context (if enabled)
    3. Generates a draft reply using Gemini
    4. Returns the draft with confidence scoring and suggested actions
    """
    start_time = time.time()
    request_id = f"req_{uuid.uuid4().hex[:8]}"
    
    try:
        # ----- Step 1: Extract sender name -----
        sender_name = request.sender_name
        if not sender_name:
            sender_name = extract_sender_name(request.email_body, request.sender)
        
        # ----- Step 2: Classify the email -----
        try:
            classification = await classify_email(
                email_body=request.email_body,
                email_subject=request.email_subject
            )
        except Exception as e:
            # Fallback classification if Gemini fails
            classification = {
                "category": "general",
                "priority": "medium",
                "action_items": ["review email"],
                "sentiment": "neutral"
            }
        
        # ----- Step 3: Search knowledge base (if enabled) -----
        context = []
        context_confidence = 0.0
        
        if request.include_context:
            try:
                context = knowledge_service.search(
                    query=f"{request.email_subject} {request.email_body[:500]}",
                    top_k=3
                    )
                if context:
                    context_confidence = 0.85
            except Exception as e:
                print(f"⚠️ Context search failed: {e}")
                context = []
        
        # ----- Step 4: Generate draft using Gemini -----
        try:
            draft_data = await generate_draft(
                email_body=request.email_body,
                email_subject=request.email_subject,
                sender_name=sender_name,
                context=[doc.get('snippet', '') for doc in context],
                tone=request.tone,
                max_length=request.max_length,
                language=request.language
            )
        except Exception as e:
            # 503 Service Unavailable for Gemini failures
            error_response_data = error_response(
                message="AI service temporarily unavailable",
                error_code="AI_SERVICE_UNAVAILABLE",
                details=[ErrorDetail(
                    field=None,
                    message=str(e),
                    code="GEMINI_ERROR"
                )],
                request_id=request_id,
                processing_time_ms=(time.time() - start_time) * 1000
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=error_response_data.model_dump()
            )
        
        # ----- Step 5: Calculate confidence (Context-Adaptive) -----
        base_confidence = draft_data.get("confidence", 0.75)
        
        if request.include_context:
            # Context was requested
            if context:
                # Context found: average both
                combined_confidence = (base_confidence * BASE_WEIGHT) + (context_confidence * CONTEXT_WEIGHT)
            else:
                # Context requested but none found: slight penalty (5%)
                combined_confidence = base_confidence * 0.95
        else:
            # Context not requested: use base confidence only
            combined_confidence = base_confidence
        
        # Round to 2 decimal places
        combined_confidence = round(combined_confidence, 2)
        
        # ----- Step 6: Determine if human review is needed -----
        requires_review = combined_confidence < CONFIDENCE_THRESHOLD
        
        # ----- Step 7: Generate suggested actions -----
        suggested_actions = []
        if requires_review:
            suggested_actions.append("Review draft before sending")
        else:
            suggested_actions.append("Send draft to customer")
            suggested_actions.append("Schedule follow-up in 24 hours")
        
        priority = classification.get("priority", "medium")
        if priority in ["high", "urgent"]:
            suggested_actions.append("Prioritize this customer request")
        
        # If no context was found but was requested, suggest knowledge base update
        if request.include_context and not context:
            suggested_actions.append("Consider adding this question to knowledge base")
        
        # ----- Step 8: Build response data -----
        processing_time = (time.time() - start_time) * 1000
        
        reply_data = ReplyData(
            draft_id=f"draft_{uuid.uuid4().hex[:8]}",
            email_id=f"email_{uuid.uuid4().hex[:8]}",
            subject=draft_data.get("subject", f"Re: {request.email_subject}"),
            body=draft_data.get("body", "Thank you for your email. Our team will review this and get back to you shortly."),
            confidence=combined_confidence,
            tone_used=request.tone,
            language=request.language,
            word_count=len(draft_data.get("body", "").split()),
            context_used=[doc.get('document', 'Unknown') for doc in context],
            context_confidence=round(context_confidence, 2),
            requires_review=requires_review,
            suggested_actions=suggested_actions
        )
        
        # ----- Step 9: Return success response (200 OK) -----
        return success_response(
            data=reply_data,
            message="Draft generated successfully",
            request_id=request_id,
            processing_time_ms=round(processing_time, 2)
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (already handled)
        raise
    except Exception as e:
        # 500 Internal Server Error for unexpected failures
        error_response_data = error_response(
            message="Internal server error",
            error_code="INTERNAL_ERROR",
            details=[ErrorDetail(
                field=None,
                message=str(e),
                code="UNKNOWN"
            )],
            request_id=request_id,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response_data.model_dump()
        )