import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { fetchFollowers, fetchFollowing } from '../api.js'

export default function FollowListPage({ mode }) {
  const { userId } = useParams()
  const { token, loading: authLoading } = useAuth()
  const [users, setUsers] = useState([])
  const [gated, setGated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const fetcher = mode === 'followers' ? fetchFollowers : fetchFollowing
    fetcher(userId, token)
      .then((data) => {
        if (!cancelled) {
          setUsers(data.users)
          setGated(data.gated)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, mode, token, authLoading])

  const title = mode === 'followers' ? 'Followers' : 'Following'

  return (
    <div className="wrap wide">
      <p className="eyebrow">{title}</p>
      <h1>{title}</h1>

      {error && <div className="banner err">{error}</div>}
      {!loading && !error && gated && (
        <div className="empty-state">This account is private. Follow to see their {title.toLowerCase()}.</div>
      )}
      {!loading && !error && !gated && users.length === 0 && (
        <div className="empty-state">Nobody here yet.</div>
      )}
      {!gated && users.length > 0 && (
        <div className="user-list">
          {users.map((u) => (
            <Link key={u.id} to={`/profile/${u.id}`} className="user-list-row">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" />
              ) : (
                <span className="avatar-fallback">{u.name?.[0]?.toUpperCase() ?? '?'}</span>
              )}
              <span>{u.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
