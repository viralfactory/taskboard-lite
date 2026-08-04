import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createIssue } from '../lib/api'
import { ISSUE_TYPES } from '../lib/categories'
import type { Task } from '../lib/types'

export default function IssueModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [type, setType] = useState<string>(ISSUE_TYPES[0])
  const [impact, setImpact] = useState(0)
  const [err, setErr] = useState('')

  const save = useMutation({
    mutationFn: () =>
      createIssue({ task_id: task.id, content: content.trim(), type, impact_days: impact }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['issues'] })
      onClose()
    },
    onError: (e: Error) => setErr(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50" onMouseDown={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-1">이슈 등록</h2>
        <p className="text-xs text-slate-400 mb-4 truncate">{task.name}</p>

        <textarea
          className="field h-24 resize-none mb-3"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="무엇이 막혀 있는지 한두 줄로"
          autoFocus
        />

        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <div className="text-xs text-slate-500 mb-1">유형</div>
            <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
              {ISSUE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <div className="text-xs text-slate-500 mb-1">일정영향(일)</div>
            <input
              type="number"
              min={0}
              className="field"
              value={impact}
              onChange={(e) => setImpact(Number(e.target.value))}
            />
          </div>
        </div>

        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn text-slate-500">
            취소
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!content.trim() || save.isPending}
            className="btn bg-slate-900 text-white"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  )
}
