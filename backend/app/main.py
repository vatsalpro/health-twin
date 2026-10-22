import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base
from app.seed.seed_data import seed_database
from app.api import (
    auth,
    patients,
    documents,
    observations,
    twin,
    predictions,
    simulation,
    clinician,
    audit,
    devices,
    measurements,
    camera_research,
    medications,
    appointments,
    notifications,
    emergency,
    ai_assistant,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist and seed default synthetic data
    Base.metadata.create_all(bind=engine)
    if settings.DEMO_MODE:
        try:
            seed_database()
        except Exception as e:
            print(f"Seed notice: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="PregTwin: Longitudinal Maternal Digital-Twin Platform for Preeclampsia Risk Research",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
api_v1_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1_prefix)
app.include_router(patients.router, prefix=api_v1_prefix)
app.include_router(documents.router, prefix=api_v1_prefix)
app.include_router(observations.router, prefix=api_v1_prefix)
app.include_router(twin.router, prefix=api_v1_prefix)
app.include_router(predictions.router, prefix=api_v1_prefix)
app.include_router(simulation.router, prefix=api_v1_prefix)
app.include_router(devices.router, prefix=api_v1_prefix)
app.include_router(measurements.router, prefix=api_v1_prefix)
app.include_router(camera_research.router, prefix=api_v1_prefix)
app.include_router(clinician.router, prefix=api_v1_prefix)
app.include_router(audit.router, prefix=api_v1_prefix)
app.include_router(medications.router, prefix=api_v1_prefix)
app.include_router(appointments.router, prefix=api_v1_prefix)
app.include_router(notifications.router, prefix=api_v1_prefix)
app.include_router(emergency.router, prefix=api_v1_prefix)
app.include_router(ai_assistant.router, prefix=api_v1_prefix)

@app.get("/")
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "status": "online",
        "documentation": "/docs",
        "version": settings.MODEL_VERSION,
        "environment": "demo_research" if settings.DEMO_MODE else "production"
    }

@app.get("/health")
def healthcheck():
    return {"status": "healthy"}

@app.get("/ready")
def readiness_check():
    """Readiness probe verifying database connectivity and storage directory availability."""
    db_ok = False
    storage_ok = False
    details = {}
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
        details["database"] = "connected"
    except Exception as e:
        details["database"] = f"unreachable: {str(e)}"

    try:
        os.makedirs(settings.STORAGE_PATH, exist_ok=True)
        storage_ok = os.path.exists(settings.STORAGE_PATH) and os.access(settings.STORAGE_PATH, os.W_OK)
        details["storage"] = "writable" if storage_ok else "not_writable"
    except Exception as e:
        details["storage"] = f"error: {str(e)}"

    if db_ok and storage_ok:
        return {"status": "ready", "details": details}
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=503, content={"status": "not_ready", "details": details})
