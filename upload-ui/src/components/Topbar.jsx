import { useLocation } from 'react-router-dom'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useUploadStore } from '../store/uploadStore'

const titles = {
  '/':         { title: 'New upload',  sub: 'Direct-to-S3 via presigned multipart' },
  '/active':   { title: 'Active uploads', sub: 'Monitor in-progress transfers' },
  '/history':  { title: 'Upload history', sub: 'Completed and failed sessions' },
  '/security': { title: 'Security & compliance', sub: 'Controls, checklist, cleanup status' },
  '/settings': { title: 'Settings',     sub: 'API endpoint, credentials, preferences' },
}

export default function Topbar() {
  const { pathname } = useLocation()
  const meta = titles[pathname] || { title: pathname, sub: '' }
  const [health, setHealth] = useState(null)
  const apiBase = useUploadStore((s) => s.apiBase)

  useEffect(() => {
    axios.get(`${apiBase}/health`).then(() => setHealth(true)).catch(() => setHealth(false))
  }, [apiBase])

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-ink-600 bg-ink-900/80 backdrop-blur-sm flex-shrink-0">
      <div>
        <h1 className="text-sm font-display font-bold text-ink-50">{meta.title}</h1>
        <p className="text-[11px] text-ink-400 font-mono">{meta.sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {health === null ? (
            <div className="w-2 h-2 rounded-full bg-ink-500 animate-pulse" />
          ) : health ? (
            <CheckCircle size={13} className="text-jade" />
          ) : (
            <AlertCircle size={13} className="text-danger" />
          )}
          <span className="text-[11px] font-mono text-ink-400">
            {health === null ? 'checking...' : health ? 'API online' : 'API offline'}
          </span>
        </div>
        <div className="w-px h-4 bg-ink-600" />
        <span className="badge badge-muted">Q2 2026</span>
        <span className="badge badge-muted">UNCOVERED</span>
      </div>
    </header>
  )
}
