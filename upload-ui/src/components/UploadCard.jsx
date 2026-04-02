import { motion } from 'framer-motion'
import { X, RefreshCw, CheckCircle, AlertTriangle, FileArchive } from 'lucide-react'
import { formatBytes, abortUpload } from '../services/api'
import { useUploadStore } from '../store/uploadStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function StatusBadge({ status }) {
  const map = {
    uploading:  { cls: 'badge-azure',  label: 'Uploading' },
    completing: { cls: 'badge-amber',  label: 'Completing' },
    completed:  { cls: 'badge-jade',   label: 'Completed' },
    failed:     { cls: 'badge-danger', label: 'Failed' },
    aborted:    { cls: 'badge-muted',  label: 'Aborted' },
  }
  const { cls, label } = map[status] || map.aborted
  return <span className={`badge ${cls}`}>{label}</span>
}

function CircularProgress({ pct }) {
  const r = 26, c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#1f2d3d" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={pct === 100 ? '#7fffb2' : '#00d4ff'}
          strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-semibold text-ink-100">
        {Math.round(pct)}%
      </span>
    </div>
  )
}

function PartBar({ part }) {
  const colors = {
    done:   'bg-jade',
    active: 'bg-azure animate-pulse',
    retry:  'bg-amber',
    failed: 'bg-danger',
    queued: 'bg-ink-600',
  }
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono py-1.5 border-b border-ink-600 last:border-0">
      <div className={clsx(
        'w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-semibold flex-shrink-0',
        part.status === 'done'  && 'bg-jade/15 text-jade',
        part.status === 'active'&& 'bg-azure/15 text-azure',
        part.status === 'retry' && 'bg-amber/15 text-amber',
        part.status === 'failed'&& 'bg-danger/15 text-danger',
        part.status === 'queued'&& 'bg-ink-700 text-ink-400',
      )}>
        {part.status === 'done' ? '✓' : part.number}
      </div>
      <div className="flex-1 h-1 bg-ink-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-300', colors[part.status])}
          style={{ width: `${part.progress}%` }}
        />
      </div>
      <span className={clsx(
        'w-14 text-right',
        part.status === 'done'   && 'text-jade',
        part.status === 'active' && 'text-azure',
        part.status === 'retry'  && 'text-amber',
        part.status === 'failed' && 'text-danger',
        part.status === 'queued' && 'text-ink-500',
      )}>
        {part.status === 'done'   ? 'done'
         : part.status === 'active'? `${Math.round(part.progress)}%`
         : part.status === 'retry' ? `retry ${part.retries}`
         : part.status === 'failed'? 'failed'
         : 'queued'}
      </span>
    </div>
  )
}

export default function UploadCard({ upload, expanded, onToggle }) {
  const { token, apiBase, updateUpload, removeUpload } = useUploadStore()

  const pct = upload.partCount > 0
    ? Math.round((upload.doneParts / upload.partCount) * 100)
    : 0

  async function handleAbort() {
    try {
      await abortUpload({ uploadId: upload.uploadId, token, apiBase })
      updateUpload(upload.uploadId, { status: 'aborted' })
      toast('Upload aborted')
    } catch {
      toast.error('Failed to abort upload')
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card overflow-hidden"
    >
      {/* Header row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-ink-700/30 transition-colors"
        onClick={onToggle}
      >
        <div className="w-9 h-9 rounded-xl bg-ink-700 border border-ink-600 flex items-center justify-center flex-shrink-0">
          <FileArchive size={16} className="text-ink-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink-50 truncate">{upload.filename}</p>
          <p className="text-[11px] font-mono text-ink-400 mt-0.5">
            {formatBytes(upload.fileSize)} · {upload.partCount} parts · {upload.partnerId}
          </p>
        </div>
        <CircularProgress pct={pct} />
        <StatusBadge status={upload.status} />
        {upload.status === 'uploading' && (
          <button onClick={(e) => { e.stopPropagation(); handleAbort() }} className="btn btn-danger p-2">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Speed / ETA bar */}
      {upload.status === 'uploading' && (
        <div className="px-4 pb-3 flex items-center justify-between text-[11px] font-mono text-ink-400">
          <span>{upload.speed || '—'}</span>
          <div className="flex-1 mx-4 h-0.5 bg-ink-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-azure/50 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span>{upload.eta || '—'}</span>
        </div>
      )}

      {/* Stats row */}
      <div className="px-4 pb-3 grid grid-cols-4 gap-2">
        {[
          { label: 'Done',     val: upload.doneParts,                   color: 'text-jade'   },
          { label: 'Active',   val: upload.activeParts,                 color: 'text-azure'  },
          { label: 'Retrying', val: upload.retryParts,                  color: 'text-amber'  },
          { label: 'Total',    val: upload.partCount,                   color: 'text-ink-200'},
        ].map(({ label, val, color }) => (
          <div key={label} className="card-inner p-2.5 text-center">
            <p className={`text-base font-display font-bold ${color}`}>{val ?? 0}</p>
            <p className="text-[10px] font-mono text-ink-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Expanded part detail */}
      {expanded && upload.parts && (
        <motion.div
          initial={{ height: 0 }} animate={{ height: 'auto' }}
          className="overflow-hidden border-t border-ink-600"
        >
          <div className="p-4">
            <p className="label mb-3">Part detail</p>
            <div className="max-h-48 overflow-y-auto pr-1">
              {upload.parts.slice(0, 20).map((p) => (
                <PartBar key={p.number} part={p} />
              ))}
              {upload.parts.length > 20 && (
                <p className="text-[11px] font-mono text-ink-400 pt-2 text-center">
                  + {upload.parts.length - 20} more parts
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Error message */}
      {upload.error && (
        <div className="mx-4 mb-4 flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-xl">
          <AlertTriangle size={13} className="text-danger mt-0.5 flex-shrink-0" />
          <p className="text-[11px] font-mono text-danger">{upload.error}</p>
        </div>
      )}

      {/* Completed checkmark */}
      {upload.status === 'completed' && (
        <div className="mx-4 mb-4 flex items-center gap-2 p-3 bg-jade/5 border border-jade/20 rounded-xl">
          <CheckCircle size={13} className="text-jade" />
          <p className="text-[11px] font-mono text-jade">
            Assembled in S3 · {upload.fileKey || ''}
          </p>
        </div>
      )}
    </motion.div>
  )
}
