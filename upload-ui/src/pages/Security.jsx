import { useState } from 'react'
import { Shield, Lock, Clock, AlertTriangle, CheckCircle, XCircle, Trash2, RefreshCw } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useUploadStore } from '../store/uploadStore'

const CONTROLS = [
  {
    icon: Lock, color: 'text-jade', bg: 'bg-jade/10 border-jade/20',
    title: 'SSE-KMS encryption',
    desc: 'All parts encrypted at rest via CMK. Enforced by bucket policy — unencrypted PUTs are denied.',
    status: 'active',
  },
  {
    icon: Clock, color: 'text-azure', bg: 'bg-azure/10 border-azure/20',
    title: '15-minute URL TTL',
    desc: 'Presigned URLs expire after 900 s. A refresh endpoint re-generates URLs for stalled parts.',
    status: 'active',
  },
  {
    icon: Shield, color: 'text-jade', bg: 'bg-jade/10 border-jade/20',
    title: 'Prefix restriction',
    desc: 'IAM policy restricts PUTs to multipart/* prefix only. Cross-prefix writes are denied.',
    status: 'active',
  },
  {
    icon: AlertTriangle, color: 'text-amber', bg: 'bg-amber/10 border-amber/20',
    title: 'Virus scan hook',
    desc: 'Lambda triggered on CompleteMultipartUpload. File quarantined until ClamAV scan passes.',
    status: 'warning',
  },
  {
    icon: Shield, color: 'text-jade', bg: 'bg-jade/10 border-jade/20',
    title: 'Block all public access',
    desc: 'All 4 S3 public-access flags enabled. No bucket ACLs. BucketOwnerEnforced ownership.',
    status: 'active',
  },
  {
    icon: Lock, color: 'text-jade', bg: 'bg-jade/10 border-jade/20',
    title: 'TLS enforced (aws:SecureTransport)',
    desc: 'Bucket policy denies all S3 requests not made over HTTPS. TLS 1.2+ required.',
    status: 'active',
  },
]

const CHECKLIST = [
  { label: 'File size ≤ 10 GB',               status: 'pass' },
  { label: 'Content-type in allowlist',         status: 'pass' },
  { label: 'Partner JWT / API key validated',   status: 'pass' },
  { label: 'Part count ≤ 10 000 (S3 limit)',    status: 'pass' },
  { label: 'Filename sanitised (no traversal)', status: 'pass' },
  { label: 'SHA-256 checksum',                  status: 'warn' },
  { label: 'Virus scan completed',              status: 'pending' },
]

export default function Security() {
  const { token, apiBase } = useUploadStore()
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState(null)

  async function triggerCleanup() {
    setCleaning(true)
    try {
      const res = await axios.post(`${apiBase}/uploads/cleanup`, {}, {
        headers: token.startsWith('ey')
          ? { Authorization: `Bearer ${token}` }
          : { 'X-API-Key': token },
      })
      setCleanResult(res.data)
      toast.success(`Cleanup done — ${res.data.aborted} stale uploads aborted`)
    } catch {
      toast.error('Cleanup failed — check API connection')
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-5 animate-fade-up">

      {/* Controls grid */}
      <div>
        <p className="label mb-3">Active security controls</p>
        <div className="grid grid-cols-2 gap-3">
          {CONTROLS.map(({ icon: Icon, color, bg, title, desc, status }) => (
            <div key={title} className="card p-4 flex gap-3">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon size={15} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-ink-100">{title}</p>
                  {status === 'active'  && <span className="badge badge-jade text-[10px]">active</span>}
                  {status === 'warning' && <span className="badge badge-amber text-[10px]">warning</span>}
                </div>
                <p className="text-[12px] text-ink-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Checklist */}
        <div className="card p-4">
          <p className="label mb-3">Pre-upload checklist</p>
          <div className="flex flex-col gap-0">
            {CHECKLIST.map(({ label, status }) => (
              <div key={label} className="flex items-center gap-3 py-2.5 border-b border-ink-700 last:border-0">
                {status === 'pass' && <CheckCircle size={14} className="text-jade flex-shrink-0" />}
                {status === 'warn' && (
                  <div className="w-3.5 h-3.5 rounded-full bg-amber/20 border border-amber/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] text-amber font-bold">!</span>
                  </div>
                )}
                {status === 'pending' && (
                  <div className="w-3.5 h-3.5 rounded-full border border-ink-500 flex-shrink-0" />
                )}
                <span className={`text-[13px] ${status === 'pending' ? 'text-ink-500' : 'text-ink-200'}`}>
                  {label}
                </span>
                {status === 'warn'    && <span className="ml-auto badge badge-amber text-[10px]">optional</span>}
                {status === 'pending' && <span className="ml-auto badge badge-muted text-[10px]">pending</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Cleanup status */}
        <div className="flex flex-col gap-3">
          <div className="card p-4">
            <p className="label mb-3">Cleanup status</p>
            <div className="flex flex-col gap-0">
              {[
                { label: 'Lifecycle rule',      val: 'AbortIncomplete after 1 day',    ok: true  },
                { label: 'EventBridge schedule', val: 'Daily 03:00 UTC',               ok: true  },
                { label: 'Last cleanup run',    val: cleanResult ? `${cleanResult.aborted} aborted` : 'Not yet run', ok: !!cleanResult },
                { label: 'Public access',       val: 'All blocked',                    ok: true  },
                { label: 'TLS enforcement',     val: 'aws:SecureTransport enforced',   ok: true  },
              ].map(({ label, val, ok }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-ink-700 last:border-0">
                  <span className="text-[12px] text-ink-400">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono text-ink-200">{val}</span>
                    {ok
                      ? <CheckCircle size={12} className="text-jade" />
                      : <XCircle    size={12} className="text-ink-600" />
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={triggerCleanup}
            disabled={cleaning}
            className="btn w-full justify-center py-3"
          >
            {cleaning
              ? <><RefreshCw size={13} className="animate-spin" /> Running cleanup…</>
              : <><Trash2 size={13} /> Run stale upload cleanup</>
            }
          </button>

          {cleanResult && (
            <div className="card-inner p-3 flex gap-4 text-center">
              {[
                { label: 'Found',   val: cleanResult.stale_found, color: 'text-amber' },
                { label: 'Aborted', val: cleanResult.aborted,     color: 'text-jade'  },
                { label: 'Errors',  val: cleanResult.errors,      color: cleanResult.errors > 0 ? 'text-danger' : 'text-ink-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex-1">
                  <p className={`text-xl font-display font-bold ${color}`}>{val}</p>
                  <p className="text-[10px] font-mono text-ink-400">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


