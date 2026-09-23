import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { fetchMyRuns } from '../api.js'
import { formatDuration, formatPace } from '../format.js'

const DISTANCE_LABELS = { '5k': '5K', '10k': '10K', half: 'Half Marathon', marathon: 'Marathon' }

export default function ProfilePage() {
  const { user, token, loading } = useAuth()
  const [runs, setRuns] = useState([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    fetchMyRuns(token)
      .then((data) => setRuns(data.rows))
      .catch((err) => setError(err.message))
      .finally(() => setRunsLoading(false))
  }, [token])

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  return (
    <div className="wrap wide">
      <div className="profile-header">
        {user.avatar_url && <img src={user.avatar_url} alt="" />}
        <div>
          <h1>{user.name}</h1>
          <p className="lede">{user.email}</p>
        </div>
      </div>

      <h2>Your submissions</h2>

      {error && <div className="banner err">{error}</div>}

      {!runsLoading && !error && runs.length === 0 && (
        <div className="empty-state">You haven't submitted a run yet.</div>
      )}

      {runs.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Distance</th>
              <th>Time</th>
              <th>Pace</th>
              <th>Trust</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((row) => (
              <tr key={row.id}>
                <td>{DISTANCE_LABELS[row.distance_bucket] ?? row.distance_bucket}</td>
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
    </div>
  )
}
