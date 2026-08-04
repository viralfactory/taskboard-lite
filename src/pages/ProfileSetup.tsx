import { useState } from 'react'
import { createProfile, signOut } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

// 최초 로그인 시 profiles 행이 없으면 여기로 유도된다.
export default function ProfileSetup() {
  const { userId, email, refresh } = useAuth()
  const [name, setName] = useState('')
  const [part, setPart] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setBusy(true)
    setErr('')
    try {
      await createProfile({ id: userId, name: name.trim(), part: part.trim() })
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full grid place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-8">
        <h1 className="text-lg font-bold mb-1">처음 오셨네요</h1>
        <p className="text-sm text-slate-400 mb-6">{email}</p>

        <label className="block text-xs text-slate-500 mb-1">이름</label>
        <input className="field mb-3" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <label className="block text-xs text-slate-500 mb-1">파트</label>
        <input
          className="field mb-5"
          value={part}
          onChange={(e) => setPart(e.target.value)}
          placeholder="예: 인프라파트"
        />

        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

        <button disabled={busy || !name.trim()} className="btn w-full bg-slate-900 text-white py-2.5">
          시작하기
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="btn w-full text-slate-400 mt-2"
        >
          다른 계정으로 로그인
        </button>
      </form>
    </div>
  )
}
