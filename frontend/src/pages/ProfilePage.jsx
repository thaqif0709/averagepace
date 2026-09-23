import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import PostCard from '../components/PostCard.jsx'
import { fetchUserProfile, fetchUserPosts, followUser, unfollowUser } from '../api.js'

export function ProfileRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  return <Navigate to={`/profile/${user.id}`} replace />
}

export default function ProfilePage() {
  const { userId } = useParams()
  const { user: viewer, token, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [followBusy, setFollowBusy] = useState(false)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchUserProfile(userId, token), fetchUserPosts(userId)])
      .then(([profileData, postsData]) => {
        if (cancelled) return
        setProfile(profileData)
        setPosts(postsData.posts)
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
  }, [userId, token, authLoading])

  async function toggleFollow() {
    if (!profile) return
    setFollowBusy(true)
    setError(null)
    try {
      if (profile.is_following) {
        await unfollowUser(profile.id, token)
        setProfile({ ...profile, is_following: false, follower_count: profile.follower_count - 1 })
      } else {
        await followUser(profile.id, token)
        setProfile({ ...profile, is_following: true, follower_count: profile.follower_count + 1 })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setFollowBusy(false)
    }
  }

  if (loading || authLoading) return null
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
          <h1>{profile.name}</h1>
          <p className="lede">
            <Link to={`/profile/${profile.id}/followers`}>{profile.follower_count} followers</Link>
            {' · '}
            <Link to={`/profile/${profile.id}/following`}>{profile.following_count} following</Link>
          </p>
        </div>
        {!profile.is_self && viewer && (
          <button
            type="button"
            onClick={toggleFollow}
            disabled={followBusy}
            className={`follow-button ${profile.is_following ? 'following' : ''}`}
          >
            {profile.is_following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      <h2>Posts</h2>
      {posts.length === 0 && <div className="empty-state">No posts yet.</div>}
      {posts.length > 0 && (
        <div className="feed">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
