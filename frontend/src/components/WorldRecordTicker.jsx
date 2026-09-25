import { useEffect, useRef, useState } from 'react'
import { WORLD_RECORDS } from '../data/worldRecords.js'

const CYCLE_MS = 2800
const COUNT_MS = 1000

function secondsFromDigits(digits) {
  const hh = Number(digits.slice(0, 2))
  const mm = Number(digits.slice(2, 4))
  const ss = Number(digits.slice(4, 6))
  return hh * 3600 + mm * 60 + ss
}

function digitsFromSeconds(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join('')
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

export default function WorldRecordTicker() {
  const [index, setIndex] = useState(0)
  const [displaySeconds, setDisplaySeconds] = useState(() => secondsFromDigits(WORLD_RECORDS[0].digits))
  const fromRef = useRef(displaySeconds)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % WORLD_RECORDS.length)
    }, CYCLE_MS)
    return () => clearInterval(timer)
  }, [])

  // Counts the displayed clock from wherever it currently sits to the new
  // record's time, forward or backward, instead of just swapping the
  // number - like a stopwatch actually running through the seconds. Uses
  // requestAnimationFrame rather than a CSS animation/transition so it
  // isn't affected by prefers-reduced-motion (deliberately - the count is
  // the whole point of the ticker, same reasoning as the loading spinner).
  useEffect(() => {
    const toSeconds = secondsFromDigits(WORLD_RECORDS[index].digits)
    const fromSeconds = fromRef.current
    const start = performance.now()
    let rafId

    function step(now) {
      const progress = Math.min(1, (now - start) / COUNT_MS)
      const eased = easeOutCubic(progress)
      setDisplaySeconds(fromSeconds + (toSeconds - fromSeconds) * eased)
      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        fromRef.current = toSeconds
      }
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [index])

  const record = WORLD_RECORDS[index]
  const digits = digitsFromSeconds(displaySeconds)

  return (
    <div className="wr-ticker" aria-hidden="true">
      <p className="wr-ticker-label">Current world record</p>
      <div className="wr-ticker-digits">
        {digits.split('').map((digit, i) => (
          <span className="wr-digit-group" key={i}>
            {(i === 2 || i === 4) && <span className="wr-colon">:</span>}
            <span className="wr-digit">{digit}</span>
          </span>
        ))}
      </div>
      <p className="wr-ticker-meta" key={record.distanceLabel}>
        {record.distanceLabel} &middot; {record.holder} &middot; {record.year}
      </p>
    </div>
  )
}
