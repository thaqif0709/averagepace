import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import GoogleSignInButton from '../components/GoogleSignInButton.jsx'
import { submitRun, fetchEventSuggestions } from '../api.js'
import { autoFormatDurationInput, formatDuration, formatEventDate, formatPace, parseDuration, todayLocalISO } from '../format.js'
import ExternalLinkIcon from '../components/ExternalLinkIcon.jsx'
import { useDocumentMeta } from '../useDocumentMeta.js'

const DISTANCE_PRESETS = [
  ['5', '5K'],
  ['10', '10K'],
  ['21.1', 'Half'],
  ['42.2', 'Marathon'],
]

export default function UploadPage() {
  useDocumentMeta({
    title: 'Submit a Race Result',
    description: 'Log a 5K, 10K, half marathon or marathon time in seconds - no GPX file needed. Just enter your time or paste an official result link.',
  })

  const { user, token, loading } = useAuth()
  const [claimedDistanceKm, setClaimedDistanceKm] = useState('')
  const [manualTime, setManualTime] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [timeType, setTimeType] = useState('gun')
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventSuggestions, setEventSuggestions] = useState([])
  const [showEventSuggestions, setShowEventSuggestions] = useState(false)
  const [caption, setCaption] = useState('')
  const [response, setResponse] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [networkError, setNetworkError] = useState(null)

  useEffect(() => {
    const query = eventName.trim()
    if (query.length < 2) {
      setEventSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      fetchEventSuggestions(query)
        .then((data) => {
          if (!cancelled) setEventSuggestions(data.suggestions)
        })
        .catch(() => {})
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [eventName])

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
      const data = await submitRun({ token, claimedDistanceKm, claimedDurationS, resultUrl, timeType, eventName, eventDate, caption })
      setResponse(data)
      setCaption('')
    } catch (err) {
      setNetworkError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setResponse(null)
    setNetworkError(null)
    setClaimedDistanceKm('')
    setManualTime('')
    setResultUrl('')
    setTimeType('gun')
    setEventName('')
    setEventDate('')
    setCaption('')
  }

  const result = response?.result
  const showResult = Boolean(response?.saved && result)

  return (
    <div className="wrap wide">
      <p className="eyebrow">No subscription. No segments. Just your time.</p>
      <h1>Log your official run.<br />See where it ranks.</h1>
      <p className="lede">
        Got a link to your official race result? Paste it in, then type in
        what it shows — the link travels with your entry as a citation
        anyone can click through, which gives your time an extra trust
        boost. No link yet? You can still log your time and add one later.
      </p>

      {loading && null}

      {!loading && !user && (
        <div className="result-card">
          <p style={{ marginTop: 0 }}>Sign in with Google to submit a run — this ties it to your profile.</p>
          <GoogleSignInButton />
        </div>
      )}

      {!loading && user && !showResult && (
        <>
          {networkError && <div className="banner err">{networkError}</div>}
          {!networkError && response?.error && <div className="banner err">{response.error}</div>}

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
              Open it yourself, then type what it shows below. It's saved as
              a citation on your entry, so anyone — including other runners
              — can click through and check it.
            </p>

            <label htmlFor="event_name">Event name (optional)</label>
            <div className="autocomplete">
              <input
                type="text"
                id="event_name"
                placeholder="e.g. Klang Marathon 2026"
                maxLength={200}
                autoComplete="off"
                value={eventName}
                onChange={(e) => {
                  setEventName(e.target.value)
                  setShowEventSuggestions(true)
                }}
                onFocus={() => setShowEventSuggestions(true)}
                onBlur={() => setShowEventSuggestions(false)}
              />
              {showEventSuggestions && eventSuggestions.length > 0 && (
                <ul className="autocomplete-list">
                  {eventSuggestions.map((s) => (
                    <li key={s.name}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setEventName(s.name)
                          setShowEventSuggestions(false)
                        }}
                      >
                        <span>{s.name}</span>
                        <span className="autocomplete-count">{s.use_count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="hint">
              Start typing and we'll suggest names other runners have already
              used, so the same event stays tagged the same way.
            </p>

            <label htmlFor="event_date">Event date (optional)</label>
            <div className="date-field">
              <input
                type="date"
                id="event_date"
                max={todayLocalISO()}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
              {eventDate && (
                <button type="button" className="ghost" onClick={() => setEventDate('')}>
                  Clear
                </button>
              )}
            </div>

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
                <div className="segmented distance-presets">
                  {DISTANCE_PRESETS.map(([km, label]) => (
                    <button
                      key={km}
                      type="button"
                      className={claimedDistanceKm === km ? 'active' : ''}
                      onClick={() => setClaimedDistanceKm(km)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="manual_time">Time</label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="manual_time"
                  required
                  placeholder="e.g. 2548 -> 25:48"
                  value={manualTime}
                  onChange={(e) => setManualTime(autoFormatDurationInput(e.target.value))}
                />
              </div>
            </div>
            <p className="hint">
              Both come from the result above, or type your own if you're
              not linking one. For time, just type the numbers in order —
              e.g. 2548 becomes 25:48 — and pace is worked out for you.
            </p>

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
            <p className="hint">
              Chip time starts when you cross the start line; gun time starts
              when the race gun fires. Most results default to gun time -
              switch this if yours shows chip time instead.
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

      {showResult && (
        <div className={`result-card tier-${result.tier}`}>
          <span className={`tier-pill tier-${result.tier}`}>
            {result.tier === 'green' && 'Verified — high trust'}
            {result.tier === 'yellow' && (result.file_hash ? 'Device-synced — needs review' : 'Official result linked')}
            {result.tier === 'red' && (result.file_hash ? 'Flagged — manual review required' : 'Logged — no link added yet')}
          </span>
          {(result.event_name || result.event_date) && (
            <p className="result-event-name">
              {result.event_name}
              {result.event_name && result.event_date && ' '}
              {result.event_date && `(${formatEventDate(result.event_date)})`}
            </p>
          )}
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
                View official result
                <ExternalLinkIcon />
              </a>
            </p>
          )}
          {result.flags?.length > 0 && (
            <div className="flags">
              <strong>Why this score:</strong>
              <ul>
                {result.flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          <button type="button" onClick={handleReset}>
            Submit another run
          </button>
        </div>
      )}
    </div>
  )
}
