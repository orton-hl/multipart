import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'
import { useUploadStore } from '../store/uploadStore'
import UploadCard from '../components/UploadCard'

export default function ActiveUploads() {
  const uploads = useUploadStore((s) => s.uploads)
  const active  = uploads.filter((u) => ['uploading', 'completing'].includes(u.status))
  const [expanded, setExpanded] = useState(null)

  if (!active.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 h-80 text-center animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-ink-800 border border-ink-600 flex items-center justify-center">
          <Activity size={22} className="text-ink-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink-300">No active uploads</p>
          <p className="text-xs font-mono text-ink-500 mt-1">Start an upload from the New upload page</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="label">{active.length} upload{active.length > 1 ? 's' : ''} in progress</p>
      </div>
      <AnimatePresence>
        {active.map((u) => (
          <UploadCard
            key={u.uploadId}
            upload={u}
            expanded={expanded === u.uploadId}
            onToggle={() => setExpanded(expanded === u.uploadId ? null : u.uploadId)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
