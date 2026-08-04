import { useMemo, useState } from 'react'
import TaskRow from '../components/TaskRow'
import TaskForm, { type TaskFormSeed } from '../components/TaskForm'
import { useProfiles, useTasks, nameMap } from '../hooks/useTasks'
import { progressOf, type Signal } from '../lib/progress'
import { L1_LIST } from '../lib/categories'
import { nextCycleDates } from '../lib/dates'
import type { Task } from '../lib/types'

const RANK: Record<Signal, number> = { red: 0, yellow: 1, green: 2 }

export default function Team() {
  const { data: tasks = [], isLoading } = useTasks()
  const { data: profiles = [] } = useProfiles()
  const names = nameMap(profiles)

  const [who, setWho] = useState('all')
  const [cat, setCat] = useState('all')
  const [sig, setSig] = useState<'all' | Signal>('all')
  const [hideDone, setHideDone] = useState(true)
  const [formSeed, setFormSeed] = useState<TaskFormSeed | null>(null)

  const rows = useMemo(() => {
    const list = tasks.filter((t) => {
      if (hideDone && t.status === 'done') return false
      if (who !== 'all' && t.assignee_id !== who) return false
      if (cat !== 'all' && t.cat_l1 !== cat) return false
      if (sig !== 'all' && progressOf(t).signal !== sig) return false
      return true
    })
    // 🔴 상단 고정
    return list.sort((a, b) => {
      const r = RANK[progressOf(a).signal] - RANK[progressOf(b).signal]
      return r !== 0 ? r : a.due_date.localeCompare(b.due_date)
    })
  }, [tasks, who, cat, sig, hideDone])

  const stat = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'done')
    const count = (s: Signal) => active.filter((t) => progressOf(t).signal === s).length
    return { total: tasks.length, active: active.length, red: count('red'), yellow: count('yellow') }
  }, [tasks])

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
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-baseline gap-3 mb-5">
        <h1 className="text-lg font-bold">팀 현황</h1>
        <span className="text-xs text-slate-400">
          진행 {stat.active}건 · 🔴 {stat.red} · 🟡 {stat.yellow}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select className="chip border-slate-300 text-xs" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">담당자 전체</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select className="chip border-slate-300 text-xs" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">카테고리 전체</option>
          {L1_LIST.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        {(['all', 'red', 'yellow', 'green'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSig(s)}
            className={`chip text-xs ${
              sig === s ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'
            }`}
          >
            {{ all: '신호 전체', red: '🔴', yellow: '🟡', green: '🟢' }[s]}
          </button>
        ))}

        <label className="chip border-slate-300 text-xs flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          완료 숨김
        </label>
      </div>

      {formSeed && (
        <TaskForm key={formSeed.name} seed={formSeed} onClose={() => setFormSeed(null)} />
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">조건에 맞는 업무가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <TaskRow key={t.id} task={t} assigneeName={names[t.assignee_id]} onDuplicate={duplicate} />
          ))}
        </div>
      )}
    </div>
  )
}
