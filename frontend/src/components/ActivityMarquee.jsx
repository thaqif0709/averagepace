import { useMemo } from 'react'
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
const SEPARATOR = '   •   '

function activityMessage(post) {
  const distance = DISTANCE_LABELS[post.distance_bucket] ?? post.distance_bucket.toUpperCase()
  const name = (post.user_name || '').toUpperCase()
  return `${name} JUST LOGGED A ${distance} — ${formatDuration(post.duration_s)}`
}

export default function ActivityMarquee({ posts }) {
  const messages = useMemo(() => {
    const real = posts.filter((p) => p.run_id).slice(0, MAX_REAL_MESSAGES).map(activityMessage)
    return real.length >= MIN_REAL_MESSAGES ? real : [...real, ...FALLBACK_MESSAGES]
  }, [posts])

  if (messages.length === 0) return null

  const track = messages.join(SEPARATOR) + SEPARATOR

  return (
    <div className="activity-marquee" aria-hidden="true">
      <div className="activity-marquee-track">
        <span>{track}</span>
        <span>{track}</span>
      </div>
    </div>
  )
}
