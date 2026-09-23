const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function googleLogin(credential) {
  const res = await fetch(`${API_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  if (!res.ok) throw new Error('Google sign-in failed')
  return res.json()
}

export async function fetchMe(token) {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Session expired')
  return res.json()
}

export async function fetchMyRuns(token) {
  const res = await fetch(`${API_URL}/api/profile/runs`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to load your runs')
  return res.json()
}

export async function submitRun({ token, claimedDistanceKm, claimedDurationS, gpxFile }) {
  const form = new FormData()
  form.append('claimed_distance_km', claimedDistanceKm)
  if (gpxFile) {
    form.append('gpx_file', gpxFile)
  } else if (claimedDurationS != null) {
    form.append('claimed_duration_s', claimedDurationS)
  }

  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || `Upload failed (${res.status})`)
  }
  return res.json()
}

export async function fetchLeaderboard({ distance, tier }) {
  const params = new URLSearchParams({ distance, tier })
  const res = await fetch(`${API_URL}/api/leaderboard?${params}`)
  if (!res.ok) throw new Error(`Leaderboard fetch failed (${res.status})`)
  return res.json()
}
