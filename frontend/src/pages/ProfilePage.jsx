import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import PostCard from '../components/PostCard.jsx'
import RunningLoader from '../components/RunningLoader.jsx'
import UsernameStatusMessage from '../components/UsernameStatusMessage.jsx'
import { useUsernameStatus, isUsernameStatusSubmittable } from '../useUsernameStatus.js'
import { formatDuration, formatEventDate, formatPace } from '../format.js'
import {
  acceptFollowRequest,
  declineFollowRequest,
  fetchBestEfforts,
  fetchFollowRequests,
  fetchUserPosts,
  fetchUserProfile,
  followUser,
  setUsername as saveUsername,
  unfollowUser,
  updatePrivacy,
} from '../api.js'

const DISTANCE_ORDER = ['5k', '10k', 'half', 'marathon']
const DISTANCE_LABELS = { '5k': '5K', '10k': '10K', half: 'Half Marathon', marathon: 'Marathon' }

export function ProfileRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  if (!user.username) return <Navigate to="/" replace />
  return <Navigate to={`/profile/${user.username}`} replace />
}

export default function ProfilePage() {
  const { username } = useParams()
  const { user: viewer, token, loading: authLoading, updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [postsGated, setPostsGated] = useState(false)
  const [bestEfforts, setBestEfforts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [followBusy, setFollowBusy] = useState(false)
  const [privacyBusy, setPrivacyBusy] = useState(false)
  const [requests, setRequests] = useState([])
  const [busyRequestId, setBusyRequestId] = useState(null)
  const [usernameValue, setUsernameValue] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameError, setUsernameError] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const usernameStatus = useUsernameStatus(usernameValue, token, profile?.username)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchUserProfile(username, token), fetchUserPosts(username, token), fetchBestEfforts(username, token)])
      .then(([profileData, postsData, bestEffortsData]) => {
        if (cancelled) return
        setProfile(profileData)
        setPosts(postsData.posts)
        setPostsGated(postsData.gated)
        const sorted = [...bestEffortsData.best_efforts].sort(
          (a, b) => DISTANCE_ORDER.indexOf(a.distance_bucket) - DISTANCE_ORDER.indexOf(b.distance_bucket)
        )
        setBestEfforts(sorted)
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
  }, [username, token, authLoading])

  useEffect(() => {
    if (profile?.is_self) setUsernameValue(profile.username || '')
  }, [profile?.is_self, profile?.username])

  useEffect(() => {
    if (!profile?.is_self) return
    let cancelled = false
    fetchFollowRequests(token)
      .then((data) => {
        if (!cancelled) setRequests(data.requests)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [profile?.is_self, token])

  async function toggleFollow() {
    if (!profile) return
    setFollowBusy(true)
    setError(null)
    try {
      if (profile.follow_status === 'none') {
        const { status } = await followUser(profile.username, token)
        setProfile({
          ...profile,
          follow_status: status,
          follower_count: status === 'accepted' ? profile.follower_count + 1 : profile.follower_count,
        })
      } else {
        const wasAccepted = profile.follow_status === 'accepted'
        await unfollowUser(profile.username, token)
        setProfile({
          ...profile,
          follow_status: 'none',
          follower_count: wasAccepted ? profile.follower_count - 1 : profile.follower_count,
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setFollowBusy(false)
    }
  }

  async function togglePrivacy() {
    setPrivacyBusy(true)
    setError(null)
    try {
      const updated = await updatePrivacy(token, !profile.is_private)
      setProfile({ ...profile, is_private: updated.is_private })
    } catch (err) {
      setError(err.message)
    } finally {
      setPrivacyBusy(false)
    }
  }

  async function handleSaveUsername(e) {
    e.preventDefault()
    if (!isUsernameStatusSubmittable(usernameStatus)) return
    setUsernameSaving(true)
    setUsernameError(null)
    try {
      const updated = await saveUsername(token, usernameValue.trim())
      setProfile((prev) => ({ ...prev, username: updated.username }))
      // Every post in this list is this user's own (this is their profile
      // page), so all of them show the stale username until this patches it.
      setPosts((prev) => prev.map((p) => ({ ...p, user_username: updated.username })))
      updateUser({ username: updated.username })
    } catch (err) {
      setUsernameError(err.message)
    } finally {
      setUsernameSaving(false)
    }
  }

  async function handleAccept(requesterId) {
    setBusyRequestId(requesterId)
    try {
      await acceptFollowRequest(token, requesterId)
      setRequests((prev) => prev.filter((r) => r.id !== requesterId))
      setProfile((prev) => ({ ...prev, follower_count: prev.follower_count + 1 }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyRequestId(null)
    }
  }

  async function handleDecline(requesterId) {
    setBusyRequestId(requesterId)
    try {
      await declineFollowRequest(token, requesterId)
      setRequests((prev) => prev.filter((r) => r.id !== requesterId))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyRequestId(null)
    }
  }

  function handlePostUpdated(updated) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
  }

  function handlePostDeleted(postId) {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    // Deleting a run can change (or clear) that distance's best effort, so
    // refresh the summary too rather than leaving a stale, now-gone PR shown.
    fetchBestEfforts(username, token)
      .then((data) => {
        const sorted = [...data.best_efforts].sort(
          (a, b) => DISTANCE_ORDER.indexOf(a.distance_bucket) - DISTANCE_ORDER.indexOf(b.distance_bucket)
        )
        setBestEfforts(sorted)
      })
      .catch(() => {})
  }

  if (loading || authLoading) {
    return (
      <div className="wrap wide">
        <RunningLoader />
      </div>
    )
  }
  if (error) {
    return (
      <div className="wrap wide">
        <div className="banner err">{error}</div>
      </div>
    )
  }
  if (!profile) return null

  return (
    <div className="wrap wide">
      <div className="profile-header">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" />
        ) : (
          <span className="avatar-fallback">{profile.name?.[0]?.toUpperCase() ?? '?'}</span>
        )}
        <div>
          <h1>
            {profile.name}
            {profile.is_private && (
              <svg
                className="private-lock"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="Private account"
              >
                <title>Private account</title>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            )}
          </h1>
          {profile.username && <p className="profile-username">@{profile.username}</p>}
          <p className="lede">
            <Link to={`/profile/${profile.username}/followers`}>{profile.follower_count} followers</Link>
            {' · '}
            <Link to={`/profile/${profile.username}/following`}>{profile.following_count} following</Link>
          </p>
        </div>
        {!profile.is_self && viewer && (
          <button
            type="button"
            onClick={toggleFollow}
            disabled={followBusy}
            className={`follow-button ${
              profile.follow_status === 'accepted' ? 'following' :
              profile.follow_status === 'pending' ? 'requested' : ''
            }`}
          >
            {profile.follow_status === 'accepted' && 'Following'}
            {profile.follow_status === 'pending' && 'Requested'}
            {profile.follow_status === 'none' && 'Follow'}
          </button>
        )}
        {profile.is_self && (
          <button type="button" className="follow-button" onClick={() => setSettingsOpen((v) => !v)}>
            {settingsOpen ? 'Done' : 'Edit profile'}
          </button>
        )}
      </div>

      {profile.is_self && settingsOpen && (
        <div className="profile-settings">
          <form onSubmit={handleSaveUsername} className="username-edit-form">
            <label htmlFor="profile_username">Username</label>
            <input
              type="text"
              id="profile_username"
              maxLength={20}
              autoComplete="off"
              value={usernameValue}
              onChange={(e) => setUsernameValue(e.target.value)}
            />
            <UsernameStatusMessage status={usernameStatus} />
            {usernameError && <p className="post-edit-error">{usernameError}</p>}
            <button type="submit" disabled={!isUsernameStatusSubmittable(usernameStatus) || usernameSaving}>
              {usernameSaving ? 'Saving…' : 'Save username'}
            </button>
          </form>

          <label className="privacy-toggle">
            <input type="checkbox" checked={profile.is_private} onChange={togglePrivacy} disabled={privacyBusy} />
            Private account
          </label>
          <p className="hint">
            {profile.is_private
              ? 'Only approved followers can see your posts, follower list, and following list. New followers need your approval.'
              : 'Anyone can see your posts and follow you instantly.'}
          </p>
        </div>
      )}

      {profile.is_self && requests.length > 0 && (
        <>
          <h2>Follow requests</h2>
          <div className="user-list">
            {requests.map((r) => (
              <div key={r.id} className="user-list-row follow-request-row">
                <Link to={`/profile/${r.username}`} className="follow-request-user">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" />
                  ) : (
                    <span className="avatar-fallback">{r.name?.[0]?.toUpperCase() ?? '?'}</span>
                  )}
                  <span>{r.name}</span>
                </Link>
                <div className="follow-request-actions">
                  <button type="button" onClick={() => handleAccept(r.id)} disabled={busyRequestId === r.id}>
                    Accept
                  </button>
                  <button
                    type="button"
                    className="decline"
                    onClick={() => handleDecline(r.id)}
                    disabled={busyRequestId === r.id}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {bestEfforts.length > 0 && (
        <>
          <h2>Best efforts</h2>
          <div className="best-efforts-grid">
            {bestEfforts.map((be) => (
              <Link
                key={be.distance_bucket}
                to={`/profile/${profile.username}/best/${be.distance_bucket}`}
                className="best-effort-card"
              >
                <div className="best-effort-label">{DISTANCE_LABELS[be.distance_bucket] ?? be.distance_bucket}</div>
                <div className="best-effort-time">{formatDuration(be.duration_s)}</div>
                <div className="best-effort-meta">
                  <span className={`tier-dot ${be.tier}`}></span>
                  {formatPace(be.pace_sec_per_km)}
                  {be.time_type && <span className="time-type-tag">{be.time_type}</span>}
                </div>
                {(be.event_name || be.event_date) && (
                  <div className="best-effort-event">
                    {be.event_name}
                    {be.event_name && be.event_date && ' '}
                    {be.event_date && `(${formatEventDate(be.event_date)})`}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      <h2>Posts</h2>
      {postsGated && (
        <div className="empty-state">
          {profile.follow_status === 'pending'
            ? 'This account is private. Your follow request is pending.'
            : 'This account is private. Follow to see their posts.'}
        </div>
      )}
      {!postsGated && posts.length === 0 && <div className="empty-state">No posts yet.</div>}
      {!postsGated && posts.length > 0 && (
        <div className="feed">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onUpdated={handlePostUpdated} onDeleted={handlePostDeleted} />
          ))}
        </div>
      )}
    </div>
  )
}
