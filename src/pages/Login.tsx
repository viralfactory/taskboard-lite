import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { signIn } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

// 아이디 + 비밀번호만. 회원가입·비밀번호찾기·이메일인증 화면은 만들지 않는다.
export default function Login() {
  const { userId, loading } = useAuth()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'TaskBoard Lite — 로그인'
  }, [])

  if (!loading && userId) return <Navigate to="/" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await signIn(id.trim(), pw)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '로그인에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full grid place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-surface-lowest rounded-md border border-outline-variant p-8">
        <h1 className="text-xl font-bold mb-1">TaskBoard Lite</h1>
        <p className="text-sm text-on-surface-variant mb-6">팀 작업관리</p>

        <label className="block text-xs text-on-surface-variant mb-1">아이디</label>
        <input
          className="field mb-3"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="hong@team.local"
          autoFocus
          autoComplete="username"
        />

        <label className="block text-xs text-on-surface-variant mb-1">비밀번호</label>
        <input
          className="field mb-5"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="current-password"
        />

        {err && <p className="text-sm text-error mb-3">{err}</p>}

        <button
          type="submit"
          disabled={busy || !id || !pw}
          className="btn-filled w-full h-10"
        >
          {busy ? '확인 중…' : '로그인'}
        </button>

        <p className="text-xs text-on-surface-variant mt-5 leading-relaxed">
          계정은 팀장이 발급합니다. 아이디·비밀번호를 모르면 팀장에게 문의하세요.
        </p>
      </form>
    </div>
  )
}
