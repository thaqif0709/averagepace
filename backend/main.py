import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Form, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from database import get_leaderboard, init_db, insert_run
from trust_score import analyze_gpx_bytes

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


@app.post("/api/upload")
async def upload(
    runner_name: str = Form(...),
    claimed_distance_km: float = Form(...),
    gpx_file: UploadFile = File(...),
):
    gpx_bytes = await gpx_file.read()
    result = analyze_gpx_bytes(gpx_bytes, claimed_distance_km=claimed_distance_km)

    saved = False
    error = None
    if result["score"] > 0 and result.get("duration_s"):
        saved, error = insert_run(
            runner_name=runner_name,
            distance_bucket=result["distance_bucket"],
            distance_km=result["distance_km"],
            duration_s=result["duration_s"],
            pace_sec_per_km=result.get("pace_sec_per_km"),
            trust_score=result["score"],
            tier=result["tier"],
            flags="; ".join(result["flags"]),
            gpx_hash=result["file_hash"],
        )
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
