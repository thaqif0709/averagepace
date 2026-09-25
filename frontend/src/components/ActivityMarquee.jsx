import { useLayoutEffect, useMemo, useRef } from 'react'
import { formatDuration } from '../format.js'

const DISTANCE_LABELS = { '5k': '5K', '10k': '10K', half: 'HALF MARATHON', marathon: 'MARATHON' }

// Shown alongside (or instead of, if there isn't much real activity yet)
// actual recent runs, so the strip never looks thin or repeats one message
// on a loop.
const FALLBACK_MESSAGES = [
  'NO PAYWALL ON YOUR RUNNING HISTORY',
  'EVERY RESULT GETS A TRUST SCORE',
  'PASTE THE LINK, LOG THE TIME, DONE',
  'YOUR DATA SHOULD BE FREE',
]

const MIN_REAL_MESSAGES = 4
const MAX_REAL_MESSAGES = 8
// The loop trick below only looks seamless if one copy of the track is at
// least as wide as the viewport - otherwise there's a gap of bare
// background visible partway through the scroll (looks like the strip
// "goes black"). There's no reliable width to measure before first paint,
// so this pads with an estimate generous enough for wide/ultrawide
// monitors rather than just typical widths.
const MIN_TRACK_CHARS = 450
const SEPARATOR = '   •   '
// Fixed scroll speed rather than a fixed duration - the padding above
// means the track's actual length varies a lot (a short fallback-only
// list vs. 8 real messages), and a fixed duration made the padded (longer)
// version scroll noticeably faster than before.
const PIXELS_PER_SECOND = 48

function activityMessage(post) {
  const distance = DISTANCE_LABELS[post.distance_bucket] ?? post.distance_bucket.toUpperCase()
  const name = (post.user_name || '').toUpperCase()
  return `${name} JUST LOGGED A ${distance} — ${formatDuration(post.duration_s)}`
}

export default function ActivityMarquee({ posts }) {
  const trackRef = useRef(null)

  const messages = useMemo(() => {
    const real = posts.filter((p) => p.run_id).slice(0, MAX_REAL_MESSAGES).map(activityMessage)
    return real.length >= MIN_REAL_MESSAGES ? real : [...real, ...FALLBACK_MESSAGES]
  }, [posts])

  let padded = messages
  while (padded.join(SEPARATOR).length < MIN_TRACK_CHARS) {
    padded = padded.concat(messages)
  }
  const track = padded.join(SEPARATOR) + SEPARATOR

  // Runs before paint so the correct speed applies from the first frame,
  // not just after a visible jump once this measures.
  useLayoutEffect(() => {
    if (!trackRef.current) return
    const oneCopyWidth = trackRef.current.scrollWidth / 2
    trackRef.current.style.setProperty('--marquee-duration', `${oneCopyWidth / PIXELS_PER_SECOND}s`)
  }, [track])

  if (messages.length === 0) return null

  return (
    <div className="activity-marquee" aria-hidden="true">
      <div className="activity-marquee-track" ref={trackRef}>
        <span>{track}</span>
        <span>{track}</span>
      </div>
    </div>
  )
}
