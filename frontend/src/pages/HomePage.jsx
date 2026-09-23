import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import GoogleSignInButton from '../components/GoogleSignInButton.jsx'
import PostCard from '../components/PostCard.jsx'
import { createTextPost, fetchFeed } from '../api.js'

export default function HomePage() {
  const { user, token, loading } = useAuth()
  const [params] = useSearchParams()
  const requestedScope = params.get('scope') === 'following' ? 'following' : 'everyone'
  const scope = requestedScope === 'following' && !user ? 'everyone' : requestedScope

  const [posts, setPosts] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [error, setError] = useState(null)
  const [composeText, setComposeText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (loading) return
    let cancelled = false
    setFeedLoading(true)
    setError(null)
    fetchFeed(scope, token)
      .then((data) => {
        if (!cancelled) setPosts(data.posts)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [scope, token, loading])

  async function handlePost(e) {
    e.preventDefault()
    const text = composeText.trim()
    if (!text) return
    setPosting(true)
    setError(null)
    try {
      await createTextPost(token, text)
      setComposeText('')
      const data = await fetchFeed(scope, token)
      setPosts(data.posts)
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="wrap wide">
      <p className="eyebrow">The feed</p>
      <h1>What's everyone up to?</h1>

      {!loading && user && (
        <form onSubmit={handlePost} className="composer">
          <textarea
            placeholder="Share something with your followers..."
            value={composeText}
            maxLength={500}
            onChange={(e) => setComposeText(e.target.value)}
          />
          <button type="submit" disabled={posting || !composeText.trim()}>
            {posting ? 'Posting…' : 'Post'}
          </button>
        </form>
      )}

      {!loading && !user && (
        <div className="result-card">
          <p style={{ marginTop: 0 }}>Sign in to post and see who you follow.</p>
          <GoogleSignInButton />
        </div>
      )}

      <div className="filters">
        <Link to="/?scope=following" className={scope === 'following' ? 'active' : ''}>
          Following
        </Link>
        <Link to="/?scope=everyone" className={scope === 'everyone' ? 'active' : ''}>
          Everyone
        </Link>
      </div>

      {error && <div className="banner err">{error}</div>}

      {!feedLoading && !error && posts.length === 0 && (
        <div className="empty-state">
          {scope === 'following' ? "No posts yet from people you follow." : 'No posts yet — be the first!'}
        </div>
      )}

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
