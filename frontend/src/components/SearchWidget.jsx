import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { searchAll } from '../api.js'
import { formatDuration } from '../format.js'
import SearchIcon from './SearchIcon.jsx'

const TYPES = [
  ['people', 'People'],
  ['posts', 'Posts'],
  ['runs', 'Events'],
]

function ResultRow({ type, result, onNavigate }) {
  if (type === 'people') {
    return (
      <Link to={`/profile/${result.username}`} className="search-result-row" onClick={onNavigate}>
        {result.avatar_url ? (
          <img src={result.avatar_url} alt="" />
        ) : (
          <span className="avatar-fallback">{result.name?.[0]?.toUpperCase() ?? '?'}</span>
        )}
        <span className="search-result-text">
          <span className="search-result-title">{result.name}</span>
          {result.username && <span className="search-result-sub">@{result.username}</span>}
        </span>
      </Link>
    )
  }
  if (type === 'posts') {
    return (
      <Link to={`/profile/${result.user_username}`} className="search-result-row" onClick={onNavigate}>
        {result.user_avatar_url ? (
          <img src={result.user_avatar_url} alt="" />
        ) : (
          <span className="avatar-fallback">{result.user_name?.[0]?.toUpperCase() ?? '?'}</span>
        )}
        <span className="search-result-text">
          <span className="search-result-title">{result.user_name}</span>
          <span className="search-result-sub">{result.body}</span>
        </span>
      </Link>
    )
  }
  return (
    <Link to={`/profile/${result.runner_username}`} className="search-result-row" onClick={onNavigate}>
      <span className="avatar-fallback">{result.runner_name?.[0]?.toUpperCase() ?? '?'}</span>
      <span className="search-result-text">
        <span className="search-result-title">{result.runner_name}</span>
        <span className="search-result-sub">
          {result.event_name} · {formatDuration(result.duration_s)}
        </span>
      </span>
    </Link>
  )
}

export default function SearchWidget() {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('people')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const widgetRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (widgetRef.current && !widgetRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchAll(trimmed, type, token)
        .then((data) => {
          if (!cancelled) setResults(data.results)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, type, token, open])

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev
      if (!next) {
        setQuery('')
        setResults([])
      }
      return next
    })
  }

  function handleNavigate() {
    setOpen(false)
    setQuery('')
    setResults([])
  }

  const trimmed = query.trim()

  return (
    <div className="search-widget" ref={widgetRef}>
      <button
        type="button"
        className="search-toggle-btn"
        onClick={toggleOpen}
        aria-label="Search"
        aria-expanded={open}
      >
        <SearchIcon />
      </button>
      {open && (
        <div className="search-panel">
          <input
            type="text"
            placeholder="Search AveragePace..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="search-panel-filters">
            {TYPES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={type === key ? 'active' : ''}
                onClick={() => setType(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="search-panel-results">
            {loading && <p className="search-status">Searching…</p>}
            {!loading && trimmed.length > 0 && trimmed.length < 2 && (
              <p className="search-status">Keep typing…</p>
            )}
            {!loading && trimmed.length >= 2 && results.length === 0 && (
              <p className="search-status">No results.</p>
            )}
            {!loading &&
              results.map((r) => (
                <ResultRow key={r.id} type={type} result={r} onNavigate={handleNavigate} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
