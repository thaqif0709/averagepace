const HINT = '3-20 characters: letters, numbers, and underscores only'

export default function UsernameStatusMessage({ status }) {
  if (status === 'checking') return <p className="username-status">Checking…</p>
  if (status === 'available') return <p className="username-status username-status-ok">Available</p>
  if (status === 'unchanged') return <p className="username-status">This is your current username</p>
  if (status === 'taken') return <p className="username-status username-status-bad">That username is taken</p>
  return <p className="username-status">{HINT}</p>
}
