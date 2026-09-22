import os

import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ["DATABASE_URL"]


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS runs (
                    id SERIAL PRIMARY KEY,
                    runner_name TEXT NOT NULL,
                    distance_bucket TEXT NOT NULL,
                    distance_km REAL NOT NULL,
                    duration_s REAL NOT NULL,
                    pace_sec_per_km REAL,
                    trust_score INTEGER NOT NULL,
                    tier TEXT NOT NULL,
                    flags TEXT,
                    gpx_hash TEXT UNIQUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
        conn.commit()
    finally:
        conn.close()


def insert_run(runner_name, distance_bucket, distance_km, duration_s,
                pace_sec_per_km, trust_score, tier, flags, gpx_hash):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO runs (runner_name, distance_bucket, distance_km, duration_s,
                                   pace_sec_per_km, trust_score, tier, flags, gpx_hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (runner_name, distance_bucket, distance_km, duration_s,
                  pace_sec_per_km, trust_score, tier, flags, gpx_hash))
        conn.commit()
        return True, None
    except psycopg2.IntegrityError:
        conn.rollback()
        return False, "This exact GPX file has already been submitted (duplicate detected)."
    finally:
        conn.close()


def get_leaderboard(distance_bucket, tier_filter=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            query = "SELECT * FROM runs WHERE distance_bucket = %s"
            params = [distance_bucket]
            if tier_filter:
                query += " AND tier = %s"
                params.append(tier_filter)
            query += " ORDER BY duration_s ASC, id ASC LIMIT 100"
            cur.execute(query, params)
            return cur.fetchall()
    finally:
        conn.close()
