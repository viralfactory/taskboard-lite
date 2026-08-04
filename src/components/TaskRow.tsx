import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCheckpoint, deleteCheckpoint, deleteTask, toggleCheckpoint, updateTask } from '../lib/api'
import { progressOf } from '../lib/progress'
import { diffDays, todayStr } from '../lib/dates'
import SignalBadge, { ProgressBar } from './SignalBadge'
import DueChangeModal from './DueChangeModal'
import IssueModal from './IssueModal'
import type { Task } from '../lib/types'
import { useAuth } from '../hooks/useAuth'

const STATUS_LABEL: Record<string, string> = { doing: '진행', done: '완료', hold: '보류' }

export default function TaskRow({
  task,
  assigneeName,
  onDuplicate,
}: {
  task: Task
  assigneeName?: string
  onDuplicate: (t: Task) => void
}) {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [newCp, setNewCp] = useState('')
  const p = progressOf(task)

  const onSuccess = () => void qc.invalidateQueries({ queryKey: ['tasks'] })

  const toggle = useMutation({
    mutationFn: (v: { id: number; next: boolean }) => toggleCheckpoint(v.id, v.next),
    onSuccess,
  })
  const patch = useMutation({ mutationFn: (v: Partial<Task>) => updateTask(task.id, v), onSuccess })
  const addCp = useMutation({
    mutationFn: (name: string) => addCheckpoint(task.id, name, task.checkpoints.length),
    onSuccess,
  })
  const delCp = useMutation({ mutationFn: (id: number) => deleteCheckpoint(id), onSuccess })
  const del = useMutation({ mutationFn: () => deleteTask(task.id), onSuccess })

  const dLeft = diffDays(todayStr(), task.due_date)
  const openIssues = (task.issues ?? []).filter((i) => i.status !== 'resolved')

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => setOpen((v) => !v)} className="text-slate-300 w-4 shrink-0">
            {open ? '▾' : '▸'}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`truncate text-sm ${task.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                {task.name}
              </span>
              {openIssues.length > 0 && (
                <span className="text-xs text-red-500 shrink-0">이슈 {openIssues.length}</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              {task.cat_l1}&gt;{task.cat_l2}
              {assigneeName && ` · ${assigneeName}`} · ~{task.due_date}
              {task.status !== 'done' && dLeft >= 0 && dLeft <= 3 && (
                <span className="text-amber-600"> · D-{dLeft}</span>
              )}
              {task.due_change_count > 0 && (
                <span className="text-slate-400"> · 마감변경 {task.due_change_count}회</span>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <ProgressBar actual={p.actualPct} plan={p.planPct} />
            <span className="text-xs text-slate-500 w-9 text-right">{p.actualPct}%</span>
          </div>
          <SignalBadge signal={p.signal} sv={p.sv} />

          <button
            onClick={() => onDuplicate(task)}
            title="복제 등록"
            className="text-slate-300 hover:text-slate-700 px-1 shrink-0"
          >
            ⧉
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-100 px-3 py-3 space-y-3">
            {/* 체크포인트 — 토글 시 진척률·신호등 즉시 갱신 */}
            <div>
              <div className="text-xs text-slate-400 mb-1.5">
                체크포인트 · 실적 {p.actualPct}% / 계획 {p.planPct}%
              </div>
              <div className="grid sm:grid-cols-2 gap-1">
                {task.checkpoints.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm group">
                    <input
                      type="checkbox"
                      checked={c.is_done}
                      onChange={(e) => toggle.mutate({ id: c.id, next: e.target.checked })}
                      className="accent-slate-900"
                    />
                    <span className={c.is_done ? 'line-through text-slate-400' : ''}>{c.name}</span>
                    <button
                      onClick={() => delCp.mutate(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  </label>
                ))}
              </div>
              <input
                className="field mt-2 py-1 text-sm"
                value={newCp}
                onChange={(e) => setNewCp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCp.trim()) {
                    addCp.mutate(newCp.trim())
                    setNewCp('')
                  }
                }}
                placeholder="체크포인트 추가 후 Enter"
              />
            </div>

            {/* 이슈 */}
            {(task.issues ?? []).length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1.5">이슈</div>
                <ul className="space-y-1">
                  {task.issues!.map((i) => (
                    <li key={i.id} className="text-sm flex items-start gap-2">
                      <span className={i.status === 'resolved' ? 'text-slate-300' : 'text-red-500'}>•</span>
                      <span className={i.status === 'resolved' ? 'line-through text-slate-400' : ''}>
                        [{i.type}] {i.content}
                        {i.impact_days > 0 && (
                          <span className="text-slate-400"> · 일정영향 {i.impact_days}일</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-400 mb-1">산출물</div>
                <input
                  className="field py-1 text-sm"
                  defaultValue={task.deliverable}
                  onBlur={(e) =>
                    e.target.value !== task.deliverable && patch.mutate({ deliverable: e.target.value })
                  }
                />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">증빙 링크</div>
                <input
                  className="field py-1 text-sm"
                  defaultValue={task.deliverable_link ?? ''}
                  placeholder="https://"
                  onBlur={(e) =>
                    e.target.value !== (task.deliverable_link ?? '') &&
                    patch.mutate({ deliverable_link: e.target.value })
                  }
                />
              </div>
            </div>

            {task.due_change_reason && (
              <p className="text-xs text-slate-400">최근 마감변경 사유: {task.due_change_reason}</p>
            )}

            <div className="flex flex-wrap gap-2 items-center pt-1">
              <select
                className="chip border-slate-300 text-xs"
                value={task.status}
                onChange={(e) => patch.mutate({ status: e.target.value as Task['status'] })}
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button onClick={() => setDueOpen(true)} className="chip border-slate-300 text-xs">
                마감일 변경
              </button>
              <button onClick={() => setIssueOpen(true)} className="chip border-slate-300 text-xs">
                이슈 등록
              </button>
              <span className="flex-1" />
              {profile?.is_admin && (
                <button
                  onClick={() => del.mutate()}
                  className="chip border-transparent text-xs text-slate-300 hover:text-red-500"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {dueOpen && <DueChangeModal task={task} onClose={() => setDueOpen(false)} />}
      {issueOpen && <IssueModal task={task} onClose={() => setIssueOpen(false)} />}
    </>
  )
}
