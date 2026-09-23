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

export async function submitRun({ token, claimedDistanceKm, claimedDurationS, gpxFile, resultUrl, timeType, eventName, caption }) {
  const form = new FormData()
  form.append('claimed_distance_km', claimedDistanceKm)
  if (gpxFile) {
    form.append('gpx_file', gpxFile)
  } else if (claimedDurationS != null) {
    form.append('claimed_duration_s', claimedDurationS)
  }
  if (resultUrl) form.append('result_url', resultUrl)
  if (timeType) form.append('time_type', timeType)
  if (eventName) form.append('event_name', eventName)
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

export async function updatePost(token, postId, body, runMetadata) {
  const payload = runMetadata
    ? { body, event_name: runMetadata.eventName, time_type: runMetadata.timeType, result_url: runMetadata.resultUrl }
    : { body }
  const res = await fetch(`${API_URL}/api/posts/${postId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail || 'Failed to save post')
  }
  return res.json()
}

export async function deleteRun(token, runId) {
  const res = await fetch(`${API_URL}/api/runs/${runId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail || 'Failed to delete')
  }
  return res.json()
}

export async function updateRunMetadata(token, runId, { eventName, timeType, resultUrl }) {
  const res = await fetch(`${API_URL}/api/runs/${runId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ event_name: eventName, time_type: timeType, result_url: resultUrl }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail || 'Failed to save')
  }
  return res.json()
}

export async function fetchUserProfile(userId, token) {
  const res = await fetch(`${API_URL}/api/users/${userId}`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('User not found')
  return res.json()
}

export async function fetchUserPosts(userId, token) {
  const res = await fetch(`${API_URL}/api/users/${userId}/posts`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Failed to load posts')
  return res.json()
}

export async function fetchBestEfforts(userId, token) {
  const res = await fetch(`${API_URL}/api/users/${userId}/best-efforts`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Failed to load best efforts')
  return res.json()
}

export async function fetchUserRunsByDistance(userId, distance, token) {
  const params = new URLSearchParams({ distance })
  const res = await fetch(`${API_URL}/api/users/${userId}/runs?${params}`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Failed to load runs')
  return res.json()
}

export async function fetchEventSuggestions(query) {
  const params = new URLSearchParams({ q: query })
  const res = await fetch(`${API_URL}/api/events/suggest?${params}`)
  if (!res.ok) throw new Error('Failed to load suggestions')
  return res.json()
}

export async function fetchFollowers(userId, token) {
  const res = await fetch(`${API_URL}/api/users/${userId}/followers`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Failed to load followers')
  return res.json()
}

export async function fetchFollowing(userId, token) {
  const res = await fetch(`${API_URL}/api/users/${userId}/following`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Failed to load following')
  return res.json()
}

export async function updatePrivacy(token, isPrivate) {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ is_private: isPrivate }),
  })
  if (!res.ok) throw new Error('Failed to update privacy')
  return res.json()
}

export async function fetchFollowRequests(token) {
  const res = await fetch(`${API_URL}/api/follow-requests`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Failed to load follow requests')
  return res.json()
}

export async function acceptFollowRequest(token, requesterId) {
  const res = await fetch(`${API_URL}/api/follow-requests/${requesterId}/accept`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to accept request')
  return res.json()
}

export async function declineFollowRequest(token, requesterId) {
  const res = await fetch(`${API_URL}/api/follow-requests/${requesterId}/decline`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to decline request')
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

export async function vouchForRun(runId, token) {
  const res = await fetch(`${API_URL}/api/runs/${runId}/vouch`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || 'Failed to vouch')
  }
  return res.json()
}

export async function unvouchForRun(runId, token) {
  const res = await fetch(`${API_URL}/api/runs/${runId}/vouch`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to unvouch')
  return res.json()
}

export async function likePost(postId, token) {
  const res = await fetch(`${API_URL}/api/posts/${postId}/like`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || 'Failed to like')
  }
  return res.json()
}

export async function unlikePost(postId, token) {
  const res = await fetch(`${API_URL}/api/posts/${postId}/like`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to unlike')
  return res.json()
}
