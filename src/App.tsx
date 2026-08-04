import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import ProfileSetup from './pages/ProfileSetup'
import MyTasks from './pages/MyTasks'
import Team from './pages/Team'
import Weekly from './pages/Weekly'
import Report from './pages/Report'
import Incidents from './pages/Incidents'
import Monthly from './pages/Monthly'
import Daily from './pages/Daily'
import { useAuth } from './hooks/useAuth'

function Guard({ children }: { children: React.ReactNode }) {
  const { userId, profile, loading } = useAuth()
  if (loading) return <div className="p-10 text-sm text-slate-400">불러오는 중…</div>
  if (!userId) return <Navigate to="/login" replace />
  if (!profile) return <ProfileSetup />
  return <>{children}</>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <Guard>
              <Layout />
            </Guard>
          }
        >
          <Route path="/" element={<MyTasks />} />
          <Route path="/team" element={<Team />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/weekly" element={<Weekly />} />
          <Route path="/monthly" element={<Monthly />} />
          <Route path="/report" element={<Report />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
