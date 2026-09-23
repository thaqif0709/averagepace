import { Link } from 'react-router-dom'
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

export default function PostCard({ post }) {
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
          <span className="post-time">· {timeAgo(post.created_at)}</span>
        </div>
        {post.body && <p className="post-text">{post.body}</p>}
        {post.run_id && (
          <div className="post-activity">
            <span className={`tier-dot ${post.tier}`}></span>
            <span className="post-activity-item">{DISTANCE_LABELS[post.distance_bucket] ?? post.distance_bucket}</span>
            <span className="post-activity-item time-cell">{formatDuration(post.duration_s)}</span>
            <span className="post-activity-item">{formatPace(post.pace_sec_per_km)}</span>
          </div>
        )}
      </div>
    </article>
  )
}
