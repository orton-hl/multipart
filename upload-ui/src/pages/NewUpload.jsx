import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, File, X, ChevronRight, Lock, Zap, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useUploadStore } from '../store/uploadStore'
import {
  initiateUpload, runMultipartUpload, completeUpload,
  calcPartCount, formatBytes,
} from '../services/api'

const ALLOWED_TYPES = [
  'application/zip', 'application/octet-stream', 'application/gzip',
  'text/csv', 'application/json',
]

const ENCRYPTIONS = [
  { value: 'SSE-KMS', label: 'SSE-KMS', sub: 'Recommended · Customer-managed key' },
  { value: 'SSE-S3',  label: 'SSE-S3',  sub: 'AWS-managed key' },
]

export default function NewUpload() {
  const navigate = useNavigate()
  const { token, apiBase, addUpload, updateUpload } = useUploadStore()

  const [files, setFiles]         = useState([])
  const [partnerId, setPartnerId] = useState('partner-42')
  const [encryption, setEncryption] = useState('SSE-KMS')
  const [partSizeMB, setPartSizeMB] = useState(5)
  const [concurrency, setConcurrency] = useState(4)
  const [uploading, setUploading] = useState(false)
  const [abortControllers, setAbortControllers] = useState({})

  const onDrop = useCallback((accepted) => {
    setFiles((prev) => [
      ...prev,
      ...accepted.filter((f) => !prev.find((p) => p.name === f.name)),
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'], 'application/octet-stream': ['.*'],
              'application/gzip': ['.gz'], 'text/csv': ['.csv'], 'application/json': ['.json'] },
    maxSize: 10 * 1024 ** 3,
  })

  function removeFile(name) { setFiles((f) => f.filter((x) => x.name !== name)) }

  async function startUpload() {
    if (!files.length) return toast.error('Add at least one file')
    setUploading(true)

    for (const file of files) {
      const partCount = calcPartCount(file.size, partSizeMB)
      const abortCtrl = new AbortController()

      try {
        // 1. Initiate
        const session = await initiateUpload({
          file, partCount, encryption, partnerId, token, apiBase,
        })

        // Build initial parts state
        const parts = Array.from({ length: partCount }, (_, i) => ({
          number: i + 1, status: 'queued', progress: 0, retries: 0,
        }))

        const uploadEntry = {
          uploadId:    session.upload_id,
          s3UploadId:  session.s3_upload_id,
          filename:    file.name,
          fileSize:    file.size,
          fileKey:     session.key,
          partCount,
          doneParts:   0,
          activeParts: 0,
          retryParts:  0,
          status:      'uploading',
          parts,
          partnerId,
          encryption,
          startedAt:   new Date().toISOString(),
          speed:       '—',
          eta:         '—',
        }
        addUpload(uploadEntry)
        setAbortControllers((p) => ({ ...p, [session.upload_id]: abortCtrl }))

        const startTime = Date.now()
        let bytesUploaded = 0

        // 2. Upload parts
        const etags = await runMultipartUpload({
          file,
          session,
          concurrency,
          signal: abortCtrl.signal,
          onPartProgress: (partNumber, fraction) => {
            updateUpload(session.upload_id, (prev) => {
              const newParts = prev.parts.map((p) =>
                p.number === partNumber
                  ? { ...p, status: 'active', progress: fraction * 100 }
                  : p
              )
              return { parts: newParts, activeParts: newParts.filter((p) => p.status === 'active').length }
            })
          },
          onPartDone: (partNumber) => {
            bytesUploaded += partSizeMB * 1024 * 1024
            const elapsed = (Date.now() - startTime) / 1000
            const speedBps = bytesUploaded / elapsed
            const remaining = file.size - bytesUploaded
            const etaSec = remaining / speedBps

            updateUpload(session.upload_id, (prev) => {
              const newParts = prev.parts.map((p) =>
                p.number === partNumber ? { ...p, status: 'done', progress: 100 } : p
              )
              return {
                parts:       newParts,
                doneParts:   newParts.filter((p) => p.status === 'done').length,
                activeParts: newParts.filter((p) => p.status === 'active').length,
                speed:       `${formatBytes(speedBps)}/s`,
                eta:         etaSec < 3600
                  ? `~${Math.ceil(etaSec / 60)} min`
                  : `~${(etaSec / 3600).toFixed(1)} hr`,
              }
            })
          },
        })

        // 3. Complete
        updateUpload(session.upload_id, { status: 'completing' })
        const result = await completeUpload({
          uploadId: session.upload_id,
          parts: etags,
          token, apiBase,
        })

        updateUpload(session.upload_id, {
          status:      'completed',
          fileKey:     result.file_key,
          completedAt: result.completed_at,
        })
        toast.success(`${file.name} uploaded successfully`)

      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          toast('Upload cancelled')
        } else {
          const msg = err?.response?.data?.detail?.message || err.message || 'Upload failed'
          toast.error(msg)
          updateUpload(err?.uploadId || '', { status: 'failed', error: msg })
        }
      }
    }

    setUploading(false)
    setFiles([])
    navigate('/active')
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0)
  const totalParts = files.reduce((s, f) => s + calcPartCount(f.size, partSizeMB), 0)

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-5 animate-fade-up">

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {['Configure', 'Presign', 'Upload parts', 'Complete'].map((step, i) => (
          <div key={step} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className={clsx(
              'flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-mono font-semibold flex-shrink-0',
              i === 0 ? 'bg-azure/20 text-azure border border-azure/40' : 'bg-ink-700 text-ink-400 border border-ink-600'
            )}>
              {i + 1}
            </div>
            {i < 3 && <div className={clsx('flex-1 h-px mx-1', i === 0 ? 'bg-azure/30' : 'bg-ink-700')} />}
            <span className={clsx(
              'text-[11px] font-mono ml-1.5 mr-2',
              i === 0 ? 'text-azure' : 'text-ink-500'
            )}>{step}</span>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer',
          isDragActive
            ? 'border-azure bg-azure/5'
            : 'border-ink-600 hover:border-ink-400 hover:bg-ink-800/50'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={clsx(
            'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
            isDragActive ? 'bg-azure/15 border border-azure/30' : 'bg-ink-700 border border-ink-600'
          )}>
            <Upload size={22} className={isDragActive ? 'text-azure' : 'text-ink-400'} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink-100">
              {isDragActive ? 'Drop files here' : 'Drop files or click to browse'}
            </p>
            <p className="text-xs text-ink-400 font-mono mt-1">
              Max 10 GB · ZIP, CSV, JSON, GZ, BIN
            </p>
          </div>
        </div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-col gap-2">
            {files.map((file) => (
              <motion.div
                key={file.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="card-inner flex items-center gap-3 px-4 py-3"
              >
                <File size={14} className="text-ink-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-ink-100 truncate">{file.name}</span>
                <span className="text-[11px] font-mono text-ink-400">{formatBytes(file.size)}</span>
                <span className="text-[11px] font-mono text-ink-500">
                  {calcPartCount(file.size, partSizeMB)} parts
                </span>
                <button onClick={() => removeFile(file.name)} className="text-ink-500 hover:text-danger transition-colors ml-1">
                  <X size={13} />
                </button>
              </motion.div>
            ))}
            <div className="flex justify-between text-[11px] font-mono text-ink-400 px-1">
              <span>{files.length} file{files.length > 1 ? 's' : ''} · {formatBytes(totalSize)} total</span>
              <span>{totalParts} parts total</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Partner ID</label>
          <input
            className="input"
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            placeholder="partner-42"
          />
        </div>
        <div>
          <label className="label">Encryption</label>
          <select className="select" value={encryption} onChange={(e) => setEncryption(e.target.value)}>
            {ENCRYPTIONS.map((e) => (
              <option key={e.value} value={e.value}>{e.label} — {e.sub}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Part size — {partSizeMB} MB</label>
          <input
            type="range" min="5" max="100" step="5" value={partSizeMB}
            onChange={(e) => setPartSizeMB(Number(e.target.value))}
            className="w-full accent-azure mt-1"
          />
          <div className="flex justify-between text-[10px] font-mono text-ink-500 mt-1">
            <span>5 MB</span><span>100 MB</span>
          </div>
        </div>
        <div>
          <label className="label">Concurrency — {concurrency} parts</label>
          <input
            type="range" min="1" max="10" step="1" value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="w-full accent-azure mt-1"
          />
          <div className="flex justify-between text-[10px] font-mono text-ink-500 mt-1">
            <span>1</span><span>10</span>
          </div>
        </div>
      </div>

      {/* Info callout */}
      <div className="flex items-start gap-3 p-4 bg-azure/5 border border-azure/15 rounded-xl">
        <Zap size={13} className="text-azure mt-0.5 flex-shrink-0" />
        <p className="text-[12px] text-ink-300 font-mono leading-relaxed">
          Parts are PUT directly to S3 via presigned URLs — your backend only orchestrates, it never proxies file data.
          S3 stitches the final object when you call <span className="text-azure">CompleteMultipartUpload</span>.
        </p>
      </div>

      {/* Start button */}
      <button
        onClick={startUpload}
        disabled={!files.length || uploading}
        className="btn btn-primary w-full justify-center py-3 text-sm font-semibold"
      >
        {uploading ? (
          <><RefreshCw size={14} className="animate-spin" /> Uploading…</>
        ) : (
          <><Upload size={14} /> Start upload <ChevronRight size={14} className="ml-auto" /></>
        )}
      </button>
    </div>
  )
}


