from pathlib import Path

from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from database import init_db, insert_run, get_leaderboard
from trust_score import analyze_gpx_bytes

BASE_DIR = Path(__file__).parent

app = FastAPI(title="Averagepace")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

DISTANCE_LABELS = {"5k": "5K", "10k": "10K", "half": "Half Marathon", "marathon": "Marathon"}

init_db()


def fmt_duration(seconds):
    if seconds is None:
        return "--:--"
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def fmt_pace(sec_per_km):
    if not sec_per_km:
        return "--:--"
    m, s = divmod(int(sec_per_km), 60)
    return f"{m}:{s:02d}/km"


templates.env.filters["duration"] = fmt_duration
templates.env.filters["pace"] = fmt_pace


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(request, "upload.html", {"result": None})


@app.post("/upload", response_class=HTMLResponse)
async def upload(
    request: Request,
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

    return templates.TemplateResponse(request, "upload.html", {
        "result": result,
        "runner_name": runner_name,
        "saved": saved,
        "error": error,
        "distance_label": DISTANCE_LABELS.get(result.get("distance_bucket"), ""),
    })


@app.get("/leaderboard", response_class=HTMLResponse)
def leaderboard(request: Request, distance: str = "5k", tier: str = "all"):
    tier_filter = None if tier == "all" else tier
    rows = get_leaderboard(distance, tier_filter)
    return templates.TemplateResponse(request, "leaderboard.html", {
        "rows": rows,
        "distance": distance,
        "tier": tier,
        "distance_labels": DISTANCE_LABELS,
    })
