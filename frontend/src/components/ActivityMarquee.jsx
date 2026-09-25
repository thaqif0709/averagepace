import { useLayoutEffect, useMemo, useRef } from 'react'
import { formatDuration } from '../format.js'

const DISTANCE_LABELS = { '5k': '5K', '10k': '10K', half: 'HALF MARATHON', marathon: 'MARATHON' }

// Shown instead of actual recent runs until enough different people have
// logged something - a single user's runs looping past under their own
// name on repeat reads more like a bug than real activity.
const FALLBACK_MESSAGES = [
  'NO PAYWALL ON YOUR RUNNING HISTORY',
  'EVERY RESULT GETS A TRUST SCORE',
  'PASTE THE LINK, LOG THE TIME, DONE',
  'YOUR DATA SHOULD BE FREE',
]

// Gated on distinct users, not raw post count - a single prolific user's
// runs would otherwise clear a post-count bar alone and loop their own name
// on repeat, which reads more like a bug than real activity.
const MIN_DISTINCT_USERS = 4
const MAX_REAL_MESSAGES = 8
// The loop trick below only looks seamless if one copy of the track is at
// least as wide as the viewport - otherwise there's a gap of bare
// background visible partway through the scroll (looks like the strip
// "goes black"). There's no reliable width to measure before first paint,
// so this pads with an estimate generous enough for wide/ultrawide
// monitors rather than just typical widths.
const MIN_TRACK_CHARS = 450
const SEPARATOR = '   •   '
// Speed is calibrated relative to the container's width, not a fixed
// pixel rate - a fixed px/s reads much faster on a narrow phone screen
// than a wide desktop one, since the same absolute speed covers a bigger
// fraction of a small screen every second. This targets "one
// container-width of text scrolls by every ~26.7s" (tuned against a
// ~1280px desktop view feeling right).
const SECONDS_PER_CONTAINER_WIDTH = 1280 / 48
// ...but matching that relative pace exactly made phone-width screens feel
// sluggish on their own terms (14.6px/s at 390px) - a ticker apparently
// wants a brisker floor regardless of how little screen it's crossing.
// This only raises the speed on viewports narrower than ~640px; anything
// at or above that already clears the floor from the formula above, so
// desktop is untouched.
const MIN_PIXELS_PER_SECOND = 24

function activityMessage(post) {
  const distance = DISTANCE_LABELS[post.distance_bucket] ?? post.distance_bucket.toUpperCase()
  const name = (post.user_name || '').toUpperCase()
  return `${name} JUST LOGGED A ${distance} — ${formatDuration(post.duration_s)}`
}

export default function ActivityMarquee({ posts }) {
  const trackRef = useRef(null)

  const messages = useMemo(() => {
    const real = posts.filter((p) => p.run_id).slice(0, MAX_REAL_MESSAGES)
    const distinctUsers = new Set(real.map((p) => p.user_id)).size
    return distinctUsers >= MIN_DISTINCT_USERS ? real.map(activityMessage) : FALLBACK_MESSAGES
  }, [posts])

  let padded = messages
  while (padded.join(SEPARATOR).length < MIN_TRACK_CHARS) {
    padded = padded.concat(messages)
  }
  const track = padded.join(SEPARATOR) + SEPARATOR

  // Runs before paint so the correct speed applies from the first frame,
  // not just after a visible jump once this measures. Also watches the
  // container for size changes (window resize, phone rotation) so the
  // felt pace doesn't go stale after mount.
  useLayoutEffect(() => {
    const trackEl = trackRef.current
    if (!trackEl) return

    function applySpeed() {
      const oneCopyWidth = trackEl.scrollWidth / 2
      const containerWidth = trackEl.parentElement.clientWidth
      const speed = Math.max(containerWidth / SECONDS_PER_CONTAINER_WIDTH, MIN_PIXELS_PER_SECOND)
      trackEl.style.setProperty('--marquee-duration', `${oneCopyWidth / speed}s`)
    }

    applySpeed()
    const observer = new ResizeObserver(applySpeed)
    observer.observe(trackEl.parentElement)
    return () => observer.disconnect()
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
