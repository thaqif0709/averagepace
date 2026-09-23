import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import GoogleSignInButton from '../components/GoogleSignInButton.jsx'
import { submitRun } from '../api.js'
import { autoFormatDurationInput, formatDuration, formatPace, parseDuration } from '../format.js'

export default function UploadPage() {
  const { user, token, loading } = useAuth()
  const [claimedDistanceKm, setClaimedDistanceKm] = useState('')
  const [manualTime, setManualTime] = useState('')
  const [gpxFile, setGpxFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [response, setResponse] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [networkError, setNetworkError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setNetworkError(null)

    let claimedDurationS = null
    if (!gpxFile) {
      claimedDurationS = parseDuration(manualTime)
      if (claimedDurationS == null) {
        setNetworkError('Enter your time as MM:SS or H:MM:SS (e.g. 25:00), or attach a GPX file instead.')
        return
      }
    }

    setSubmitting(true)
    try {
      const data = await submitRun({ token, claimedDistanceKm, claimedDurationS, gpxFile, caption })
      setResponse(data)
      setCaption('')
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

      {loading && null}

      {!loading && !user && (
        <div className="result-card">
          <p style={{ marginTop: 0 }}>Sign in with Google to submit a run — this ties it to your profile.</p>
          <GoogleSignInButton />
        </div>
      )}

      {!loading && user && (
        <>
          {networkError && <div className="banner err">{networkError}</div>}
          {!networkError && response?.error && <div className="banner err">{response.error}</div>}
          {!networkError && response?.saved && (
            <div className="banner ok">
              Recorded — {response.runner_name}'s {response.distance_label} is on the board.
            </div>
          )}

          <form onSubmit={handleSubmit}>
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

            <label htmlFor="manual_time">Your time</label>
            <input
              type="text"
              inputMode="numeric"
              id="manual_time"
              disabled={!!gpxFile}
              required={!gpxFile}
              placeholder="e.g. 2548 → 25:48"
              value={manualTime}
              onChange={(e) => setManualTime(autoFormatDurationInput(e.target.value))}
            />
            <p className="hint">
              Just type the digits, right to left — seconds, then minutes, then
              hours. Pace is calculated automatically from distance and time.
              Attaching a GPX file below gets you a verified score instead —
              this field is ignored if you do.
            </p>

            <label htmlFor="gpx_file">Or upload a GPX file (optional)</label>
            <input
              type="file"
              id="gpx_file"
              accept=".gpx"
              onChange={(e) => setGpxFile(e.target.files[0] || null)}
            />
            <p className="hint">
              Verifies your time and distance automatically instead of trusting
              what you typed above.
            </p>

            <label htmlFor="caption">Add a note (optional)</label>
            <textarea
              id="caption"
              placeholder="How'd it go?"
              maxLength={500}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <p className="hint">Posted to your profile and to anyone following you.</p>

            <button type="submit" disabled={submitting}>
              {submitting ? 'Scoring…' : 'Score this run'}
            </button>
          </form>
        </>
      )}

      {result && (
        <div className={`result-card tier-${result.tier}`}>
          <span className={`tier-pill tier-${result.tier}`}>
            {result.tier === 'green' && 'Verified — high trust'}
            {result.tier === 'yellow' && 'Device-synced — needs review'}
            {result.tier === 'red' && (result.file_hash ? 'Flagged — manual review required' : 'Unverified — no GPX provided')}
          </span>
          <div className="split-readout">{formatDuration(result.duration_s)}</div>
          <div className="stat-row">
            <div className="stat">
              <div className="num">{result.distance_km != null ? result.distance_km.toFixed(2) : '--'} km</div>
              <div className="label">{result.file_hash ? 'GPS distance' : 'Claimed distance'}</div>
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
