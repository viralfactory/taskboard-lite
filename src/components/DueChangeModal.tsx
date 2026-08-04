import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { changeDueDate } from '../lib/api'
import type { Task } from '../lib/types'
import { useAuth } from '../hooks/useAuth'

// 마감일 변경은 사유 없이 불가 (SPEC 6장)
export default function DueChangeModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const qc = useQueryClient()
  const { userId } = useAuth()
  const [due, setDue] = useState(task.due_date)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const save = useMutation({
    mutationFn: () => changeDueDate(task, due, reason, userId ?? undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      onClose()
    },
    onError: (e: Error) => setErr(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/32 grid place-items-center p-4 z-50" onMouseDown={onClose}>
      <div className="bg-surface-lowest rounded-lg shadow-e3 p-6 w-full max-w-sm" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-1">마감일 변경</h2>
        <p className="text-xs text-on-surface-variant mb-4 truncate">{task.name}</p>

        <div className="text-xs text-on-surface-variant mb-1">새 마감일</div>
        <input type="date" className="field mb-3" value={due} onChange={(e) => setDue(e.target.value)} />

        <div className="text-xs text-on-surface-variant mb-1">
          변경 사유 <span className="text-error">*</span>
        </div>
        <textarea
          className="field h-20 resize-none mb-1"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 선행 과제 지연으로 착수 지연"
          autoFocus
        />
        <p className="text-xs text-on-surface-variant mb-4">
          지금까지 변경 {task.due_change_count ?? 0}회 · 저장하면 {(task.due_change_count ?? 0) + 1}회가 됩니다.
        </p>

        {err && <p className="text-sm text-error mb-3">{err}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn text-on-surface-variant">
            취소
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!reason.trim() || !due || save.isPending}
            className="btn-filled"
          >
            변경
          </button>
        </div>
      </div>
    </div>
  )
}
