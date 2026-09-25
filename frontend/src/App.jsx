import { useEffect, useState } from 'react'
import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import GoogleSignInButton from './components/GoogleSignInButton.jsx'
import HomePage from './pages/HomePage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'
import ProfilePage, { ProfileRedirect } from './pages/ProfilePage.jsx'
import FollowListPage from './pages/FollowListPage.jsx'
import BestEffortDetailPage from './pages/BestEffortDetailPage.jsx'
import AdminReviewPage from './pages/AdminReviewPage.jsx'
import ChooseUsernameDialog from './components/ChooseUsernameDialog.jsx'
import SearchWidget from './components/SearchWidget.jsx'
import { trackPageView } from './analytics.js'

export default function App() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    trackPageView(location.pathname + location.search)
  }, [location.pathname, location.search])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <>
      <div className="topbar">
        <Link to="/" className="wordmark">Average<span>Pace</span></Link>
        <div className="topbar-actions">
          <SearchWidget />
          <nav className="nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/submit">Submit a run</NavLink>
            <NavLink to="/leaderboard">Leaderboard</NavLink>
            {!loading && user && <NavLink to="/profile">Profile</NavLink>}
            {!loading && user?.is_admin && <NavLink to="/admin">Admin</NavLink>}
            {!loading && user && (
              <button type="button" className="link-button" onClick={logout}>
                Sign out
              </button>
            )}
            {!loading && !user && <GoogleSignInButton />}
          </nav>
          <button
            type="button"
            className={`nav-toggle ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span className="nav-toggle-bars">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>

        <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
          <NavLink to="/submit" onClick={closeMenu}>Submit a run</NavLink>
          <NavLink to="/leaderboard" onClick={closeMenu}>Leaderboard</NavLink>
          {!loading && user && <NavLink to="/profile" onClick={closeMenu}>Profile</NavLink>}
          {!loading && user?.is_admin && <NavLink to="/admin" onClick={closeMenu}>Admin</NavLink>}
          <div className="mobile-menu-divider" />
          {!loading && user && (
            <button type="button" className="link-button" onClick={() => { closeMenu(); logout() }}>
              Sign out
            </button>
          )}
          {!loading && !user && <GoogleSignInButton />}
        </div>
      </div>

      <div className={`mobile-menu-backdrop ${menuOpen ? 'open' : ''}`} onClick={closeMenu} />

      {!loading && user && !user.username && <ChooseUsernameDialog />}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/submit" element={<UploadPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<ProfileRedirect />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/profile/:username/best/:distanceBucket" element={<BestEffortDetailPage />} />
        <Route path="/profile/:username/followers" element={<FollowListPage mode="followers" />} />
        <Route path="/profile/:username/following" element={<FollowListPage mode="following" />} />
        <Route path="/admin" element={<AdminReviewPage />} />
      </Routes>
    </>
  )
}
