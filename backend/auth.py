import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Header, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from database import get_user_by_id

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
SESSION_SECRET = os.environ["SESSION_SECRET"]
SESSION_TTL_DAYS = 30


def verify_google_credential(credential):
    """Verifies a Google ID token and returns its claims. Raises ValueError if invalid."""
    return id_token.verify_oauth2_token(credential, google_requests.Request(), GOOGLE_CLIENT_ID)


def issue_session_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS),
    }
    return jwt.encode(payload, SESSION_SECRET, algorithm="HS256")


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, SESSION_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = get_user_by_id(payload["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
