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
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    google_sub TEXT UNIQUE NOT NULL,
                    email TEXT NOT NULL,
                    name TEXT NOT NULL,
                    avatar_url TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS runs (
                    id SERIAL PRIMARY KEY,
                    runner_name TEXT NOT NULL,
                    distance_bucket TEXT NOT NULL,
                    distance_km REAL NOT NULL,
                    duration_s REAL,
                    pace_sec_per_km REAL,
                    trust_score INTEGER NOT NULL,
                    tier TEXT NOT NULL,
                    flags TEXT,
                    gpx_hash TEXT UNIQUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            # Relax a constraint from before unverified (no-GPX) submissions existed -
            # a no-op on a fresh table, needed for databases created by an earlier version.
            cur.execute("ALTER TABLE runs ALTER COLUMN duration_s DROP NOT NULL")
            # Link runs to the user who submitted them, added once auth existed -
            # a no-op if the column is already there.
            cur.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)")
        conn.commit()
    finally:
        conn.close()


def upsert_user(google_sub, email, name, avatar_url):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO users (google_sub, email, name, avatar_url)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (google_sub) DO UPDATE SET
                    email = EXCLUDED.email,
                    name = EXCLUDED.name,
                    avatar_url = EXCLUDED.avatar_url
                RETURNING id, google_sub, email, name, avatar_url
            """, (google_sub, email, name, avatar_url))
            user = cur.fetchone()
        conn.commit()
        return user
    finally:
        conn.close()


def get_user_by_id(user_id):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, google_sub, email, name, avatar_url FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()
    finally:
        conn.close()


def get_runs_for_user(user_id):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM runs WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def insert_run(runner_name, user_id, distance_bucket, distance_km, duration_s,
                pace_sec_per_km, trust_score, tier, flags, gpx_hash):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO runs (runner_name, user_id, distance_bucket, distance_km, duration_s,
                                   pace_sec_per_km, trust_score, tier, flags, gpx_hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (runner_name, user_id, distance_bucket, distance_km, duration_s,
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
