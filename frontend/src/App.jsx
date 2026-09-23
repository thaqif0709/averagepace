import { Routes, Route, Link, NavLink } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import GoogleSignInButton from './components/GoogleSignInButton.jsx'
import HomePage from './pages/HomePage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'
import ProfilePage, { ProfileRedirect } from './pages/ProfilePage.jsx'
import FollowListPage from './pages/FollowListPage.jsx'

export default function App() {
  const { user, loading, logout } = useAuth()

  return (
    <>
      <div className="topbar">
        <Link to="/" className="wordmark">average<span>pace</span></Link>
        <nav className="nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/submit">Submit a run</NavLink>
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
        <Route path="/" element={<HomePage />} />
        <Route path="/submit" element={<UploadPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<ProfileRedirect />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/profile/:userId/followers" element={<FollowListPage mode="followers" />} />
        <Route path="/profile/:userId/following" element={<FollowListPage mode="following" />} />
      </Routes>
    </>
  )
}
