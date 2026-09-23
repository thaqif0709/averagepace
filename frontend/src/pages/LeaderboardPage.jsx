import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { fetchLeaderboard } from '../api.js'
import { formatDuration, formatPace } from '../format.js'

const DISTANCES = [
  ['5k', '5K'],
  ['10k', '10K'],
  ['half', 'Half Marathon'],
  ['marathon', 'Marathon'],
]

export default function LeaderboardPage() {
  const [params] = useSearchParams()
  const distance = params.get('distance') || '5k'
  const tier = params.get('tier') || 'all'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchLeaderboard({ distance, tier })
      .then((data) => {
        if (!cancelled) setRows(data.rows)
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
  }, [distance, tier])

  const distanceLabel = DISTANCES.find(([key]) => key === distance)?.[1] ?? distance

  return (
    <div className="wrap wide">
      <p className="eyebrow">Finish-line board</p>
      <h1>{distanceLabel} leaderboard</h1>
      <p className="lede">
        Every runner here submitted a raw GPX file. Green means it passed every automated
        check. Yellow means it's plausible but hasn't been cross-checked. Red never makes
        it here.
      </p>

      <div className="filters">
        {DISTANCES.map(([key, label]) => (
          <Link
            key={key}
            to={`/leaderboard?distance=${key}&tier=${tier}`}
            className={distance === key ? 'active' : ''}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="filters">
        <Link
          to={`/leaderboard?distance=${distance}&tier=all`}
          className={tier === 'all' ? 'active' : ''}
        >
          All tiers
        </Link>
        <Link
          to={`/leaderboard?distance=${distance}&tier=green`}
          className={tier === 'green' ? 'active' : ''}
        >
          Verified only
        </Link>
      </div>

      {error && <div className="banner err">{error}</div>}

      {!loading && !error && rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Runner</th>
              <th>Time</th>
              <th>Pace</th>
              <th>Trust</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id}>
                <td className="rank">{i + 1}</td>
                <td>{row.runner_name}</td>
                <td className="time-cell">{formatDuration(row.duration_s)}</td>
                <td>{formatPace(row.pace_sec_per_km)}</td>
                <td>
                  <span className={`tier-dot ${row.tier}`}></span>
                  {row.tier} · {row.trust_score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="empty-state">
          No {distanceLabel} times yet. Be the first —{' '}
          <Link to="/submit" style={{ color: 'var(--accent)' }}>
            submit a run
          </Link>
          .
        </div>
      )}
    </div>
  )
}
