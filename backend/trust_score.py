"""
GPX trust-scoring logic. See README.md for how the checks work.
"""
import hashlib
import math

import gpxpy

PACE_FLOOR_SEC_PER_KM = {
    "5k": 2 * 60 + 20,
    "10k": 2 * 60 + 25,
    "half": 2 * 60 + 35,
    "marathon": 2 * 60 + 50,
}

MAX_PLAUSIBLE_SPEED_MPS = 10.0
DISTANCE_TOLERANCE_PCT = 0.05


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def bucket_for_distance(km):
    if km < 7:
        return "5k"
    elif km < 15:
        return "10k"
    elif km < 30:
        return "half"
    else:
        return "marathon"


def unverified_result(claimed_distance_km, claimed_duration_s):
    """Shape of an analyze_gpx_bytes() result, for a manually-entered submission (no GPX)."""
    pace_sec_per_km = claimed_duration_s / claimed_distance_km if claimed_distance_km else None
    return {
        "score": 0,
        "tier": "red",
        "flags": ["No GPX file provided — submission could not be verified."],
        "file_hash": None,
        "duration_s": claimed_duration_s,
        "distance_km": claimed_distance_km,
        "pace_sec_per_km": pace_sec_per_km,
        "distance_bucket": bucket_for_distance(claimed_distance_km),
    }


def analyze_gpx_bytes(gpx_bytes, claimed_distance_km=None):
    """Same logic as the CLI prototype, but takes raw bytes (from an upload)."""
    gpx = gpxpy.parse(gpx_bytes.decode("utf-8"))

    points = []
    for track in gpx.tracks:
        for segment in track.segments:
            for p in segment.points:
                points.append(p)

    flags = []
    score = 100

    if len(points) < 2:
        return {"score": 0, "tier": "red (flagged, manual review required)",
                "flags": ["No usable GPS track points found."],
                "file_hash": hashlib.sha256(gpx_bytes).hexdigest()}

    total_distance_m = 0.0
    max_speed_mps = 0.0
    speed_jump_count = 0
    elevations = [p.elevation for p in points if p.elevation is not None]

    for a, b in zip(points, points[1:]):
        d = haversine_m(a.latitude, a.longitude, b.latitude, b.longitude)
        total_distance_m += d
        if a.time and b.time:
            dt = (b.time - a.time).total_seconds()
            if dt > 0:
                speed = d / dt
                max_speed_mps = max(max_speed_mps, speed)
                if speed > MAX_PLAUSIBLE_SPEED_MPS:
                    speed_jump_count += 1

    total_distance_km = total_distance_m / 1000
    start_time = points[0].time
    end_time = points[-1].time
    duration_s = (end_time - start_time).total_seconds() if start_time and end_time else None

    result = {
        "file_hash": hashlib.sha256(gpx_bytes).hexdigest(),
        "gps_distance_km": round(total_distance_km, 3),
        "duration_s": duration_s,
        "max_instantaneous_speed_mps": round(max_speed_mps, 2),
        "num_points": len(points),
    }

    if speed_jump_count > 0:
        pct = speed_jump_count / len(points) * 100
        deduction = min(30, speed_jump_count * 3)
        score -= deduction
        flags.append(
            f"{speed_jump_count} GPS speed jumps above {MAX_PLAUSIBLE_SPEED_MPS} m/s "
            f"({pct:.1f}% of points)."
        )

    pace_sec_per_km = None
    bucket = bucket_for_distance(total_distance_km)
    if duration_s and total_distance_km > 0:
        pace_sec_per_km = duration_s / total_distance_km
        floor = PACE_FLOOR_SEC_PER_KM[bucket]
        result["pace_sec_per_km"] = round(pace_sec_per_km, 1)
        result["distance_bucket"] = bucket
        if pace_sec_per_km < floor:
            score -= 50
            flags.append(
                f"Pace ({pace_sec_per_km:.0f} s/km) is faster than the physiological "
                f"floor for {bucket} ({floor} s/km)."
            )

    if claimed_distance_km:
        diff_pct = abs(total_distance_km - claimed_distance_km) / claimed_distance_km
        result["claimed_distance_km"] = claimed_distance_km
        result["distance_diff_pct"] = round(diff_pct * 100, 1)
        if diff_pct > DISTANCE_TOLERANCE_PCT:
            deduction = min(25, diff_pct * 100)
            score -= deduction
            flags.append(
                f"GPS distance ({total_distance_km:.2f} km) differs from claimed "
                f"({claimed_distance_km:.2f} km) by {diff_pct*100:.1f}%."
            )

    if elevations:
        gain = sum(max(0, b - a) for a, b in zip(elevations, elevations[1:]))
        result["elevation_gain_m"] = round(gain, 1)
        if total_distance_km > 0 and gain / total_distance_km > 100:
            score -= 10
            flags.append(f"Elevation gain ({gain:.0f} m) unusually high for the distance.")

    if duration_s is None:
        score -= 40
        flags.append("Track has no timestamps -- cannot verify pace or duration.")

    score = max(0, min(100, round(score)))

    if score >= 85:
        tier = "green"
    elif score >= 50:
        tier = "yellow"
    else:
        tier = "red"

    result["score"] = score
    result["tier"] = tier
    result["flags"] = flags
    result["duration_s"] = duration_s
    result["distance_km"] = total_distance_km
    result["pace_sec_per_km"] = pace_sec_per_km
    result["distance_bucket"] = bucket
    return result
