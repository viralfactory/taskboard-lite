import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCheckpoint, deleteCheckpoint, deleteTask, toggleCheckpoint, updateTask } from '../lib/api'
import { progressOf } from '../lib/progress'
import { STAGES } from '../lib/constants'
import { diffDays, todayStr } from '../lib/dates'
import SignalBadge, { ProgressBar } from './SignalBadge'
import DueChangeModal from './DueChangeModal'
import IssueModal from './IssueModal'
import HistoryList from './HistoryList'
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
  const { profile, userId } = useAuth()
  const [open, setOpen] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const [newCp, setNewCp] = useState('')
  const p = progressOf(task)

  const onSuccess = () => void qc.invalidateQueries({ queryKey: ['tasks'] })

  const toggle = useMutation({
    mutationFn: (v: { id: number; next: boolean; name: string }) =>
      toggleCheckpoint(v.id, v.next, { taskId: task.id, name: v.name, userId: userId ?? undefined }),
    onSuccess,
  })
  const patch = useMutation({
    mutationFn: (v: Partial<Task>) =>
      updateTask(task.id, v, { before: task, userId: userId ?? undefined }),
    onSuccess,
  })
  const addCp = useMutation({
    mutationFn: (name: string) =>
      addCheckpoint(task.id, name, task.checkpoints.length, userId ?? undefined),
    onSuccess,
  })
  const delCp = useMutation({
    mutationFn: (v: { id: number; name: string }) =>
      deleteCheckpoint(v.id, { taskId: task.id, name: v.name, userId: userId ?? undefined }),
    onSuccess,
  })
  const del = useMutation({ mutationFn: () => deleteTask(task.id), onSuccess })

  const dLeft = diffDays(todayStr(), task.due_date)
  const openIssues = (task.issues ?? []).filter((i) => i.status !== 'resolved')

  return (
    <>
      <div className="bg-surface-lowest border border-outline-variant rounded-md">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => setOpen((v) => !v)} className="text-on-surface-variant/60 w-4 shrink-0">
            {open ? '▾' : '▸'}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`truncate text-sm ${task.status === 'done' ? 'line-through text-on-surface-variant' : ''}`}>
                {task.name}
              </span>
              {openIssues.length > 0 && (
                <span className="text-xs text-error shrink-0">이슈 {openIssues.length}</span>
              )}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5 truncate">
              {task.cat_l1}&gt;{task.cat_l2}
              {task.stage && task.stage !== 'dev' && ` · ${task.stage}`}
              {task.is_agenda === false && ' · 보고제외'}
              {assigneeName && ` · ${assigneeName}`} · ~{task.due_date}
              {task.status !== 'done' && dLeft >= 0 && dLeft <= 3 && (
                <span className="text-signal-yellow"> · D-{dLeft}</span>
              )}
              {task.due_change_count > 0 && (
                <span className="text-on-surface-variant"> · 마감변경 {task.due_change_count}회</span>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <ProgressBar actual={p.actualPct} plan={p.planPct} />
            <span className="text-xs text-on-surface-variant w-9 text-right">{p.actualPct}%</span>
          </div>
          <SignalBadge signal={p.signal} sv={p.sv} />

          <button
            onClick={() => onDuplicate(task)}
            title="복제 등록"
            className="text-on-surface-variant/60 hover:text-on-surface px-1 shrink-0"
          >
            ⧉
          </button>
        </div>

        {open && (
          <div className="border-t border-outline-variant px-3 py-3 space-y-3">
            {/* 체크포인트 — 토글 시 진척률·신호등 즉시 갱신 */}
            <div>
              <div className="text-xs text-on-surface-variant mb-1.5">
                체크포인트 · 실적 {p.actualPct}% / 계획 {p.planPct}%
              </div>
              <div className="grid sm:grid-cols-2 gap-1">
                {task.checkpoints.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm group">
                    <input
                      type="checkbox"
                      checked={c.is_done}
                      onChange={(e) => toggle.mutate({ id: c.id, next: e.target.checked, name: c.name })}
                      className=""
                    />
                    <span className={c.is_done ? 'line-through text-on-surface-variant' : ''}>{c.name}</span>
                    <button
                      onClick={() => delCp.mutate({ id: c.id, name: c.name })}
                      className="opacity-0 group-hover:opacity-100 text-on-surface-variant/60 hover:text-error text-xs"
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
                <div className="text-xs text-on-surface-variant mb-1.5">이슈</div>
                <ul className="space-y-1">
                  {task.issues!.map((i) => (
                    <li key={i.id} className="text-sm flex items-start gap-2">
                      <span className={i.status === 'resolved' ? 'text-on-surface-variant/60' : 'text-error'}>•</span>
                      <span className={i.status === 'resolved' ? 'line-through text-on-surface-variant' : ''}>
                        [{i.type}] {i.content}
                        {i.impact_days > 0 && (
                          <span className="text-on-surface-variant"> · 일정영향 {i.impact_days}일</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-on-surface-variant mb-1">산출물</div>
                <input
                  className="field py-1 text-sm"
                  defaultValue={task.deliverable}
                  onBlur={(e) =>
                    e.target.value !== task.deliverable && patch.mutate({ deliverable: e.target.value })
                  }
                />
              </div>
              <div>
                <div className="text-xs text-on-surface-variant mb-1">증빙 링크</div>
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

            {histOpen && <HistoryList entity="task" id={task.id} />}

            {task.due_change_reason && (
              <p className="text-xs text-on-surface-variant">최근 마감변경 사유: {task.due_change_reason}</p>
            )}

            <div className="flex flex-wrap gap-2 items-center pt-1">
              <select
                className="chip border-outline text-xs"
                value={task.status}
                onChange={(e) => patch.mutate({ status: e.target.value as Task['status'] })}
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                className="chip border-outline text-xs"
                value={task.stage || 'dev'}
                onChange={(e) => patch.mutate({ stage: e.target.value })}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className="chip border-outline text-xs flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={task.is_agenda !== false}
                  onChange={(e) => patch.mutate({ is_agenda: e.target.checked })}
                />
                월간보고 안건
              </label>
              <button onClick={() => setDueOpen(true)} className="chip border-outline text-xs">
                마감일 변경
              </button>
              <button onClick={() => setIssueOpen(true)} className="chip border-outline text-xs">
                이슈 등록
              </button>
              <button onClick={() => setHistOpen((v) => !v)} className="chip border-outline text-xs">
                변경 이력
              </button>
              <span className="flex-1" />
              {profile?.is_admin && (
                <button
                  onClick={() => del.mutate()}
                  className="chip border-transparent text-xs text-on-surface-variant/60 hover:text-error"
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
