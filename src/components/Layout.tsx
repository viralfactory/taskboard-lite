import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { changePassword, signOut } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import ThemeMenu from './ThemeMenu'

const NAV = [
  { to: '/', label: '내 업무', icon: '☑', end: true },
  { to: '/team', label: '팀 현황', icon: '👥', end: false },
  { to: '/incidents', label: '장애 관리', icon: '⚠', end: false },
  { to: '/daily', label: '데일리', icon: '📅', end: false },
  { to: '/weekly', label: '주간보고', icon: '📄', end: false },
  { to: '/monthly', label: '월간보고', icon: '📊', end: false },
  { to: '/report', label: '리포트', icon: '⬇', end: false },
]

// M3 Navigation drawer(넓은 화면) / 상단 탭(좁은 화면)
export default function Layout() {
  const { profile, email } = useAuth()
  const [pwOpen, setPwOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)

  return (
    <div className="min-h-full flex flex-col md:flex-row bg-surface-low">
      <aside className="md:w-60 shrink-0 md:min-h-screen flex md:flex-col md:py-3 md:px-3">
        <div className="hidden md:block px-4 py-4">
          <div className="text-title-lg font-medium text-on-surface">TaskBoard Lite</div>
          <div className="text-body-sm text-on-surface-variant mt-0.5">
            {profile?.name}
            {profile?.part ? ` · ${profile.part}` : ''}
          </div>
        </div>

        <nav className="flex md:flex-col flex-1 md:gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 md:h-14 h-12 rounded-xl text-label font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface-variant hover:bg-surface-high'
                }`
              }
            >
              <span aria-hidden className="text-base opacity-80">
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex md:flex-col gap-0.5 pb-2">
          <MenuItem onClick={() => setThemeOpen(true)}>색상 스타일</MenuItem>
          <MenuItem onClick={() => setPwOpen(true)}>비밀번호 변경</MenuItem>
          <MenuItem onClick={() => void signOut()}>로그아웃</MenuItem>
          <div className="px-4 pt-2 text-label-sm text-on-surface-variant truncate">{email}</div>
        </div>

        <div className="md:hidden flex items-center shrink-0">
          <button onClick={() => setThemeOpen(true)} className="btn">
            색상
          </button>
          <button onClick={() => void signOut()} className="btn">
            로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-surface md:rounded-l-xl md:my-3 md:mr-3 p-4 md:p-8">
        <Outlet />
      </main>

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
      {themeOpen && <ThemeMenu onClose={() => setThemeOpen(false)} />}
    </div>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center px-4 h-11 rounded-xl text-label text-on-surface-variant hover:bg-surface-high transition-colors text-left"
    >
      {children}
    </button>
  )
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')

  async function save() {
    if (pw.length < 6) {
      setMsg('6자 이상 입력하세요.')
      return
    }
    try {
      await changePassword(pw)
      setMsg('변경되었습니다.')
      setTimeout(onClose, 800)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '변경 실패')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/32 grid place-items-center p-4 z-50" onMouseDown={onClose}>
      <div
        className="bg-surface-lowest rounded-lg shadow-e3 p-6 w-full max-w-xs"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-title font-medium mb-4">비밀번호 변경</h2>
        <input
          type="password"
          className="field mb-3"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="새 비밀번호"
          autoFocus
        />
        {msg && <p className="text-body-sm text-on-surface-variant mb-3">{msg}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn">
            취소
          </button>
          <button onClick={() => void save()} className="btn-filled">
            변경
          </button>
        </div>
      </div>
    </div>
  )
}
