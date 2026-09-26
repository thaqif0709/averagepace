import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import GoogleSignInButton from '../components/GoogleSignInButton.jsx'
import PostCard from '../components/PostCard.jsx'
import RunningLoader from '../components/RunningLoader.jsx'
import WorldRecordTicker from '../components/WorldRecordTicker.jsx'
import ActivityMarquee from '../components/ActivityMarquee.jsx'
import { createTextPost, fetchFeed } from '../api.js'
import { useDocumentMeta } from '../useDocumentMeta.js'

export default function HomePage() {
  useDocumentMeta()

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

  function handlePostUpdated(updated) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
  }

  function handlePostDeleted(postId) {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  return (
    <>
      {!loading && !user && <ActivityMarquee posts={posts} />}
      <div className="wrap wide">
        {!loading && user && (
          <>
            <p className="eyebrow">The feed</p>
            <h1>What's everyone up to?</h1>
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
          </>
        )}

        {!loading && !user && (
          <>
            <section className="hero">
              <p className="eyebrow">Race results, consolidated</p>
              <h1>All your race results.<br />One place. No paywall.</h1>
              <WorldRecordTicker />
              <p className="lede">
                Official times scattered across a different results site
                for every race — one for the marathon, another for last
                month's local 10K. AvgPace keeps them as a single
                running history: paste the link, log the time, done. The
                "orange app" keeps your best-effort history behind a
                subscription. We don't — your data should be free.
              </p>
              <div className="hero-actions">
                <GoogleSignInButton />
                <Link to="/leaderboard" className="hero-secondary-link">See the leaderboard -&gt;</Link>
              </div>
            </section>

            <div className="how-it-works">
              <div className="step">
                <span className="step-num">01</span>
                <h3>Log your time</h3>
                <p>Paste a link to your official result, or just type your time if you don't have one yet.</p>
              </div>
              <div className="step">
                <span className="step-num">02</span>
                <h3>Get a trust score</h3>
                <p>Every entry is scored green, yellow, or red based on how verifiable it is — never a black box.</p>
              </div>
              <div className="step">
                <span className="step-num">03</span>
                <h3>It's yours, free</h3>
                <p>Your full history and best efforts live on your profile and the leaderboard. No paywall, ever.</p>
              </div>
            </div>

            <h2>Latest logged runs</h2>
          </>
        )}

        {user && (
          <div className="filters">
            <Link to="/?scope=following" className={scope === 'following' ? 'active' : ''}>
              Following
            </Link>
            <Link to="/?scope=everyone" className={scope === 'everyone' ? 'active' : ''}>
              Everyone
            </Link>
          </div>
        )}

        {error && <div className="banner err">{error}</div>}

        {feedLoading && <RunningLoader />}

        {!feedLoading && !error && posts.length === 0 && (
          <div className="empty-state">
            {scope === 'following' ? "No posts yet from people you follow." : 'No posts yet — be the first!'}
          </div>
        )}

        {posts.length > 0 && (
          <div className="feed">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onUpdated={handlePostUpdated} onDeleted={handlePostDeleted} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
