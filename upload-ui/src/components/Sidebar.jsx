import { NavLink } from 'react-router-dom'
import { Upload, Clock, CheckCircle, Shield, Activity, Settings } from 'lucide-react'
import { useUploadStore } from '../store/uploadStore'
import clsx from 'clsx'

const links = [
  { to: '/',         icon: Upload,      label: 'New upload',  end: true },
  { to: '/active',   icon: Activity,    label: 'Active'               },
  { to: '/history',  icon: CheckCircle, label: 'History'              },
  { to: '/security', icon: Shield,      label: 'Security'             },
  { to: '/settings', icon: Settings,    label: 'Settings'             },
]

export default function Sidebar() {
  const uploads = useUploadStore((s) => s.uploads)
  const active  = uploads.filter((u) => u.status === 'uploading').length

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-ink-900 border-r border-ink-600 h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-ink-600">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-azure/10 border border-azure/30 flex items-center justify-center">
            <Upload size={13} className="text-azure" />
          </div>
          <div>
            <p className="text-xs font-display font-bold text-ink-50 leading-none">Upload Manager</p>
            <p className="text-[10px] text-ink-400 font-mono mt-0.5">DIS Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5">
        {links.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}>
            {({ isActive }) => (
              <div className={clsx('nav-item', isActive && 'active')}>
                <Icon size={15} />
                <span className="flex-1">{label}</span>
                {label === 'Active' && active > 0 && (
                  <span className="badge badge-amber text-[10px] px-1.5 py-0">{active}</span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer stats */}
      <div className="p-3 border-t border-ink-600">
        <div className="bg-ink-800 rounded-xl p-3 border border-ink-600">
          <p className="text-[10px] font-mono text-ink-400 mb-1">Sprint</p>
          <p className="text-xs font-mono text-ink-200">DIS Sprint 2.2 2026</p>
          <div className="mt-2 h-1 bg-ink-600 rounded-full overflow-hidden">
            <div className="h-full w-3/5 bg-azure/60 rounded-full" />
          </div>
          <p className="text-[10px] font-mono text-ink-400 mt-1">60% complete</p>
        </div>
      </div>
    </aside>
  )
}
