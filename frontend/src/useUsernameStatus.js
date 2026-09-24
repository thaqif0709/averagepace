import { useEffect, useState } from 'react'
import { checkUsername } from './api.js'

// Debounced live-availability check, shared by the mandatory choose-username
// dialog and the editable username field on a user's own profile.
// currentUsername (optional) lets a profile edit recognize "unchanged" -
// re-submitting your own existing username shouldn't read as "taken".
export function useUsernameStatus(value, token, currentUsername) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const trimmed = value.trim()
    if (!trimmed) {
      setStatus(null)
      return
    }
    if (currentUsername && trimmed.toLowerCase() === currentUsername.toLowerCase()) {
      setStatus('unchanged')
      return
    }
    let cancelled = false
    setStatus('checking')
    const timer = setTimeout(() => {
      checkUsername(trimmed, token)
        .then((data) => {
          if (cancelled) return
          if (data.available) setStatus('available')
          else setStatus(data.reason === 'taken' ? 'taken' : 'invalid')
        })
        .catch(() => {
          if (!cancelled) setStatus(null)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, token, currentUsername])

  return status
}

export function isUsernameStatusSubmittable(status) {
  return status === 'available' || status === 'unchanged'
}
