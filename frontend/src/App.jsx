import { Routes, Route, Link, NavLink } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import GoogleSignInButton from './components/GoogleSignInButton.jsx'
import UploadPage from './pages/UploadPage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'

export default function App() {
  const { user, loading, logout } = useAuth()

  return (
    <>
      <div className="topbar">
        <Link to="/" className="wordmark">average<span>pace</span></Link>
        <nav className="nav">
          <NavLink to="/" end>Submit a run</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          {!loading && user && <NavLink to="/profile">Profile</NavLink>}
          {!loading && user && (
            <button type="button" className="link-button" onClick={logout}>
              Sign out
            </button>
          )}
          {!loading && !user && <GoogleSignInButton />}
        </nav>
      </div>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </>
  )
}
