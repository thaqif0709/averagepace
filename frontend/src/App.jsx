import { Routes, Route, Link, NavLink } from 'react-router-dom'
import UploadPage from './pages/UploadPage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'

export default function App() {
  return (
    <>
      <div className="topbar">
        <Link to="/" className="wordmark">average<span>pace</span></Link>
        <nav className="nav">
          <NavLink to="/" end>Submit a run</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
        </nav>
      </div>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </>
  )
}
