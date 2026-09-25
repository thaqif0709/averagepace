import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { updatePost, deleteRun, deletePost, vouchForRun, unvouchForRun, likePost, unlikePost } from '../api.js'
import { formatDuration, formatEventDate, formatPace, todayLocalISO } from '../format.js'
import ExternalLinkIcon from './ExternalLinkIcon.jsx'
import ShareResultCard from './ShareResultCard.jsx'

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

export default function PostCard({ post, onUpdated, onDeleted }) {
  const { user, token } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body || '')
  const [editEventName, setEditEventName] = useState(post.event_name || '')
  const [editEventDate, setEditEventDate] = useState(post.event_date || '')
  const [editTimeType, setEditTimeType] = useState(post.time_type || '')
  const [editResultUrl, setEditResultUrl] = useState(post.result_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [vouched, setVouched] = useState(post.vouched_by_me || false)
  const [vouchCount, setVouchCount] = useState(post.vouch_count || 0)
  const [vouching, setVouching] = useState(false)
  const [liked, setLiked] = useState(post.liked_by_me || false)
  const [likeCount, setLikeCount] = useState(post.like_count || 0)
  const [liking, setLiking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const [sharing, setSharing] = useState(false)

  const isOwn = user && user.id === post.user_id

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  function startEdit() {
    setDraft(post.body || '')
    setEditEventName(post.event_name || '')
    setEditEventDate(post.event_date || '')
    setEditTimeType(post.time_type || '')
    setEditResultUrl(post.result_url || '')
    setError(null)
    setConfirmingDelete(false)
    setEditing(true)
    setMenuOpen(false)
  }

  function startDelete() {
    setDraft(post.body || '')
    setEditEventName(post.event_name || '')
    setEditEventDate(post.event_date || '')
    setEditTimeType(post.time_type || '')
    setEditResultUrl(post.result_url || '')
    setError(null)
    setEditing(true)
    setConfirmingDelete(true)
    setMenuOpen(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const runMetadata = post.run_id
        ? { eventName: editEventName.trim(), timeType: editTimeType, resultUrl: editResultUrl.trim(), eventDate: editEventDate }
        : null
      const updated = await updatePost(token, post.id, draft.trim(), runMetadata)
      setEditing(false)
      onUpdated?.(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      if (post.run_id) {
        await deleteRun(token, post.run_id)
      } else {
        await deletePost(token, post.id)
      }
      onDeleted?.(post.id)
    } catch (err) {
      setError(err.message)
      setDeleting(false)
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

  async function toggleLike() {
    if (liking) return
    setLiking(true)
    try {
      const data = liked
        ? await unlikePost(post.id, token)
        : await likePost(post.id, token)
      setLiked(data.liked)
      setLikeCount(data.like_count)
    } catch {
      // low-stakes toggle - leave state as-is, the button just didn't change
    } finally {
      setLiking(false)
    }
  }

  return (
    <article className="post-card">
      <Link to={`/profile/${post.user_username}`} className="post-avatar">
        {post.user_avatar_url ? (
          <img src={post.user_avatar_url} alt="" />
        ) : (
          <span className="avatar-fallback">{post.user_name?.[0]?.toUpperCase() ?? '?'}</span>
        )}
      </Link>
      <div className="post-content">
        <div className="post-meta">
          <Link to={`/profile/${post.user_username}`} className="post-author">
            {post.user_name}
          </Link>
          {post.user_username && <span className="post-username">@{post.user_username}</span>}
          <span className="post-time">
            · {timeAgo(post.created_at)}
            {post.edited_at && ' · edited'}
          </span>
          {isOwn && !editing && (
            <div className="post-menu" ref={menuRef}>
              <button
                type="button"
                className="post-menu-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Post options"
                aria-expanded={menuOpen}
              >
                ⋮
              </button>
              {menuOpen && (
                <div className="post-menu-dropdown">
                  <button type="button" onClick={startEdit}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={startDelete}>
                    Delete
                  </button>
                </div>
              )}
            </div>
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

            {post.run_id && (
              <div className="post-edit-run-fields">
                <label htmlFor={`event_name_${post.id}`}>Event name</label>
                <input
                  type="text"
                  id={`event_name_${post.id}`}
                  maxLength={200}
                  value={editEventName}
                  onChange={(e) => setEditEventName(e.target.value)}
                />

                <label htmlFor={`event_date_${post.id}`}>Event date</label>
                <input
                  type="date"
                  id={`event_date_${post.id}`}
                  max={todayLocalISO()}
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                />

                <label>Which time is this?</label>
                <div className="segmented">
                  <button
                    type="button"
                    className={editTimeType === 'gun' ? 'active' : ''}
                    onClick={() => setEditTimeType('gun')}
                  >
                    Gun time
                  </button>
                  <button
                    type="button"
                    className={editTimeType === 'chip' ? 'active' : ''}
                    onClick={() => setEditTimeType('chip')}
                  >
                    Chip time
                  </button>
                </div>

                <label htmlFor={`result_url_${post.id}`}>Official result link</label>
                <input
                  type="url"
                  id={`result_url_${post.id}`}
                  placeholder="https://results.example.com/..."
                  value={editResultUrl}
                  onChange={(e) => setEditResultUrl(e.target.value)}
                />
                <p className="hint">
                  Distance and time can't be edited here — delete this entry
                  and resubmit if those are wrong.
                </p>
              </div>
            )}

            {error && <p className="post-edit-error">{error}</p>}

            <div className="post-edit-actions">
              <button type="button" onClick={handleSave} disabled={saving || (!draft.trim() && !post.run_id)}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              {!confirmingDelete && (
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={saving}
                >
                  Delete
                </button>
              )}
            </div>

            {confirmingDelete && (
              <div className="post-delete-confirm">
                <p>
                  Delete this entry for good? This can't be undone
                  {vouchCount > 0 && ` and will remove its ${vouchCount} vouch${vouchCount === 1 ? '' : 'es'}`}.
                </p>
                <div className="post-edit-actions">
                  <button type="button" className="danger" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Yes, delete it'}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          post.body && <p className="post-text">{post.body}</p>
        )}

        {post.run_id && (
          <div className="post-activity">
            <span className={`tier-dot ${post.tier}`}></span>
            <span className="post-activity-item">
              {DISTANCE_LABELS[post.distance_bucket] ?? post.distance_bucket}
              {post.event_name && ` — ${post.event_name}`}
              {post.event_date && ` (${formatEventDate(post.event_date)})`}
            </span>
            <span className="post-activity-item time-cell">
              {formatDuration(post.duration_s)}
              {post.time_type && <span className="time-type-tag">{post.time_type}</span>}
            </span>
            <span className="post-activity-item">{formatPace(post.pace_sec_per_km)}</span>
            <span className="post-activity-trailing">
              {post.result_url && (
                <a href={post.result_url} target="_blank" rel="noopener noreferrer" className="post-result-link">
                  Official result
                  <ExternalLinkIcon />
                </a>
              )}
              {isOwn && (
                <button type="button" className="post-share-link" onClick={() => setSharing(true)}>
                  Share
                </button>
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

        <div className="post-engagement">
          {user && !isOwn ? (
            <button
              type="button"
              className={`like-button ${liked ? 'liked' : ''}`}
              onClick={toggleLike}
              disabled={liking}
            >
              {liked ? 'Liked' : 'Like'}{likeCount > 0 && ` · ${likeCount}`}
            </button>
          ) : (
            likeCount > 0 && (
              <span className="like-count-readonly">
                {likeCount} like{likeCount === 1 ? '' : 's'}
              </span>
            )
          )}
        </div>
      </div>
      {sharing && <ShareResultCard run={post} onClose={() => setSharing(false)} />}
    </article>
  )
}
