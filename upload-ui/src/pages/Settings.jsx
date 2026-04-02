import { useState } from 'react'
import { Save, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { useUploadStore } from '../store/uploadStore'
import toast from 'react-hot-toast'
import axios from 'axios'

export default function Settings() {
  const { token, setToken, apiBase } = useUploadStore()
  const [localToken, setLocalToken] = useState(token)
  const [showToken, setShowToken]   = useState(false)
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState(null)

  function save() {
    setToken(localToken)
    toast.success('Settings saved')
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await axios.get(`${apiBase}/health`)
      setTestResult({ ok: true, msg: `API v${res.data.version} — online` })
    } catch {
      setTestResult({ ok: false, msg: 'Cannot reach API — check URL and network' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-6 max-w-xl flex flex-col gap-5 animate-fade-up">

      <div className="card p-5 flex flex-col gap-4">
        <p className="text-sm font-medium text-ink-100">API connection</p>

        <div>
          <label className="label">API base URL</label>
          <input className="input" value={apiBase || 'http://localhost:8000'} readOnly />
          <p className="text-[11px] font-mono text-ink-500 mt-1.5">
            Configure via VITE_API_BASE env var
          </p>
        </div>

        <div>
          <label className="label">Auth token / API key</label>
          <div className="relative">
            <input
              className="input pr-10"
              type={showToken ? 'text' : 'password'}
              value={localToken}
              onChange={(e) => setLocalToken(e.target.value)}
              placeholder="Bearer eyJ… or devkey-1"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200"
            >
              {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <p className="text-[11px] font-mono text-ink-500 mt-1.5">
            JWT (Bearer eyJ…) or static API key (devkey-1, devkey-2)
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={testConnection} disabled={testing} className="btn flex-1 justify-center">
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button onClick={save} className="btn btn-primary flex-1 justify-center">
            <Save size={13} /> Save
          </button>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-xl border text-[12px] font-mono
            ${testResult.ok
              ? 'bg-jade/5 border-jade/20 text-jade'
              : 'bg-danger/5 border-danger/20 text-danger'}`}>
            <CheckCircle size={13} />
            {testResult.msg}
          </div>
        )}
      </div>

      <div className="card p-5 flex flex-col gap-3">
        <p className="text-sm font-medium text-ink-100">Upload defaults</p>
        <div className="flex flex-col gap-0">
          {[
            ['Default part size',    '5 MB'],
            ['Default concurrency',  '4 parts'],
            ['Default encryption',   'SSE-KMS'],
            ['Max file size',        '10 GB'],
            ['Presigned URL TTL',    '15 minutes'],
            ['Stale upload cutoff',  '24 hours'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between py-2.5 border-b border-ink-700 last:border-0 text-[13px]">
              <span className="text-ink-400">{label}</span>
              <span className="font-mono text-ink-200">{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <p className="text-sm font-medium text-ink-100 mb-3">About</p>
        <div className="flex flex-col gap-0">
          {[
            ['Sprint',     'DIS Sprint 2.2 2026'],
            ['Epic',       'DIS Q2 2026 — Platform Expansion'],
            ['Labels',     'Architecture · S3'],
            ['Status',     'UNCOVERED'],
            ['Priority',   'Minor'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between py-2 border-b border-ink-700 last:border-0 text-[12px]">
              <span className="font-mono text-ink-500">{label}</span>
              <span className="font-mono text-ink-300">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
