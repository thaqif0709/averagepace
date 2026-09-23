export function formatDuration(seconds) {
  if (seconds == null) return '--:--'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatPace(secPerKm) {
  if (!secPerKm) return '--:--'
  const total = Math.floor(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}/km`
}

/** Parses "MM:SS" or "H:MM:SS" into seconds. Returns null if unparseable. */
export function parseDuration(input) {
  if (!input) return null
  const parts = input.trim().split(':')
  if (parts.length !== 2 && parts.length !== 3) return null
  const nums = parts.map(Number)
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null
  if (nums.length === 2) {
    const [m, s] = nums
    return m * 60 + s
  }
  const [h, m, s] = nums
  return h * 3600 + m * 60 + s
}
