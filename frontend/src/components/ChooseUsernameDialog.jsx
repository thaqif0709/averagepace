import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import { setUsername as saveUsername } from '../api.js'
import { useUsernameStatus, isUsernameStatusSubmittable } from '../useUsernameStatus.js'
import UsernameStatusMessage from './UsernameStatusMessage.jsx'

export default function ChooseUsernameDialog() {
  const { token, updateUser } = useAuth()
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const status = useUsernameStatus(value, token)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isUsernameStatusSubmittable(status)) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await saveUsername(token, value.trim())
      updateUser({ username: updated.username })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <p className="eyebrow">One quick thing</p>
        <h2>Pick a username</h2>
        <p className="lede">
          This is how other runners will find you. Pick something short and
          memorable — you can always change it later from your profile.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            placeholder="e.g. thaqif_runs"
            maxLength={20}
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <UsernameStatusMessage status={status} />

          {error && <div className="banner err">{error}</div>}

          <button type="submit" disabled={!isUsernameStatusSubmittable(status) || submitting}>
            {submitting ? 'Saving…' : 'Save username'}
          </button>
        </form>
      </div>
    </div>
  )
}
