import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { fetchUserRunsByDistance, updateRunMetadata, deleteRun } from '../api.js'
import { formatDuration, formatPace } from '../format.js'

const DISTANCE_LABELS = { '5k': '5K', '10k': '10K', half: 'Half Marathon', marathon: 'Marathon' }

function RunRow({ run, rank, isOwn, token, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [eventName, setEventName] = useState(run.event_name || '')
  const [timeType, setTimeType] = useState(run.time_type || '')
  const [resultUrl, setResultUrl] = useState(run.result_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function startEdit() {
    setEventName(run.event_name || '')
    setTimeType(run.time_type || '')
    setResultUrl(run.result_url || '')
    setError(null)
    setConfirmingDelete(false)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateRunMetadata(token, run.id, {
        eventName: eventName.trim(),
        timeType,
        resultUrl: resultUrl.trim(),
      })
      setEditing(false)
      onUpdated({ ...run, ...updated })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteRun(token, run.id)
      onDeleted(run.id)
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={5}>
          <div className="post-edit-run-fields">
            <label htmlFor={`run_event_${run.id}`}>Event name</label>
            <input
              type="text"
              id={`run_event_${run.id}`}
              maxLength={200}
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              autoFocus
            />

            <label>Which time is this?</label>
            <div className="segmented">
              <button
                type="button"
                className={timeType === 'gun' ? 'active' : ''}
                onClick={() => setTimeType('gun')}
              >
                Gun time
              </button>
              <button
                type="button"
                className={timeType === 'chip' ? 'active' : ''}
                onClick={() => setTimeType('chip')}
              >
                Chip time
              </button>
            </div>

            <label htmlFor={`run_url_${run.id}`}>Official result link</label>
            <input
              type="url"
              id={`run_url_${run.id}`}
              placeholder="https://results.example.com/..."
              value={resultUrl}
              onChange={(e) => setResultUrl(e.target.value)}
            />
            <p className="hint">Distance and time can't be edited here — delete this entry and resubmit if those are wrong.</p>

            {error && <p className="post-edit-error">{error}</p>}

            <div className="post-edit-actions">
              <button type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              {!confirmingDelete && (
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={saving}
                >
                  Delete entry
                </button>
              )}
            </div>

            {confirmingDelete && (
              <div className="post-delete-confirm">
                <p>
                  Delete this entry for good? This can't be undone
                  {run.vouch_count > 0 && ` and will remove its ${run.vouch_count} vouch${run.vouch_count === 1 ? '' : 'es'}`}.
                </p>
                <div className="post-edit-actions">
                  <button type="button" className="danger" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Yes, delete it'}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="runner-cell" data-label="Rank">
        <span className="rank">{rank}</span>
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
        {isOwn && (
          <button type="button" className="post-edit-btn run-row-edit-btn" onClick={startEdit}>
            Edit
          </button>
        )}
      </td>
    </tr>
  )
}

export default function BestEffortDetailPage() {
  const { userId, distanceBucket } = useParams()
  const { user, token, loading: authLoading } = useAuth()
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

  function handleRunUpdated(updated) {
    setRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  function handleRunDeleted(runId) {
    setRuns((prev) => prev.filter((r) => r.id !== runId))
  }

  const distanceLabel = DISTANCE_LABELS[distanceBucket] ?? distanceBucket
  const isOwn = user && String(user.id) === userId

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
              <RunRow
                key={run.id}
                run={run}
                rank={i + 1}
                isOwn={isOwn}
                token={token}
                onUpdated={handleRunUpdated}
                onDeleted={handleRunDeleted}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
