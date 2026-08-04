import { useEffect, useMemo, useState } from 'react'
import TaskForm, { type TaskFormSeed } from '../components/TaskForm'
import TaskRow from '../components/TaskRow'
import { useProfiles, useTasks, nameMap } from '../hooks/useTasks'
import { useAuth } from '../hooks/useAuth'
import { progressOf } from '../lib/progress'
import { nextCycleDates } from '../lib/dates'
import type { Task } from '../lib/types'

type Tab = 'doing' | 'done' | 'all'

export default function MyTasks() {
  const { userId } = useAuth()
  const { data: tasks = [], isLoading } = useTasks()
  const { data: profiles = [] } = useProfiles()
  const names = nameMap(profiles)

  const [formSeed, setFormSeed] = useState<TaskFormSeed | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('doing')

  // N 키로 어디서든 등록 폼을 연다
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (formOpen) return
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N' || e.key === 'ㅜ') {
        e.preventDefault()
        setFormSeed(null)
        setFormOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formOpen])

  const mine = useMemo(() => tasks.filter((t) => t.assignee_id === userId), [tasks, userId])
  const shown = useMemo(() => {
    const list = tab === 'all' ? mine : mine.filter((t) => (tab === 'done' ? t.status === 'done' : t.status !== 'done'))
    // 위험한 것부터
    const rank = { red: 0, yellow: 1, green: 2 }
    return [...list].sort((a, b) => {
      const ra = rank[progressOf(a).signal] - rank[progressOf(b).signal]
      return ra !== 0 ? ra : a.due_date.localeCompare(b.due_date)
    })
  }, [mine, tab])

  function duplicate(t: Task) {
    const { start, due } = nextCycleDates(t.start_date, t.due_date)
    setFormSeed({
      name: t.name,
      l1: t.cat_l1,
      l2: t.cat_l2,
      startDate: start,
      dueDate: due,
      checkpoints: t.checkpoints.map((c) => c.name),
      deliverable: t.deliverable,
      assigneeId: t.assignee_id,
      stage: t.stage,
      isAgenda: t.is_agenda,
    })
    setFormOpen(true)
  }

  const counts = {
    doing: mine.filter((t) => t.status !== 'done').length,
    done: mine.filter((t) => t.status === 'done').length,
    all: mine.length,
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold">내 업무</h1>
        <button
          onClick={() => {
            setFormSeed(null)
            setFormOpen((v) => !v)
          }}
          className="btn bg-slate-900 text-white"
        >
          {formOpen ? '등록 폼 닫기' : '+ 새 업무'} <span className="opacity-50 text-xs">N</span>
        </button>
      </div>

      <div className="flex gap-1.5 mb-4">
        {(['doing', 'done', 'all'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`chip text-xs ${
              tab === t ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'
            }`}
          >
            {{ doing: '진행 중', done: '완료', all: '전체' }[t]} {counts[t]}
          </button>
        ))}
      </div>

      {formOpen && (
        <TaskForm
          key={formSeed?.name ?? '__new__'}
          seed={formSeed ?? undefined}
          onClose={() => setFormOpen(false)}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">불러오는 중…</p>
      ) : shown.length === 0 ? (
        <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-10 text-center">
          업무가 없습니다. <b>N</b> 키를 눌러 등록하세요.
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((t) => (
            <TaskRow key={t.id} task={t} assigneeName={names[t.assignee_id]} onDuplicate={duplicate} />
          ))}
        </div>
      )}
    </div>
  )
}
