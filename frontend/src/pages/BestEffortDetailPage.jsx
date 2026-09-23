import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { fetchUserRunsByDistance } from '../api.js'
import { formatDuration, formatPace } from '../format.js'

const DISTANCE_LABELS = { '5k': '5K', '10k': '10K', half: 'Half Marathon', marathon: 'Marathon' }

export default function BestEffortDetailPage() {
  const { userId, distanceBucket } = useParams()
  const { token, loading: authLoading } = useAuth()
  const [runs, setRuns] = useState([])
  const [gated, setGated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchUserRunsByDistance(userId, distanceBucket, token)
      .then((data) => {
        if (!cancelled) {
          setRuns(data.runs)
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
  }, [userId, distanceBucket, token, authLoading])

  const distanceLabel = DISTANCE_LABELS[distanceBucket] ?? distanceBucket

  return (
    <div className="wrap wide">
      <p className="eyebrow">
        <Link to={`/profile/${userId}`}>← Back to profile</Link>
      </p>
      <h1>{distanceLabel} history</h1>
      <p className="lede">Every {distanceLabel} you've logged, fastest first.</p>

      {error && <div className="banner err">{error}</div>}
      {!loading && !error && gated && (
        <div className="empty-state">This account is private. Follow to see their times.</div>
      )}
      {!loading && !error && !gated && runs.length === 0 && (
        <div className="empty-state">No {distanceLabel} times yet.</div>
      )}
      {!gated && runs.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Event</th>
              <th>Time</th>
              <th>Pace</th>
              <th>Trust</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, i) => (
              <tr key={run.id}>
                <td className="runner-cell" data-label="Rank">
                  <span className="rank">{i + 1}</span>
                  <span>{new Date(run.created_at).toLocaleDateString()}</span>
                </td>
                <td data-label="Event">{run.event_name || '—'}</td>
                <td className="time-cell" data-label="Time">
                  {formatDuration(run.duration_s)}
                  {run.time_type && <span className="time-type-tag">{run.time_type}</span>}
                </td>
                <td data-label="Pace">{formatPace(run.pace_sec_per_km)}</td>
                <td data-label="Trust">
                  <span className={`tier-dot ${run.tier}`}></span>
                  {run.tier} · {run.trust_score}
                  {run.result_url && (
                    <a
                      href={run.result_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="post-result-link"
                      title="View official result"
                    >
                      ↗
                    </a>
                  )}
                  {run.vouch_count > 0 && (
                    <span className="vouch-count-readonly"> · {run.vouch_count} vouched</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
