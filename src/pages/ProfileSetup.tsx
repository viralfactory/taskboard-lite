import { useState } from 'react'
import { createProfile, signOut } from '../lib/api'
import { nameFromEmail } from '../lib/names'
import { useAuth } from '../hooks/useAuth'

// 최초 로그인 시 profiles 행이 없으면 여기로 유도된다.
export default function ProfileSetup() {
  const { userId, email, refresh } = useAuth()
  // 메일 주소에서 뽑은 이름을 기본값으로 넣어 준다 (고칠 수 있다)
  const [name, setName] = useState(() => nameFromEmail(email))
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
      <form onSubmit={submit} className="w-full max-w-sm bg-surface-lowest rounded-md border border-outline-variant p-8">
        <h1 className="text-lg font-bold mb-1">처음 오셨네요</h1>
        <p className="text-sm text-on-surface-variant mb-6">{email}</p>

        <label className="block text-xs text-on-surface-variant mb-1">이름</label>
        <input className="field mb-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <p className="text-body-sm text-on-surface-variant mb-3">
          아이디에서 자동으로 채웠습니다. 다르게 쓰려면 고치세요.
        </p>

        <label className="block text-xs text-on-surface-variant mb-1">파트</label>
        <input
          className="field mb-5"
          value={part}
          onChange={(e) => setPart(e.target.value)}
          placeholder="예: 인프라파트"
        />

        {err && <p className="text-sm text-error mb-3">{err}</p>}

        <button disabled={busy || !name.trim()} className="btn-filled w-full h-10">
          시작하기
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="btn w-full text-on-surface-variant mt-2"
        >
          다른 계정으로 로그인
        </button>
      </form>
    </div>
  )
}
