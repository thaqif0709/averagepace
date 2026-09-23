import { useState } from 'react'
import { submitRun } from '../api.js'
import { formatDuration, formatPace } from '../format.js'

export default function UploadPage() {
  const [runnerName, setRunnerName] = useState('')
  const [claimedDistanceKm, setClaimedDistanceKm] = useState('')
  const [gpxFile, setGpxFile] = useState(null)
  const [response, setResponse] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [networkError, setNetworkError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!gpxFile) return
    setSubmitting(true)
    setNetworkError(null)
    try {
      const data = await submitRun({ runnerName, claimedDistanceKm, gpxFile })
      setResponse(data)
    } catch (err) {
      setNetworkError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const result = response?.result

  return (
    <div className="wrap">
      <p className="eyebrow">No subscription. No segments. Just your time.</p>
      <h1>Submit your run.<br />See where it ranks.</h1>
      <p className="lede">
        Upload the GPX file from your watch. We check the GPS track for physically
        impossible pace, GPS jumps, and distance mismatches — then rank you against
        every other runner who's submitted an honest file.
      </p>

      {networkError && <div className="banner err">{networkError}</div>}
      {!networkError && response?.error && <div className="banner err">{response.error}</div>}
      {!networkError && response?.saved && (
        <div className="banner ok">
          Recorded — {response.runner_name}'s {response.distance_label} is on the board.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor="runner_name">Your name</label>
        <input
          type="text"
          id="runner_name"
          required
          placeholder="e.g. John Doe"
          value={runnerName}
          onChange={(e) => setRunnerName(e.target.value)}
        />

        <label htmlFor="claimed_distance_km">Distance you ran (km)</label>
        <input
          type="number"
          id="claimed_distance_km"
          step="0.01"
          required
          placeholder="e.g. 5, 10, 21.1, 42.2"
          value={claimedDistanceKm}
          onChange={(e) => setClaimedDistanceKm(e.target.value)}
        />

        <label htmlFor="gpx_file">GPX file</label>
        <input
          type="file"
          id="gpx_file"
          accept=".gpx"
          required
          onChange={(e) => setGpxFile(e.target.files[0])}
        />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Scoring…' : 'Score this run'}
        </button>
      </form>

      {result && (
        <div className={`result-card tier-${result.tier}`}>
          <span className={`tier-pill tier-${result.tier}`}>
            {result.tier === 'green' && 'Verified — high trust'}
            {result.tier === 'yellow' && 'Device-synced — needs review'}
            {result.tier === 'red' && 'Flagged — manual review required'}
          </span>
          <div className="split-readout">{formatDuration(result.duration_s)}</div>
          <div className="stat-row">
            <div className="stat">
              <div className="num">{result.distance_km != null ? result.distance_km.toFixed(2) : '--'} km</div>
              <div className="label">GPS distance</div>
            </div>
            <div className="stat">
              <div className="num">{formatPace(result.pace_sec_per_km)}</div>
              <div className="label">Pace</div>
            </div>
            <div className="stat">
              <div className="num">{result.score}/100</div>
              <div className="label">Trust score</div>
            </div>
          </div>
          {result.flags?.length > 0 && (
            <div className="flags">
              <strong>Flags raised:</strong>
              <ul>
                {result.flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
