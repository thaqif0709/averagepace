import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { updatePost, vouchForRun, unvouchForRun } from '../api.js'
import { formatDuration, formatPace } from '../format.js'

const DISTANCE_LABELS = { '5k': '5K', '10k': '10K', half: 'Half Marathon', marathon: 'Marathon' }

function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export default function PostCard({ post, onUpdated }) {
  const { user, token } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [vouched, setVouched] = useState(post.vouched_by_me || false)
  const [vouchCount, setVouchCount] = useState(post.vouch_count || 0)
  const [vouching, setVouching] = useState(false)

  const isOwn = user && user.id === post.user_id

  function startEdit() {
    setDraft(post.body || '')
    setError(null)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await updatePost(token, post.id, draft.trim())
      setEditing(false)
      onUpdated?.(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleVouch() {
    if (vouching) return
    setVouching(true)
    try {
      const data = vouched
        ? await unvouchForRun(post.run_id, token)
        : await vouchForRun(post.run_id, token)
      setVouched(data.vouched)
      setVouchCount(data.vouch_count)
    } catch {
      // low-stakes toggle - leave state as-is, the button just didn't change
    } finally {
      setVouching(false)
    }
  }

  return (
    <article className="post-card">
      <Link to={`/profile/${post.user_id}`} className="post-avatar">
        {post.user_avatar_url ? (
          <img src={post.user_avatar_url} alt="" />
        ) : (
          <span className="avatar-fallback">{post.user_name?.[0]?.toUpperCase() ?? '?'}</span>
        )}
      </Link>
      <div className="post-content">
        <div className="post-meta">
          <Link to={`/profile/${post.user_id}`} className="post-author">
            {post.user_name}
          </Link>
          <span className="post-time">
            · {timeAgo(post.created_at)}
            {post.edited_at && ' · edited'}
          </span>
          {isOwn && !editing && (
            <button type="button" className="post-edit-btn" onClick={startEdit}>
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="post-edit">
            <textarea
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            {error && <p className="post-edit-error">{error}</p>}
            <div className="post-edit-actions">
              <button type="button" onClick={handleSave} disabled={saving || (!draft.trim() && !post.run_id)}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          post.body && <p className="post-text">{post.body}</p>
        )}

        {post.run_id && (
          <div className="post-activity">
            <span className={`tier-dot ${post.tier}`}></span>
            <span className="post-activity-item">{DISTANCE_LABELS[post.distance_bucket] ?? post.distance_bucket}</span>
            <span className="post-activity-item time-cell">
              {formatDuration(post.duration_s)}
              {post.time_type && <span className="time-type-tag">{post.time_type}</span>}
            </span>
            <span className="post-activity-item">{formatPace(post.pace_sec_per_km)}</span>
            <span className="post-activity-trailing">
              {post.result_url && (
                <a href={post.result_url} target="_blank" rel="noopener noreferrer" className="post-result-link">
                  Official result ↗
                </a>
              )}
              {user && !isOwn ? (
                <button
                  type="button"
                  className={`vouch-button ${vouched ? 'vouched' : ''}`}
                  onClick={toggleVouch}
                  disabled={vouching}
                >
                  {vouched ? 'Vouched' : 'Vouch'}{vouchCount > 0 && ` · ${vouchCount}`}
                </button>
              ) : (
                vouchCount > 0 && <span className="vouch-count-readonly">{vouchCount} vouched</span>
              )}
            </span>
          </div>
        )}
      </div>
    </article>
  )
}
