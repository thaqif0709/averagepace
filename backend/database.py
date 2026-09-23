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
            # Private accounts, added after the follow system already existed -
            # a no-op if these are already there.
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE")
            cur.execute("ALTER TABLE follows ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted'")
            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'follows_status_check'
                    ) THEN
                        ALTER TABLE follows ADD CONSTRAINT follows_status_check
                            CHECK (status IN ('pending', 'accepted'));
                    END IF;
                END $$;
            """)
            # Editable posts - a no-op if already there.
            cur.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ")
            # Optional citation link to an official race result - a no-op if already there.
            cur.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS result_url TEXT")
            # Optional gun-time/chip-time tag, so a linked result can be compared
            # like-for-like - a no-op if already there.
            cur.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS time_type TEXT")
            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'runs_time_type_check'
                    ) THEN
                        ALTER TABLE runs ADD CONSTRAINT runs_time_type_check
                            CHECK (time_type IN ('gun', 'chip'));
                    END IF;
                END $$;
            """)
            # Social proof, separate from trust scoring - any signed-in user
            # (other than the runner) can vouch for a run once.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS vouches (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (user_id, run_id)
                )
            """)
            # Optional free-text event name (e.g. "Klang Marathon 2026") - a
            # no-op if already there. No separate events table yet; names are
            # normalized only by the suggest-as-you-type autocomplete.
            cur.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS event_name TEXT")
            # Plain engagement, unlike vouches - applies to any post (not just
            # run-attached ones) and isn't a trust signal, so it doesn't feed
            # into anything scoring-related.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS likes (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (user_id, post_id)
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
                "SELECT id, google_sub, email, name, avatar_url, is_private FROM users WHERE id = %s",
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
                "SELECT id, name, avatar_url, is_private FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()
    finally:
        conn.close()


def set_user_privacy(user_id, is_private):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE users SET is_private = %s WHERE id = %s
                RETURNING id, google_sub, email, name, avatar_url, is_private
            """, (is_private, user_id))
            user = cur.fetchone()
            if not is_private:
                # Going public: nobody needs to approve a follow anymore, so
                # anything still waiting on them gets waved through.
                cur.execute(
                    "UPDATE follows SET status = 'accepted' WHERE followed_id = %s AND status = 'pending'",
                    (user_id,),
                )
        conn.commit()
        return user
    finally:
        conn.close()


def can_view_private_content(user_id, viewer_id, is_private):
    """Whether viewer_id may see user_id's posts/followers/following lists."""
    if not is_private:
        return True
    if viewer_id is None:
        return False
    if viewer_id == user_id:
        return True
    return is_following(viewer_id, user_id)


def follow_user(follower_id, followed_id):
    """Creates (or leaves alone, if one already exists) a follow relationship.
    Private targets get a 'pending' request instead of an instant 'accepted' follow.
    Returns the resulting/current status: 'pending' or 'accepted'."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO follows (follower_id, followed_id, status)
                SELECT %s, %s, CASE WHEN u.is_private THEN 'pending' ELSE 'accepted' END
                FROM users u WHERE u.id = %s
                ON CONFLICT (follower_id, followed_id) DO NOTHING
                RETURNING status
            """, (follower_id, followed_id, followed_id))
            row = cur.fetchone()
            if row is None:
                cur.execute(
                    "SELECT status FROM follows WHERE follower_id = %s AND followed_id = %s",
                    (follower_id, followed_id),
                )
                row = cur.fetchone()
        conn.commit()
        return row[0] if row else None
    finally:
        conn.close()


def unfollow_user(follower_id, followed_id):
    """Removes a follow relationship in any status - doubles as cancelling a pending request."""
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


def get_follow_status(follower_id, followed_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status FROM follows WHERE follower_id = %s AND followed_id = %s",
                (follower_id, followed_id),
            )
            row = cur.fetchone()
            return row[0] if row else "none"
    finally:
        conn.close()


def accept_follow_request(target_id, requester_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE follows SET status = 'accepted'
                WHERE follower_id = %s AND followed_id = %s AND status = 'pending'
            """, (requester_id, target_id))
            updated = cur.rowcount > 0
        conn.commit()
        return updated
    finally:
        conn.close()


def decline_follow_request(target_id, requester_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM follows WHERE follower_id = %s AND followed_id = %s AND status = 'pending'
            """, (requester_id, target_id))
            deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    finally:
        conn.close()


def get_pending_follow_requests(user_id):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT u.id, u.name, u.avatar_url, f.created_at
                FROM follows f JOIN users u ON u.id = f.follower_id
                WHERE f.followed_id = %s AND f.status = 'pending'
                ORDER BY f.created_at DESC
            """, (user_id,))
            return cur.fetchall()
    finally:
        conn.close()


def is_following(follower_id, followed_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM follows WHERE follower_id = %s AND followed_id = %s AND status = 'accepted'",
                (follower_id, followed_id),
            )
            return cur.fetchone() is not None
    finally:
        conn.close()


def get_follow_counts(user_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM follows WHERE follower_id = %s AND status = 'accepted'", (user_id,)
            )
            following_count = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM follows WHERE followed_id = %s AND status = 'accepted'", (user_id,)
            )
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
                WHERE f.followed_id = %s AND f.status = 'accepted'
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
                WHERE f.follower_id = %s AND f.status = 'accepted'
                ORDER BY f.created_at DESC
            """, (user_id,))
            return cur.fetchall()
    finally:
        conn.close()


POST_SELECT = """
    SELECT
        p.id, p.body, p.created_at, p.edited_at,
        u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar_url,
        r.id AS run_id, r.distance_bucket, r.distance_km, r.duration_s,
        r.pace_sec_per_km, r.trust_score, r.tier, r.result_url, r.time_type, r.event_name,
        COALESCE(v.vouch_count, 0) AS vouch_count,
        EXISTS (
            SELECT 1 FROM vouches WHERE run_id = r.id AND user_id = %s
        ) AS vouched_by_me,
        COALESCE(l.like_count, 0) AS like_count,
        EXISTS (
            SELECT 1 FROM likes WHERE post_id = p.id AND user_id = %s
        ) AS liked_by_me
    FROM posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN runs r ON r.id = p.run_id
    LEFT JOIN (
        SELECT run_id, COUNT(*) AS vouch_count FROM vouches GROUP BY run_id
    ) v ON v.run_id = r.id
    LEFT JOIN (
        SELECT post_id, COUNT(*) AS like_count FROM likes GROUP BY post_id
    ) l ON l.post_id = p.id
"""


def create_post(user_id, body=None, run_id=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO posts (user_id, body, run_id)
                VALUES (%s, %s, %s)
                RETURNING id, user_id, body, run_id, created_at, edited_at
            """, (user_id, body, run_id))
            post = cur.fetchone()
        conn.commit()
        return post
    finally:
        conn.close()


def update_post(post_id, user_id, body):
    """Edits a post's text. Only the owner's row matches (WHERE enforces this).
    Returns (post, error): error is 'empty' if this would leave a text-only
    post with no body (the table's own CHECK constraint catches it), or None
    if post_id doesn't exist or isn't this user's."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE posts SET body = %s, edited_at = NOW()
                WHERE id = %s AND user_id = %s
                RETURNING id, user_id, body, run_id, created_at, edited_at
            """, (body, post_id, user_id))
            updated = cur.fetchone()
        conn.commit()
        return updated, None
    except psycopg2.IntegrityError:
        conn.rollback()
        return None, "empty"
    finally:
        conn.close()


def update_run_metadata(run_id, user_id, event_name, time_type, result_url):
    """Edits a run's event name / time type / result link - never distance or
    duration, which stay fixed once vouches or leaderboard rank attach to
    them (fixing those means deleting and resubmitting). Only the owner's
    row matches."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE runs SET event_name = %s, time_type = %s, result_url = %s
                WHERE id = %s AND user_id = %s
                RETURNING id, event_name, time_type, result_url
            """, (event_name, time_type, result_url, run_id, user_id))
            updated = cur.fetchone()
        conn.commit()
        return updated
    except psycopg2.IntegrityError:
        conn.rollback()
        return None
    finally:
        conn.close()


def delete_run(run_id, user_id):
    """Deletes a run - cascades to its post and any vouches. Only the
    owner's row matches. Returns True if a row was actually deleted."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM runs WHERE id = %s AND user_id = %s", (run_id, user_id))
            deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    finally:
        conn.close()


def get_feed(scope, user_id=None, viewer_id=None, limit=50):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if scope == "following":
                cur.execute(POST_SELECT + """
                    WHERE p.user_id = %s
                       OR p.user_id IN (
                           SELECT followed_id FROM follows
                           WHERE follower_id = %s AND status = 'accepted'
                       )
                    ORDER BY p.created_at DESC
                    LIMIT %s
                """, (viewer_id, viewer_id, user_id, user_id, limit))
            else:
                # Everyone means everyone public - a private account's posts only
                # ever show up in the feeds of people it has accepted as followers.
                cur.execute(
                    POST_SELECT + " WHERE u.is_private = FALSE ORDER BY p.created_at DESC LIMIT %s",
                    (viewer_id, viewer_id, limit),
                )
            return cur.fetchall()
    finally:
        conn.close()


def get_posts_for_user(user_id, viewer_id=None, limit=100):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                POST_SELECT + " WHERE p.user_id = %s ORDER BY p.created_at DESC LIMIT %s",
                (viewer_id, viewer_id, user_id, limit),
            )
            return cur.fetchall()
    finally:
        conn.close()


def insert_run(runner_name, user_id, distance_bucket, distance_km, duration_s,
                pace_sec_per_km, trust_score, tier, flags, gpx_hash, result_url=None, time_type=None,
                event_name=None):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO runs (runner_name, user_id, distance_bucket, distance_km, duration_s,
                                   pace_sec_per_km, trust_score, tier, flags, gpx_hash, result_url, time_type,
                                   event_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (runner_name, user_id, distance_bucket, distance_km, duration_s,
                  pace_sec_per_km, trust_score, tier, flags, gpx_hash, result_url, time_type, event_name))
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
            query = """
                SELECT runs.*, COALESCE(v.vouch_count, 0) AS vouch_count
                FROM runs
                LEFT JOIN users ON users.id = runs.user_id
                LEFT JOIN (
                    SELECT run_id, COUNT(*) AS vouch_count FROM vouches GROUP BY run_id
                ) v ON v.run_id = runs.id
                WHERE runs.distance_bucket = %s
                  AND (users.is_private IS NULL OR users.is_private = FALSE)
            """
            params = [distance_bucket]
            if tier_filter:
                query += " AND runs.tier = %s"
                params.append(tier_filter)
            query += " ORDER BY runs.duration_s ASC, runs.id ASC LIMIT 100"
            cur.execute(query, params)
            return cur.fetchall()
    finally:
        conn.close()


def get_best_efforts(user_id):
    """This user's fastest run per distance bucket - their all-time PRs."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM (
                    SELECT runs.*,
                        ROW_NUMBER() OVER (PARTITION BY distance_bucket ORDER BY duration_s ASC) AS rn
                    FROM runs
                    WHERE user_id = %s AND duration_s IS NOT NULL
                ) ranked
                WHERE rn = 1
            """, (user_id,))
            return cur.fetchall()
    finally:
        conn.close()


def get_user_runs_by_distance(user_id, distance_bucket):
    """All of this user's runs at one distance, fastest first - the drill-down
    behind a Best Efforts card."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT runs.*, COALESCE(v.vouch_count, 0) AS vouch_count
                FROM runs
                LEFT JOIN (
                    SELECT run_id, COUNT(*) AS vouch_count FROM vouches GROUP BY run_id
                ) v ON v.run_id = runs.id
                WHERE runs.user_id = %s AND runs.distance_bucket = %s AND runs.duration_s IS NOT NULL
                ORDER BY runs.duration_s ASC, runs.id ASC
            """, (user_id, distance_bucket))
            return cur.fetchall()
    finally:
        conn.close()


def suggest_event_names(query, limit=8):
    """Existing event names starting with query, most-used first - private
    users' runs are excluded so a suggestion can never hint at what they ran."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT runs.event_name AS name, COUNT(*) AS use_count
                FROM runs
                LEFT JOIN users ON users.id = runs.user_id
                WHERE runs.event_name ILIKE %s
                  AND (users.is_private IS NULL OR users.is_private = FALSE)
                GROUP BY runs.event_name
                ORDER BY use_count DESC, runs.event_name ASC
                LIMIT %s
            """, (query.replace('%', r'\%').replace('_', r'\_') + '%', limit))
            return cur.fetchall()
    finally:
        conn.close()


def vouch_for_run(user_id, run_id):
    """Adds a vouch (or leaves alone, if one already exists).
    Returns (ok, error): error is 'not_found' if the run doesn't exist,
    'self' if it's the caller's own run, else None."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM runs WHERE id = %s", (run_id,))
            row = cur.fetchone()
            if row is None:
                return False, "not_found"
            if row[0] == user_id:
                return False, "self"
            cur.execute("""
                INSERT INTO vouches (user_id, run_id) VALUES (%s, %s)
                ON CONFLICT (user_id, run_id) DO NOTHING
            """, (user_id, run_id))
        conn.commit()
        return True, None
    finally:
        conn.close()


def unvouch_for_run(user_id, run_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM vouches WHERE user_id = %s AND run_id = %s", (user_id, run_id))
        conn.commit()
    finally:
        conn.close()


def get_vouch_count(run_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM vouches WHERE run_id = %s", (run_id,))
            return cur.fetchone()[0]
    finally:
        conn.close()


def like_post(user_id, post_id):
    """Adds a like (or leaves alone, if one already exists). Applies to any
    post, not just run-attached ones - unlike vouches this isn't a trust
    signal, just plain engagement.
    Returns (ok, error): error is 'not_found' if the post doesn't exist,
    'self' if it's the caller's own post, else None."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM posts WHERE id = %s", (post_id,))
            row = cur.fetchone()
            if row is None:
                return False, "not_found"
            if row[0] == user_id:
                return False, "self"
            cur.execute("""
                INSERT INTO likes (user_id, post_id) VALUES (%s, %s)
                ON CONFLICT (user_id, post_id) DO NOTHING
            """, (user_id, post_id))
        conn.commit()
        return True, None
    finally:
        conn.close()


def unlike_post(user_id, post_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM likes WHERE user_id = %s AND post_id = %s", (user_id, post_id))
        conn.commit()
    finally:
        conn.close()


def get_like_count(post_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM likes WHERE post_id = %s", (post_id,))
            return cur.fetchone()[0]
    finally:
        conn.close()
