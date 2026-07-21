from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(
    title="Agentic Workplace Assistant",
    description="AI-powered email support agent using Gemini",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for hackathon
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the reply routes with /api prefix
app.include_router(router, prefix="/api")

# ----- Root Endpoints -----

@app.get("/")
async def root():
    return {
        "message": "Agentic Workplace Assistant API",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/test-ai")
async def test_ai():
    from app.services.gemini import test_connection
    return test_connection()