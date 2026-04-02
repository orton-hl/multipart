import { useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle, XCircle, Clock, Search, FileArchive, Trash2 } from 'lucide-react'
import { useUploadStore } from '../store/uploadStore'
import { formatBytes } from '../services/api'
import clsx from 'clsx'

const STATUS_ICON = {
  completed: <CheckCircle size={14} className="text-jade" />,
  failed:    <XCircle    size={14} className="text-danger" />,
  aborted:   <Clock      size={14} className="text-ink-400" />,
}

const STATUS_BADGE = {
  completed: 'badge-jade',
  failed:    'badge-danger',
  aborted:   'badge-muted',
}

export default function History() {
  const { uploads, removeUpload } = useUploadStore()
  const done = uploads.filter((u) => ['completed', 'failed', 'aborted'].includes(u.status))
  const [query, setQuery] = useState('')

  const filtered = done.filter((u) =>
    u.filename.toLowerCase().includes(query.toLowerCase()) ||
    u.partnerId?.toLowerCase().includes(query.toLowerCase())
  )

  const stats = {
    completed: done.filter((u) => u.status === 'completed').length,
    failed:    done.filter((u) => u.status === 'failed').length,
    totalSize: done.filter((u) => u.status === 'completed').reduce((s, u) => s + u.fileSize, 0),
    successRate: done.length
      ? Math.round((done.filter((u) => u.status === 'completed').length / done.length) * 100)
      : 0,
  }

  return (
    <div className="p-6 flex flex-col gap-5 animate-fade-up">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Completed',    val: stats.completed,                     color: 'text-jade'  },
          { label: 'Failed',       val: stats.failed,                        color: 'text-danger'},
          { label: 'Success rate', val: `${stats.successRate}%`,             color: 'text-azure' },
          { label: 'Total uploaded', val: formatBytes(stats.totalSize),      color: 'text-ink-100'},
        ].map(({ label, val, color }) => (
          <div key={label} className="stat-card">
            <p className={`stat-val ${color}`}>{val}</p>
            <p className="stat-lbl">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          className="input pl-8"
          placeholder="Search by filename or partner ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <FileArchive size={22} className="text-ink-600 mx-auto mb-2" />
            <p className="text-sm text-ink-400 font-mono">No uploads match your search</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-600">
                {['File', 'Size', 'Parts', 'Partner', 'Started', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-mono font-semibold text-ink-400 tracking-widest uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.uploadId} className="border-b border-ink-700 last:border-0 hover:bg-ink-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {STATUS_ICON[u.status]}
                      <span className="font-medium text-ink-100 truncate max-w-[160px]">{u.filename}</span>
                    </div>
                    <p className="text-[10px] font-mono text-ink-500 mt-0.5 pl-5">{u.uploadId}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-300">{formatBytes(u.fileSize)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-300">{u.partCount}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-300">{u.partnerId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-400">
                    {u.startedAt ? format(new Date(u.startedAt), 'MMM d, HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[u.status]}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeUpload(u.uploadId)}
                      className="text-ink-600 hover:text-danger transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
