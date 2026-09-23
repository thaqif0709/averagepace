import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import Body, Depends, FastAPI, Form, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_user, get_current_user_optional, issue_session_token, verify_google_credential
from database import (
    create_post,
    follow_user,
    get_feed,
    get_follow_counts,
    get_followers,
    get_following,
    get_leaderboard,
    get_posts_for_user,
    get_user_public,
    init_db,
    insert_run,
    is_following,
    unfollow_user,
    upsert_user,
)
from trust_score import analyze_gpx_bytes, unverified_result

app = FastAPI(title="Averagepace API")

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

DISTANCE_LABELS = {"5k": "5K", "10k": "10K", "half": "Half Marathon", "marathon": "Marathon"}

init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/google")
def google_login(body: dict = Body(...)):
    credential = body.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing credential")
    try:
        claims = verify_google_credential(credential)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    user = upsert_user(
        google_sub=claims["sub"],
        email=claims["email"],
        name=claims.get("name") or claims["email"],
        avatar_url=claims.get("picture"),
    )
    token = issue_session_token(user["id"])
    return {"token": token, "user": user}


@app.get("/api/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.post("/api/posts")
def create_text_post(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    text = (body.get("body") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Post can't be empty")
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="Post is too long (max 500 characters)")
    return create_post(user_id=current_user["id"], body=text)


@app.get("/api/feed")
def feed(scope: str = "everyone", current_user: dict = Depends(get_current_user_optional)):
    if scope not in ("everyone", "following"):
        raise HTTPException(status_code=400, detail="Invalid scope")
    if scope == "following":
        if not current_user:
            raise HTTPException(status_code=401, detail="Sign in to see your following feed")
        rows = get_feed("following", user_id=current_user["id"])
    else:
        rows = get_feed("everyone")
    return {"posts": rows}


@app.get("/api/users/{user_id}")
def user_public_profile(user_id: int, current_user: dict = Depends(get_current_user_optional)):
    user = get_user_public(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    follower_count, following_count = get_follow_counts(user_id)
    return {
        **user,
        "follower_count": follower_count,
        "following_count": following_count,
        "is_following": is_following(current_user["id"], user_id) if current_user else False,
        "is_self": current_user is not None and current_user["id"] == user_id,
    }


@app.get("/api/users/{user_id}/posts")
def user_posts(user_id: int):
    if not get_user_public(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"posts": get_posts_for_user(user_id)}


@app.get("/api/users/{user_id}/followers")
def user_followers(user_id: int):
    return {"users": get_followers(user_id)}


@app.get("/api/users/{user_id}/following")
def user_following(user_id: int):
    return {"users": get_following(user_id)}


@app.post("/api/users/{user_id}/follow")
def follow(user_id: int, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Can't follow yourself")
    if not get_user_public(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    follow_user(current_user["id"], user_id)
    return {"following": True}


@app.delete("/api/users/{user_id}/follow")
def unfollow(user_id: int, current_user: dict = Depends(get_current_user)):
    unfollow_user(current_user["id"], user_id)
    return {"following": False}


@app.post("/api/upload")
async def upload(
    claimed_distance_km: float = Form(...),
    claimed_duration_s: float | None = Form(None),
    caption: str | None = Form(None),
    gpx_file: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
):
    runner_name = current_user["name"]
    has_gpx = gpx_file is not None and gpx_file.filename
    if has_gpx:
        gpx_bytes = await gpx_file.read()
        result = analyze_gpx_bytes(gpx_bytes, claimed_distance_km=claimed_distance_km)
    else:
        if not claimed_duration_s:
            raise HTTPException(status_code=400, detail="Provide either a GPX file or your time.")
        result = unverified_result(claimed_distance_km, claimed_duration_s)

    saved = False
    error = None
    if not has_gpx or (result["score"] > 0 and result.get("duration_s")):
        saved, run_id, error = insert_run(
            runner_name=runner_name,
            user_id=current_user["id"],
            distance_bucket=result["distance_bucket"],
            distance_km=result["distance_km"],
            duration_s=result.get("duration_s"),
            pace_sec_per_km=result.get("pace_sec_per_km"),
            trust_score=result["score"],
            tier=result["tier"],
            flags="; ".join(result["flags"]),
            gpx_hash=result["file_hash"],
        )
        if saved:
            create_post(user_id=current_user["id"], body=(caption or "").strip() or None, run_id=run_id)
    else:
        error = "Could not verify enough data in this file to record a time."

    return {
        "result": result,
        "runner_name": runner_name,
        "saved": saved,
        "error": error,
        "distance_label": DISTANCE_LABELS.get(result.get("distance_bucket"), ""),
    }


@app.get("/api/leaderboard")
def leaderboard(distance: str = "5k", tier: str = "all"):
    if distance not in DISTANCE_LABELS:
        raise HTTPException(status_code=400, detail="Invalid distance")
    if tier not in ("all", "green", "yellow", "red"):
        raise HTTPException(status_code=400, detail="Invalid tier")
    tier_filter = None if tier == "all" else tier
    rows = get_leaderboard(distance, tier_filter)
    return {
        "rows": rows,
        "distance": distance,
        "tier": tier,
        "distance_labels": DISTANCE_LABELS,
    }
