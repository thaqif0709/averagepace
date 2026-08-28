import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "averagepace.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            runner_name TEXT NOT NULL,
            distance_bucket TEXT NOT NULL,
            distance_km REAL NOT NULL,
            duration_s REAL NOT NULL,
            pace_sec_per_km REAL,
            trust_score INTEGER NOT NULL,
            tier TEXT NOT NULL,
            flags TEXT,
            gpx_hash TEXT UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def insert_run(runner_name, distance_bucket, distance_km, duration_s,
                pace_sec_per_km, trust_score, tier, flags, gpx_hash):
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO runs (runner_name, distance_bucket, distance_km, duration_s,
                               pace_sec_per_km, trust_score, tier, flags, gpx_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (runner_name, distance_bucket, distance_km, duration_s,
              pace_sec_per_km, trust_score, tier, flags, gpx_hash))
        conn.commit()
        return True, None
    except sqlite3.IntegrityError:
        return False, "This exact GPX file has already been submitted (duplicate detected)."
    finally:
        conn.close()


def get_leaderboard(distance_bucket, tier_filter=None):
    conn = get_conn()
    query = "SELECT * FROM runs WHERE distance_bucket = ?"
    params = [distance_bucket]
    if tier_filter:
        query += " AND tier = ?"
        params.append(tier_filter)
    query += " ORDER BY duration_s ASC LIMIT 100"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows
