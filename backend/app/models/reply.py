import uuid
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime

class ReplyRequest(BaseModel):
    
    email_subject: str = Field(
        ...,
        min_length = 1,
        max_length = 200,
        description = "Original Email Subject"
    )
    
    email_body: str = Field(
        ...,
        min_length = 10,
        max_length = 5000,
        description = "Original Email Body"
    )
    
    sender: str = Field(
        ...,
        description = "Customer Email"
    )
    
    sender_name: Optional[str] = Field(
        default = None,
        description = "Customer's name, if available."
    )
    
    tone: str = Field(
        default = "professional",
        description = "Reply Tone: Professional, Empathetic, Urgent, Formal, Friendly"
    )
    
    include_context: bool = Field(
        default=True,
        description="Search knowledge base for context"
    )
    
    max_length: int = Field(
        default=150,
        ge=50,
        le=500,
        description="Maximum words in reply"
    )
    
    language: str = Field(
        default="en",
        description="Reply language code (en, tl, es, etc.)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                  "email_subject": "Unable to reset my password",
                "email_body": "Hi, I've been trying to reset my password for the last hour but keep getting an error message. Can you please help?",
                "sender": "customer@example.com",
                "tone": "empathetic",
                "include_context": True,
                "max_length": 150,
                "language": "english"
            }
        }
    

    
class ReplyData(BaseModel):
    
    draft_id: str = Field(..., description="Unique draft identifier")
    email_id: str = Field(..., description="Email identifier")
    subject: str = Field(..., description="Draft subject line")
    body: str = Field(..., description="Draft email body")
    confidence: float = Field(..., ge=0, le=1)
    tone_used: str = Field(...)
    language: str = Field(...)
    word_count: int = Field(...)
    context_used: List[str] = Field(default_factory=list)
    context_confidence: float = Field(default=0.0, ge=0, le=1)
    requires_review: bool = Field(...)
    suggested_actions: List[str] = Field(default_factory=list)
    
class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str
    code: str


class StandardResponse(BaseModel):
    """Standard API response. Works for both success and error."""
    
    status: Literal["success", "error"] = Field(
        ...,
        description="Status of the response"
    )
    message: str = Field(..., description="Human-readable message")
    error_code: Optional[str] = Field(None, description="Error code")
    details: Optional[List[ErrorDetail]] = Field(None)
    timestamp: datetime = Field(default_factory=datetime.now)
    request_id: str = Field(..., description="Request tracking ID")
    processing_time_ms: Optional[float] = Field(None)
    
    data: Optional[ReplyData] = Field(None)

def success_response(
    data: ReplyData,
    message: str = "Request completed successfully",
    request_id: Optional[str] = None,
    processing_time_ms: Optional[float] = None
) -> StandardResponse:
    return StandardResponse(
        status="success",
        message=message,
        error_code=None,
        details=None,
        request_id=request_id or f"req_{uuid.uuid4().hex[:8]}",
        processing_time_ms=processing_time_ms,
        data=data
    )

def error_response(
    message: str,
    error_code: str,
    details: Optional[List[ErrorDetail]] = None,
    request_id: Optional[str] = None,
    processing_time_ms: Optional[float] = None
) -> StandardResponse:
    return StandardResponse(
        status="error", # only "error" allowed
        message=message,
        error_code=error_code,
        details=details,
        request_id=request_id or f"req_{uuid.uuid4().hex[:8]}",
        processing_time_ms=processing_time_ms,
        data=None
    )