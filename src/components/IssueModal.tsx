import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createIssue } from '../lib/api'
import { ISSUE_TYPES } from '../lib/categories'
import type { Task } from '../lib/types'

export default function IssueModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<string>(ISSUE_TYPES[0])
  const [impact, setImpact] = useState(0)
  const [needsDecision, setNeedsDecision] = useState(false)
  const [err, setErr] = useState('')

  const save = useMutation({
    mutationFn: () =>
      createIssue({
        task_id: task.id,
        title: title.trim(),
        content: content.trim(),
        type,
        impact_days: impact,
        needs_decision: needsDecision,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['issues'] })
      onClose()
    },
    onError: (e: Error) => setErr(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/32 grid place-items-center p-4 z-50" onMouseDown={onClose}>
      <div className="bg-surface-lowest rounded-lg shadow-e3 p-6 w-full max-w-sm" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-1">이슈 등록</h2>
        <p className="text-xs text-on-surface-variant mb-4 truncate">{task.name}</p>

        <input
          className="field mb-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (예: 스마트로 키인 결제)"
          autoFocus
        />

        <textarea
          className="field h-24 resize-none mb-3"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="무엇이 막혀 있는지 한두 줄로"
        />

        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <div className="text-xs text-on-surface-variant mb-1">유형</div>
            <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
              {ISSUE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <div className="text-xs text-on-surface-variant mb-1">일정영향(일)</div>
            <input
              type="number"
              min={0}
              className="field"
              value={impact}
              onChange={(e) => setImpact(Number(e.target.value))}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={needsDecision}
            onChange={(e) => setNeedsDecision(e.target.checked)}
            className=""
          />
          의사결정 필요 사항
          <span className="text-xs text-on-surface-variant">(월간보고 3번에 올라감)</span>
        </label>

        {err && <p className="text-sm text-error mb-3">{err}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn text-on-surface-variant">
            취소
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!content.trim() || save.isPending}
            className="btn-filled"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  )
}
