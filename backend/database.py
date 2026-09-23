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
            cur.execute("""
                CREATE TABLE IF NOT EXISTS follows (
                    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (follower_id, followed_id),
                    CHECK (follower_id <> followed_id)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    body TEXT,
                    run_id INTEGER REFERENCES runs(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CHECK (body IS NOT NULL OR run_id IS NOT NULL)
                )
            """)
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


def get_user_public(user_id):
    """Like get_user_by_id, but without email - for viewing someone else's profile."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, name, avatar_url FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()
    finally:
        conn.close()


def follow_user(follower_id, followed_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO follows (follower_id, followed_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (follower_id, followed_id))
        conn.commit()
    finally:
        conn.close()


def unfollow_user(follower_id, followed_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM follows WHERE follower_id = %s AND followed_id = %s",
                (follower_id, followed_id),
            )
        conn.commit()
    finally:
        conn.close()


def is_following(follower_id, followed_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM follows WHERE follower_id = %s AND followed_id = %s",
                (follower_id, followed_id),
            )
            return cur.fetchone() is not None
    finally:
        conn.close()


def get_follow_counts(user_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM follows WHERE follower_id = %s", (user_id,))
            following_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM follows WHERE followed_id = %s", (user_id,))
            follower_count = cur.fetchone()[0]
            return follower_count, following_count
    finally:
        conn.close()


def get_followers(user_id):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT u.id, u.name, u.avatar_url
                FROM follows f JOIN users u ON u.id = f.follower_id
                WHERE f.followed_id = %s
                ORDER BY f.created_at DESC
            """, (user_id,))
            return cur.fetchall()
    finally:
        conn.close()


def get_following(user_id):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT u.id, u.name, u.avatar_url
                FROM follows f JOIN users u ON u.id = f.followed_id
                WHERE f.follower_id = %s
                ORDER BY f.created_at DESC
            """, (user_id,))
            return cur.fetchall()
    finally:
        conn.close()


POST_SELECT = """
    SELECT
        p.id, p.body, p.created_at,
        u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar_url,
        r.id AS run_id, r.distance_bucket, r.distance_km, r.duration_s,
        r.pace_sec_per_km, r.trust_score, r.tier
    FROM posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN runs r ON r.id = p.run_id
"""


def create_post(user_id, body=None, run_id=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO posts (user_id, body, run_id)
                VALUES (%s, %s, %s)
                RETURNING id, user_id, body, run_id, created_at
            """, (user_id, body, run_id))
            post = cur.fetchone()
        conn.commit()
        return post
    finally:
        conn.close()


def get_feed(scope, user_id=None, limit=50):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if scope == "following":
                cur.execute(POST_SELECT + """
                    WHERE p.user_id = %s
                       OR p.user_id IN (SELECT followed_id FROM follows WHERE follower_id = %s)
                    ORDER BY p.created_at DESC
                    LIMIT %s
                """, (user_id, user_id, limit))
            else:
                cur.execute(POST_SELECT + " ORDER BY p.created_at DESC LIMIT %s", (limit,))
            return cur.fetchall()
    finally:
        conn.close()


def get_posts_for_user(user_id, limit=100):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                POST_SELECT + " WHERE p.user_id = %s ORDER BY p.created_at DESC LIMIT %s",
                (user_id, limit),
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
                RETURNING id
            """, (runner_name, user_id, distance_bucket, distance_km, duration_s,
                  pace_sec_per_km, trust_score, tier, flags, gpx_hash))
            new_id = cur.fetchone()[0]
        conn.commit()
        return True, new_id, None
    except psycopg2.IntegrityError:
        conn.rollback()
        return False, None, "This exact GPX file has already been submitted (duplicate detected)."
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
