import os
import secrets
import json
from typing import List
from dotenv import load_dotenv

# Load .env file from backend or root directory
load_dotenv()

KNOWN_DEV_SECRETS = {
    "pregtwin-secure-research-secret-key-3.14-jwt-token-seed-2026",
    "change-me",
    "secret",
    "dev-secret",
}

class Settings:
    PROJECT_NAME: str = "PregTwin Maternal Digital Twin Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()
    
    # Secret Key Validation
    _raw_secret = os.getenv("SECRET_KEY", "").strip()
    if ENVIRONMENT == "production":
        if not _raw_secret or _raw_secret in KNOWN_DEV_SECRETS or len(_raw_secret) < 32:
            raise RuntimeError(
                "FATAL: Insecure or missing SECRET_KEY in production mode. "
                "A unique cryptographically strong key of at least 32 characters is required."
            )
        SECRET_KEY: str = _raw_secret
    else:
        # Development / test mode: generate or use configured key
        if _raw_secret and _raw_secret not in KNOWN_DEV_SECRETS:
            SECRET_KEY: str = _raw_secret
        else:
            # Ephemeral or dev key
            SECRET_KEY: str = _raw_secret or secrets.token_hex(32)

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Persistence
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./pregtwin.db")
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")
    STORAGE_PATH: str = os.getenv("STORAGE_PATH", "./storage/documents")
    
    # CORS Configuration
    _raw_cors = os.getenv("CORS_ORIGINS", "")
    if _raw_cors:
        try:
            if _raw_cors.strip().startswith("["):
                CORS_ORIGINS: List[str] = json.loads(_raw_cors)
            else:
                CORS_ORIGINS: List[str] = [origin.strip() for origin in _raw_cors.split(",") if origin.strip()]
        except Exception:
            CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    else:
        CORS_ORIGINS: List[str] = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    
    # Security: disallow wildcard '*' if credentials are enabled
    if "*" in CORS_ORIGINS and ENVIRONMENT == "production":
        raise RuntimeError("FATAL: Wildcard '*' in CORS_ORIGINS is forbidden when credentials are enabled.")
    
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
