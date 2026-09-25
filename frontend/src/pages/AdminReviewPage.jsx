import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { fetchRecentlyVerified, fetchReviewQueue, unverifyRun, verifyRun } from '../api.js'
import { formatDuration, formatEventDate } from '../format.js'
import ExternalLinkIcon from '../components/ExternalLinkIcon.jsx'
import RunningLoader from '../components/RunningLoader.jsx'
import { useDocumentMeta } from '../useDocumentMeta.js'

function RunRow({ run, actionLabel, onAction, busy }) {
  return (
    <tr>
      <td data-label="Runner">{run.runner_name}</td>
      <td data-label="Event">
        {run.event_name || run.event_date ? (
          <span>
            {run.event_name}
            {run.event_name && run.event_date && ' '}
            {run.event_date && `(${formatEventDate(run.event_date)})`}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="time-cell" data-label="Distance / Time">
        <span>
          {run.distance_km?.toFixed(2)} km · {formatDuration(run.duration_s)}
          {run.time_type && <span className="time-type-tag">{run.time_type}</span>}
        </span>
      </td>
      <td data-label="Result link">
        <a href={run.result_url} target="_blank" rel="noopener noreferrer" className="post-result-link">
          Open link
          <ExternalLinkIcon />
        </a>
      </td>
      <td className="review-actions-cell">
        <button type="button" onClick={() => onAction(run.id)} disabled={busy}>
          {busy ? `${actionLabel}ing…` : actionLabel}
        </button>
      </td>
    </tr>
  )
}

function RunTable({ runs, actionLabel, onAction, actingId }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Runner</th>
          <th>Event</th>
          <th>Distance / Time</th>
          <th>Result link</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <RunRow key={run.id} run={run} actionLabel={actionLabel} onAction={onAction} busy={actingId === run.id} />
        ))}
      </tbody>
    </table>
  )
}

export default function AdminReviewPage() {
  const { user, token, loading: authLoading } = useAuth()
  const [runs, setRuns] = useState([])
  const [verified, setVerified] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actingId, setActingId] = useState(null)
  const isAdmin = Boolean(user?.is_admin)

  useDocumentMeta({ title: 'Admin', noindex: true })

  useEffect(() => {
    if (authLoading || !isAdmin) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchReviewQueue(token), fetchRecentlyVerified(token)])
      .then(([queueData, verifiedData]) => {
        if (!cancelled) {
          setRuns(queueData.runs)
          setVerified(verifiedData.runs)
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
  }, [authLoading, isAdmin, token])

  async function handleVerify(runId) {
    setActingId(runId)
    setError(null)
    try {
      await verifyRun(token, runId)
      const run = runs.find((r) => r.id === runId)
      setRuns((prev) => prev.filter((r) => r.id !== runId))
      if (run) setVerified((prev) => [{ ...run, tier: 'green' }, ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setActingId(null)
    }
  }

  async function handleUndo(runId) {
    setActingId(runId)
    setError(null)
    try {
      await unverifyRun(token, runId)
      const run = verified.find((r) => r.id === runId)
      setVerified((prev) => prev.filter((r) => r.id !== runId))
      if (run) setRuns((prev) => [{ ...run, tier: 'yellow' }, ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setActingId(null)
    }
  }

  if (authLoading) {
    return (
      <div className="wrap wide">
        <RunningLoader />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="wrap wide">
        <p className="eyebrow">Admin</p>
        <h1>Not authorized</h1>
        <p className="lede">This page is only available to AvgPace admins.</p>
      </div>
    )
  }

  return (
    <div className="wrap wide">
      <p className="eyebrow">Admin</p>
      <h1>Review queue</h1>
      <p className="lede">
        Runs backed by an official result link, waiting on a real check.
        Open the link, confirm it matches the distance and time claimed,
        then verify it — that's what turns a run green.
      </p>

      {error && <div className="banner err">{error}</div>}
      {loading && <RunningLoader />}

      {!loading && !error && runs.length === 0 && (
        <div className="empty-state">Nothing waiting on review.</div>
      )}

      {runs.length > 0 && (
        <RunTable runs={runs} actionLabel="Verify" onAction={handleVerify} actingId={actingId} />
      )}

      {!loading && !error && (
        <>
          <h2>Recently verified</h2>
          {verified.length === 0 ? (
            <div className="empty-state">Nothing verified yet.</div>
          ) : (
            <RunTable runs={verified} actionLabel="Undo" onAction={handleUndo} actingId={actingId} />
          )}
        </>
      )}
    </div>
  )
}
