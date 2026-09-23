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
        Green means an automated GPS check passed. Yellow means it's backed by
        an official result link — click ↗ to check it yourself. Red is a bare,
        unverified claim.
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
              <th>Runner</th>
              <th>Time</th>
              <th>Pace</th>
              <th>Trust</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id}>
                <td className="runner-cell" data-label="Runner">
                  <span className="rank">{i + 1}</span>
                  <span>{row.runner_name}</span>
                </td>
                <td className="time-cell" data-label="Time">
                  {formatDuration(row.duration_s)}
                  {row.time_type && <span className="time-type-tag">{row.time_type}</span>}
                </td>
                <td data-label="Pace">{formatPace(row.pace_sec_per_km)}</td>
                <td data-label="Trust">
                  <span className={`tier-dot ${row.tier}`}></span>
                  {row.tier} · {row.trust_score}
                  {row.result_url && (
                    <a
                      href={row.result_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="post-result-link"
                      title="View official result"
                    >
                      ↗
                    </a>
                  )}
                  {row.vouch_count > 0 && (
                    <span className="vouch-count-readonly"> · {row.vouch_count} vouched</span>
                  )}
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
