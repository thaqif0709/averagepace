import os
import re
from datetime import date
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

from fastapi import Body, Depends, FastAPI, Form, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_admin_user, get_current_user, get_current_user_optional, issue_session_token, verify_google_credential
from database import (
    accept_follow_request,
    can_view_private_content,
    create_post,
    decline_follow_request,
    delete_post,
    delete_run,
    follow_user,
    get_best_efforts,
    get_feed,
    get_follow_counts,
    get_follow_status,
    get_followers,
    get_following,
    get_leaderboard,
    get_like_count,
    get_pending_follow_requests,
    get_posts_for_user,
    get_recently_verified,
    get_review_queue,
    get_user_by_id,
    get_user_by_username,
    get_user_runs_by_distance,
    get_vouch_count,
    init_db,
    insert_run,
    is_username_taken,
    like_post,
    search_people,
    search_posts,
    search_runs_by_event,
    set_user_privacy,
    set_username,
    suggest_event_names,
    unfollow_user,
    unlike_post,
    unverify_run,
    unvouch_for_run,
    update_post,
    update_run_metadata,
    upsert_user,
    verify_run,
    vouch_for_run,
)
from trust_score import analyze_gpx_bytes, linked_result, unverified_result

app = FastAPI(title="AveragePace API")

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

DISTANCE_LABELS = {"5k": "5K", "10k": "10K", "half": "Half Marathon", "marathon": "Marathon"}
USERNAME_RE = re.compile(r"^(?=.*[A-Za-z_])[A-Za-z0-9_]{3,20}$")

init_db()


def clean_username(username):
    """Validates a proposed username. Raises HTTPException on bad input,
    else returns it unchanged - case as typed is what's stored/displayed,
    uniqueness is enforced case-insensitively at the DB level."""
    clean = (username or "").strip()
    if not USERNAME_RE.match(clean):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-20 characters: letters, numbers, and underscores only",
        )
    return clean


def clean_run_metadata(event_name, time_type, result_url, event_date):
    """Shared validation for the run fields that stay editable after
    submission (unlike distance/duration). Raises HTTPException on bad input,
    else returns (event_name, time_type, result_url, event_date) cleaned/normalized."""
    clean_event_name = (event_name or "").strip() or None
    if clean_event_name and len(clean_event_name) > 200:
        raise HTTPException(status_code=400, detail="Event name is too long (max 200 characters)")

    clean_time_type = (time_type or "").strip().lower() or None
    if clean_time_type and clean_time_type not in ("gun", "chip"):
        raise HTTPException(status_code=400, detail="Time type must be 'gun' or 'chip'")

    clean_result_url = (result_url or "").strip() or None
    if clean_result_url:
        if len(clean_result_url) > 2000:
            raise HTTPException(status_code=400, detail="Result link is too long")
        parsed = urlparse(clean_result_url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise HTTPException(status_code=400, detail="Result link must be a valid http:// or https:// URL")

    clean_event_date = (event_date or "").strip() or None
    if clean_event_date:
        try:
            clean_event_date = date.fromisoformat(clean_event_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Event date must be a valid date")

    return clean_event_name, clean_time_type, clean_result_url, clean_event_date


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
    is_new_user = user.pop("is_new_user")
    token = issue_session_token(user["id"])
    return {"token": token, "user": user, "is_new_user": is_new_user}


@app.get("/api/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.patch("/api/auth/me")
def update_me(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    if "is_private" not in body and "username" not in body:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "username" in body:
        clean = clean_username(body["username"])
        updated = set_username(current_user["id"], clean)
        if updated is None:
            raise HTTPException(status_code=409, detail="That username is already taken")
    if "is_private" in body:
        set_user_privacy(current_user["id"], bool(body["is_private"]))
    return get_user_by_id(current_user["id"])


@app.get("/api/username/check")
def check_username(username: str, current_user: dict = Depends(get_current_user_optional)):
    clean = (username or "").strip()
    if not USERNAME_RE.match(clean):
        return {"available": False, "reason": "invalid"}
    exclude_id = current_user["id"] if current_user else None
    taken = is_username_taken(clean, exclude_user_id=exclude_id)
    return {"available": not taken, "reason": "taken" if taken else None}


@app.post("/api/posts")
def create_text_post(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    text = (body.get("body") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Post can't be empty")
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="Post is too long (max 500 characters)")
    return create_post(user_id=current_user["id"], body=text)


@app.patch("/api/posts/{post_id}")
def edit_post(post_id: int, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    text = (body.get("body") or "").strip()
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="Post is too long (max 500 characters)")
    updated, error = update_post(post_id, current_user["id"], text or None)
    if error == "empty":
        raise HTTPException(status_code=400, detail="Post can't be empty")
    if not updated:
        raise HTTPException(status_code=404, detail="Post not found")

    if updated["run_id"]:
        event_name, time_type, result_url, event_date = clean_run_metadata(
            body.get("event_name"), body.get("time_type"), body.get("result_url"), body.get("event_date")
        )
        run = update_run_metadata(updated["run_id"], current_user["id"], event_name, time_type, result_url, event_date)
        if run:
            updated["event_name"] = run["event_name"]
            updated["time_type"] = run["time_type"]
            updated["result_url"] = run["result_url"]
            updated["event_date"] = run["event_date"]

    return updated


@app.delete("/api/posts/{post_id}")
def remove_post(post_id: int, current_user: dict = Depends(get_current_user)):
    """Only for text-only posts - a run-attached post is deleted via
    DELETE /api/runs/{id} instead, which cascades to the post automatically."""
    if not delete_post(post_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="Post not found")
    return {"deleted": True}


@app.post("/api/posts/{post_id}/like")
def like(post_id: int, current_user: dict = Depends(get_current_user)):
    ok, error = like_post(current_user["id"], post_id)
    if error == "not_found":
        raise HTTPException(status_code=404, detail="Post not found")
    if error == "self":
        raise HTTPException(status_code=400, detail="Can't like your own post")
    return {"liked": True, "like_count": get_like_count(post_id)}


@app.delete("/api/posts/{post_id}/like")
def unlike(post_id: int, current_user: dict = Depends(get_current_user)):
    unlike_post(current_user["id"], post_id)
    return {"liked": False, "like_count": get_like_count(post_id)}


@app.patch("/api/runs/{run_id}")
def edit_run(run_id: int, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Metadata-only edit for a run directly (no attached post/caption in
    play) - the Best Efforts drill-down uses this rather than PATCH
    /api/posts/{id}, since it never shows a caption to begin with."""
    event_name, time_type, result_url, event_date = clean_run_metadata(
        body.get("event_name"), body.get("time_type"), body.get("result_url"), body.get("event_date")
    )
    updated = update_run_metadata(run_id, current_user["id"], event_name, time_type, result_url, event_date)
    if not updated:
        raise HTTPException(status_code=404, detail="Run not found")
    return updated


@app.delete("/api/runs/{run_id}")
def remove_run(run_id: int, current_user: dict = Depends(get_current_user)):
    if not delete_run(run_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"deleted": True}


@app.get("/api/feed")
def feed(scope: str = "everyone", current_user: dict = Depends(get_current_user_optional)):
    if scope not in ("everyone", "following"):
        raise HTTPException(status_code=400, detail="Invalid scope")
    viewer_id = current_user["id"] if current_user else None
    if scope == "following":
        if not current_user:
            raise HTTPException(status_code=401, detail="Sign in to see your following feed")
        rows = get_feed("following", user_id=current_user["id"], viewer_id=viewer_id)
    else:
        rows = get_feed("everyone", viewer_id=viewer_id)
    return {"posts": rows}


@app.get("/api/users/{username}")
def user_public_profile(username: str, current_user: dict = Depends(get_current_user_optional)):
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user["id"]
    follower_count, following_count = get_follow_counts(user_id)
    is_self = current_user is not None and current_user["id"] == user_id
    if is_self:
        follow_status = "self"
    elif current_user:
        follow_status = get_follow_status(current_user["id"], user_id)
    else:
        follow_status = "none"
    return {
        **user,
        "follower_count": follower_count,
        "following_count": following_count,
        "follow_status": follow_status,
        "is_self": is_self,
    }


@app.get("/api/users/{username}/posts")
def user_posts(username: str, current_user: dict = Depends(get_current_user_optional)):
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user["id"]
    viewer_id = current_user["id"] if current_user else None
    if not can_view_private_content(user_id, viewer_id, user["is_private"]):
        return {"posts": [], "gated": True}
    return {"posts": get_posts_for_user(user_id, viewer_id=viewer_id), "gated": False}


@app.get("/api/users/{username}/best-efforts")
def user_best_efforts(username: str, current_user: dict = Depends(get_current_user_optional)):
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user["id"]
    viewer_id = current_user["id"] if current_user else None
    if not can_view_private_content(user_id, viewer_id, user["is_private"]):
        return {"best_efforts": [], "gated": True}
    return {"best_efforts": get_best_efforts(user_id), "gated": False}


@app.get("/api/users/{username}/runs")
def user_runs(username: str, distance: str, current_user: dict = Depends(get_current_user_optional)):
    if distance not in DISTANCE_LABELS:
        raise HTTPException(status_code=400, detail="Invalid distance")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user["id"]
    viewer_id = current_user["id"] if current_user else None
    if not can_view_private_content(user_id, viewer_id, user["is_private"]):
        return {"runs": [], "gated": True, "distance": distance}
    return {"runs": get_user_runs_by_distance(user_id, distance), "gated": False, "distance": distance}


@app.get("/api/events/suggest")
def event_suggestions(q: str = ""):
    clean_q = q.strip()
    if len(clean_q) < 2:
        return {"suggestions": []}
    return {"suggestions": suggest_event_names(clean_q)}


@app.get("/api/search")
def search(q: str = "", type: str = "people", current_user: dict = Depends(get_current_user_optional)):
    if type not in ("people", "posts", "runs"):
        raise HTTPException(status_code=400, detail="Invalid search type")
    clean_q = q.strip()
    if len(clean_q) < 2:
        return {"results": [], "type": type}
    viewer_id = current_user["id"] if current_user else None
    if type == "people":
        results = search_people(clean_q)
    elif type == "posts":
        results = search_posts(clean_q, viewer_id=viewer_id)
    else:
        results = search_runs_by_event(clean_q, viewer_id=viewer_id)
    return {"results": results, "type": type}


@app.get("/api/users/{username}/followers")
def user_followers(username: str, current_user: dict = Depends(get_current_user_optional)):
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user["id"]
    viewer_id = current_user["id"] if current_user else None
    if not can_view_private_content(user_id, viewer_id, user["is_private"]):
        return {"users": [], "gated": True}
    return {"users": get_followers(user_id), "gated": False}


@app.get("/api/users/{username}/following")
def user_following(username: str, current_user: dict = Depends(get_current_user_optional)):
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user["id"]
    viewer_id = current_user["id"] if current_user else None
    if not can_view_private_content(user_id, viewer_id, user["is_private"]):
        return {"users": [], "gated": True}
    return {"users": get_following(user_id), "gated": False}


@app.post("/api/users/{username}/follow")
def follow(username: str, current_user: dict = Depends(get_current_user)):
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user["id"]
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Can't follow yourself")
    status = follow_user(current_user["id"], user_id)
    return {"status": status}


@app.delete("/api/users/{username}/follow")
def unfollow(username: str, current_user: dict = Depends(get_current_user)):
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    unfollow_user(current_user["id"], user["id"])
    return {"status": "none"}


@app.get("/api/follow-requests")
def follow_requests(current_user: dict = Depends(get_current_user)):
    return {"requests": get_pending_follow_requests(current_user["id"])}


@app.post("/api/follow-requests/{requester_id}/accept")
def accept_request(requester_id: int, current_user: dict = Depends(get_current_user)):
    if not accept_follow_request(current_user["id"], requester_id):
        raise HTTPException(status_code=404, detail="No pending request from this user")
    return {"status": "accepted"}


@app.post("/api/follow-requests/{requester_id}/decline")
def decline_request(requester_id: int, current_user: dict = Depends(get_current_user)):
    if not decline_follow_request(current_user["id"], requester_id):
        raise HTTPException(status_code=404, detail="No pending request from this user")
    return {"status": "declined"}


@app.post("/api/runs/{run_id}/vouch")
def vouch(run_id: int, current_user: dict = Depends(get_current_user)):
    ok, error = vouch_for_run(current_user["id"], run_id)
    if error == "not_found":
        raise HTTPException(status_code=404, detail="Run not found")
    if error == "self":
        raise HTTPException(status_code=400, detail="Can't vouch for your own run")
    return {"vouched": True, "vouch_count": get_vouch_count(run_id)}


@app.delete("/api/runs/{run_id}/vouch")
def unvouch(run_id: int, current_user: dict = Depends(get_current_user)):
    unvouch_for_run(current_user["id"], run_id)
    return {"vouched": False, "vouch_count": get_vouch_count(run_id)}


@app.post("/api/upload")
async def upload(
    claimed_distance_km: float = Form(...),
    claimed_duration_s: float | None = Form(None),
    result_url: str | None = Form(None),
    time_type: str | None = Form(None),
    event_name: str | None = Form(None),
    event_date: str | None = Form(None),
    caption: str | None = Form(None),
    gpx_file: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
):
    runner_name = current_user["name"]
    has_gpx = gpx_file is not None and gpx_file.filename

    clean_event_name, clean_time_type, clean_result_url, clean_event_date = clean_run_metadata(
        event_name, time_type, result_url, event_date
    )

    if has_gpx:
        gpx_bytes = await gpx_file.read()
        result = analyze_gpx_bytes(gpx_bytes, claimed_distance_km=claimed_distance_km)
    else:
        if not claimed_duration_s:
            raise HTTPException(status_code=400, detail="Provide either a GPX file or your time.")
        if clean_result_url:
            result = linked_result(claimed_distance_km, claimed_duration_s, clean_result_url)
        else:
            result = unverified_result(claimed_distance_km, claimed_duration_s)

    result["time_type"] = clean_time_type
    result["event_name"] = clean_event_name
    result["event_date"] = clean_event_date

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
            result_url=result.get("result_url"),
            time_type=clean_time_type,
            event_name=clean_event_name,
            event_date=clean_event_date,
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


@app.get("/api/admin/review-queue")
def admin_review_queue(current_admin: dict = Depends(get_current_admin_user)):
    return {"runs": get_review_queue()}


@app.get("/api/admin/verified")
def admin_verified_runs(current_admin: dict = Depends(get_current_admin_user)):
    return {"runs": get_recently_verified()}


@app.post("/api/admin/runs/{run_id}/verify")
def admin_verify_run(run_id: int, current_admin: dict = Depends(get_current_admin_user)):
    updated = verify_run(run_id, current_admin["id"])
    if not updated:
        raise HTTPException(status_code=404, detail="Run not found")
    return updated


@app.post("/api/admin/runs/{run_id}/unverify")
def admin_unverify_run(run_id: int, current_admin: dict = Depends(get_current_admin_user)):
    updated = unverify_run(run_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Run not found")
    return updated
