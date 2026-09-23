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

export async function submitRun({ token, claimedDistanceKm, claimedDurationS, gpxFile, caption }) {
  const form = new FormData()
  form.append('claimed_distance_km', claimedDistanceKm)
  if (gpxFile) {
    form.append('gpx_file', gpxFile)
  } else if (claimedDurationS != null) {
    form.append('claimed_duration_s', claimedDurationS)
  }
  if (caption) form.append('caption', caption)

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

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchFeed(scope, token) {
  const params = new URLSearchParams({ scope })
  const res = await fetch(`${API_URL}/api/feed?${params}`, { headers: authHeaders(token) })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || 'Failed to load feed')
  }
  return res.json()
}

export async function createTextPost(token, body) {
  const res = await fetch(`${API_URL}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ body }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail || 'Failed to post')
  }
  return res.json()
}

export async function fetchUserProfile(userId, token) {
  const res = await fetch(`${API_URL}/api/users/${userId}`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('User not found')
  return res.json()
}

export async function fetchUserPosts(userId) {
  const res = await fetch(`${API_URL}/api/users/${userId}/posts`)
  if (!res.ok) throw new Error('Failed to load posts')
  return res.json()
}

export async function fetchFollowers(userId) {
  const res = await fetch(`${API_URL}/api/users/${userId}/followers`)
  if (!res.ok) throw new Error('Failed to load followers')
  return res.json()
}

export async function fetchFollowing(userId) {
  const res = await fetch(`${API_URL}/api/users/${userId}/following`)
  if (!res.ok) throw new Error('Failed to load following')
  return res.json()
}

export async function followUser(userId, token) {
  const res = await fetch(`${API_URL}/api/users/${userId}/follow`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || 'Failed to follow')
  }
  return res.json()
}

export async function unfollowUser(userId, token) {
  const res = await fetch(`${API_URL}/api/users/${userId}/follow`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to unfollow')
  return res.json()
}
