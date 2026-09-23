import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import GoogleSignInButton from '../components/GoogleSignInButton.jsx'
import { submitRun } from '../api.js'
import { autoFormatDurationInput, formatDuration, formatPace, parseDuration } from '../format.js'

export default function UploadPage() {
  const { user, token, loading } = useAuth()
  const [claimedDistanceKm, setClaimedDistanceKm] = useState('')
  const [manualTime, setManualTime] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [timeType, setTimeType] = useState('')
  const [caption, setCaption] = useState('')
  const [response, setResponse] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [networkError, setNetworkError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setNetworkError(null)

    const claimedDurationS = parseDuration(manualTime)
    if (claimedDurationS == null) {
      setNetworkError('Enter your time as MM:SS or H:MM:SS (e.g. 25:00).')
      return
    }

    setSubmitting(true)
    try {
      const data = await submitRun({ token, claimedDistanceKm, claimedDurationS, resultUrl, timeType, caption })
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
    <div className="wrap wide">
      <p className="eyebrow">No subscription. No segments. Just your time.</p>
      <h1>Log your official run.<br />See where it ranks.</h1>
      <p className="lede">
        Start with the link to your official race result. We can't read the
        page for you — a lot of race-timing sites actively block automated
        access — so you'll type in what it shows, but the link travels with
        your entry as a citation anyone can click through and check, and it's
        what earns the trust bump over a bare claim.
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
            <label htmlFor="result_url">Link to your official result (optional, but recommended)</label>
            <input
              type="url"
              id="result_url"
              placeholder="https://results.example.com/..."
              value={resultUrl}
              onChange={(e) => setResultUrl(e.target.value)}
            />
            <p className="hint">
              Open it yourself, then type what it shows below. We don't fetch
              it on our end, but it's saved as a citation on your entry that
              anyone — including other runners — can click through and check.
            </p>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="claimed_distance_km">Distance (km)</label>
                <input
                  type="number"
                  id="claimed_distance_km"
                  step="0.01"
                  required
                  placeholder="e.g. 5, 10, 21.1, 42.2"
                  value={claimedDistanceKm}
                  onChange={(e) => setClaimedDistanceKm(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="manual_time">Time</label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="manual_time"
                  required
                  placeholder="e.g. 2548 → 25:48"
                  value={manualTime}
                  onChange={(e) => setManualTime(autoFormatDurationInput(e.target.value))}
                />
              </div>
            </div>
            <p className="hint">
              Both from the result above, or your own claim if you're not
              linking one. Just type the time's digits, right to left —
              seconds, then minutes, then hours. Pace is calculated
              automatically from distance and time.
            </p>

            <label>Which time is this? (optional)</label>
            <div className="segmented">
              <button
                type="button"
                className={timeType === 'gun' ? 'active' : ''}
                onClick={() => setTimeType(timeType === 'gun' ? '' : 'gun')}
              >
                Gun time
              </button>
              <button
                type="button"
                className={timeType === 'chip' ? 'active' : ''}
                onClick={() => setTimeType(timeType === 'chip' ? '' : 'chip')}
              >
                Chip time
              </button>
            </div>
            <p className="hint">
              Chip time starts when you cross the start line; gun time starts
              when the race gun fires. Tagging it means anyone comparing your
              entry to the result link knows which clock they're checking.
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
            {result.tier === 'yellow' && (result.file_hash ? 'Device-synced — needs review' : 'Official result linked')}
            {result.tier === 'red' && (result.file_hash ? 'Flagged — manual review required' : 'Unverified — no official link provided')}
          </span>
          <div className="split-readout">
            {formatDuration(result.duration_s)}
            {result.time_type && <span className="time-type-tag">{result.time_type} time</span>}
          </div>
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
          {result.result_url && (
            <p className="result-link">
              <a href={result.result_url} target="_blank" rel="noopener noreferrer">
                View official result ↗
              </a>
            </p>
          )}
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
