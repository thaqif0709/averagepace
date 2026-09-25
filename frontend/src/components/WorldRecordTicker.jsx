import { useEffect, useState } from 'react'
import { WORLD_RECORDS } from '../data/worldRecords.js'

const CYCLE_MS = 2800

function Digit({ value }) {
  return (
    <span className="wr-digit">
      <span className="wr-digit-inner" key={value}>{value}</span>
    </span>
  )
}

export default function WorldRecordTicker() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % WORLD_RECORDS.length)
    }, CYCLE_MS)
    return () => clearInterval(timer)
  }, [])

  const record = WORLD_RECORDS[index]

  return (
    <div className="wr-ticker" aria-hidden="true">
      <p className="wr-ticker-label">Current world record</p>
      <div className="wr-ticker-digits">
        {record.digits.split('').map((digit, i) => (
          <span className="wr-digit-group" key={i}>
            {(i === 2 || i === 4) && <span className="wr-colon">:</span>}
            <Digit value={digit} />
          </span>
        ))}
      </div>
      <p className="wr-ticker-meta" key={record.distanceLabel}>
        {record.distanceLabel} &middot; {record.holder} &middot; {record.year}
      </p>
    </div>
  )
}
