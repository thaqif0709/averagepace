const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function submitRun({ runnerName, claimedDistanceKm, gpxFile }) {
  const form = new FormData()
  form.append('runner_name', runnerName)
  form.append('claimed_distance_km', claimedDistanceKm)
  if (gpxFile) form.append('gpx_file', gpxFile)

  const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  return res.json()
}

export async function fetchLeaderboard({ distance, tier }) {
  const params = new URLSearchParams({ distance, tier })
  const res = await fetch(`${API_URL}/api/leaderboard?${params}`)
  if (!res.ok) throw new Error(`Leaderboard fetch failed (${res.status})`)
  return res.json()
}
