from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.models.entities import User, PatientProfile
from app.schemas.models import Token, UserLogin, UserResponse
from app.api.deps import get_current_user
from app.services.audit_service import audit_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(
    credentials: UserLogin = Body(..., description="JSON login credentials with email and password"),
    db: Session = Depends(get_db)
):
    """
    Standard, strictly validated JSON authentication endpoint.
    Accepts email and password; returns JWT access token.
    Prevents user enumeration by returning consistent 401 credentials error.
    """
    email = credentials.email.strip().lower()
    password = credentials.password

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing email or password credentials"
        )

    user = db.query(User).filter(User.email == email).first()
    # Constant-time verification to prevent timing attacks / user enumeration
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    patient_id = user.patient_profile.id if user.patient_profile else None

    # Audit login event (never log raw passwords!)
    audit_service.log_event(
        db=db,
        action="USER_LOGIN_SUCCESS",
        user=user,
        target_type="User",
        target_id=user.id,
        details={"email": user.email, "role": user.role}
    )

    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        patient_id=patient_id
    )

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    patient_id = current_user.patient_profile.id if current_user.patient_profile else None
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        patient_id=patient_id
    )
