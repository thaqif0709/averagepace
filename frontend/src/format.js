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

/**
 * Live-formats raw digit input into MM:SS or H:MM:SS as the user types,
 * peeling two-digit groups off the right (seconds, then minutes, then
 * hours) - e.g. typing "2548" progressively shows "2", "25", "2:54", "25:48".
 */
export function autoFormatDurationInput(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 6)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `0:${digits.padStart(2, '0')}`

  const seconds = digits.slice(-2)
  const rest = digits.slice(0, -2)
  if (rest.length <= 2) return `${parseInt(rest, 10)}:${seconds}`

  const minutes = rest.slice(-2)
  const hours = rest.slice(0, -2)
  return `${parseInt(hours, 10)}:${minutes}:${seconds}`
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
