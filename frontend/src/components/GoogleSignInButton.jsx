import { useEffect, useRef } from 'react'
import { useAuth } from '../auth.jsx'
import { googleLogin } from '../api.js'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function GoogleSignInButton() {
  const { login } = useAuth()
  const buttonRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function handleCredential(response) {
      try {
        const data = await googleLogin(response.credential)
        login(data.token, data.user)
      } catch (err) {
        console.error('Google sign-in failed', err)
      }
    }

    function init() {
      if (cancelled || !buttonRef.current) return
      if (!window.google?.accounts?.id) {
        setTimeout(init, 100)
        return
      }
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential })
      window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'medium' })
    }
    init()

    return () => {
      cancelled = true
    }
  }, [login])

  if (!CLIENT_ID) {
    return <span className="nav-google-btn nav-google-btn--disabled">Sign-in not configured</span>
  }

  return <div className="nav-google-btn" ref={buttonRef} />
}
