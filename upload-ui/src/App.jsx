import { Routes, Route } from 'react-router-dom'
import Sidebar    from './components/Sidebar'
import Topbar     from './components/Topbar'
import NewUpload  from './pages/NewUpload'
import ActiveUploads from './pages/ActiveUploads'
import History    from './pages/History'
import Security   from './pages/Security'
import Settings   from './pages/Settings'

export default function App() {
  return (
    <div className="flex h-screen bg-ink-950 text-ink-50 font-body overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"         element={<NewUpload />} />
            <Route path="/active"   element={<ActiveUploads />} />
            <Route path="/history"  element={<History />} />
            <Route path="/security" element={<Security />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
