import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { changePassword, signOut } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { to: '/', label: '내 업무', end: true },
  { to: '/team', label: '팀 현황', end: false },
  { to: '/incidents', label: '장애 관리', end: false },
  { to: '/daily', label: '데일리', end: false },
  { to: '/weekly', label: '주간보고', end: false },
  { to: '/monthly', label: '월간보고', end: false },
  { to: '/report', label: '리포트', end: false },
]

export default function Layout() {
  const { profile, email } = useAuth()
  const [pwOpen, setPwOpen] = useState(false)

  return (
    <div className="min-h-full flex flex-col md:flex-row">
      <aside className="md:w-52 shrink-0 md:min-h-screen bg-white border-b md:border-b-0 md:border-r border-slate-200 flex md:flex-col">
        <div className="hidden md:block px-5 py-5">
          <div className="font-bold">TaskBoard Lite</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {profile?.name}
            {profile?.part ? ` · ${profile.part}` : ''}
          </div>
        </div>

        <nav className="flex md:flex-col flex-1 md:px-3 md:gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `px-4 py-3 md:py-2 text-sm rounded-md whitespace-nowrap ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block px-3 pb-4 text-xs">
          <button onClick={() => setPwOpen(true)} className="btn w-full text-left text-slate-500">
            비밀번호 변경
          </button>
          <button onClick={() => void signOut()} className="btn w-full text-left text-slate-500">
            로그아웃
          </button>
          <div className="px-3 pt-2 text-slate-300 truncate">{email}</div>
        </div>

        <button
          onClick={() => void signOut()}
          className="md:hidden px-4 py-3 text-sm text-slate-400 shrink-0"
        >
          로그아웃
        </button>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8">
        <Outlet />
      </main>

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </div>
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
    <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-4">비밀번호 변경</h2>
        <input
          type="password"
          className="field mb-3"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="새 비밀번호"
          autoFocus
        />
        {msg && <p className="text-sm text-slate-500 mb-3">{msg}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn text-slate-500">
            취소
          </button>
          <button onClick={() => void save()} className="btn bg-slate-900 text-white">
            변경
          </button>
        </div>
      </div>
    </div>
  )
}
