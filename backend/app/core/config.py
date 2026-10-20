import os
from typing import List

class Settings:
    PROJECT_NAME: str = "PregTwin Maternal Digital Twin Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "pregtwin-secure-research-secret-key-3.14-jwt-token-seed-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Persistence
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./pregtwin.db")
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")
    STORAGE_PATH: str = os.getenv("STORAGE_PATH", "./storage/documents")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # AI & Extraction Provider
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "openai")  # openai, ollama, or fallback
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2-vision")
    
    # OCR Engine
    OCR_ENGINE: str = os.getenv("OCR_ENGINE", "tesseract")
    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "")
    
    # Model & Research Configuration
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")
    MODEL_ARTIFACT_PATH: str = os.getenv("MODEL_ARTIFACT_PATH", "./artifacts/preeclampsia_model.joblib")
    MODEL_VERSION: str = "v1.4.2-longitudinal-preeclampsia"
    DEFAULT_PREDICTION_HORIZON_DAYS: int = 14  # 2-week risk prediction horizon

settings = Settings()
