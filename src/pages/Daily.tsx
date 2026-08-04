import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDailyItem,
  appendDailyItems,
  completeDailyItem,
  createDailyReport,
  deleteDailyItem,
  listDailyReports,
  saveDailyReport,
  updateDailyItem,
} from '../lib/api'
import { addDays, dowOf, isWorkday, lastWorkday, todayStr } from '../lib/dates'
import { newItemsSince, snapshotItems } from '../lib/daily'
import { useProfiles, useTasks } from '../hooks/useTasks'
import { useAuth } from '../hooks/useAuth'
import HistoryList from '../components/HistoryList'
import { friendlyError } from '../lib/errors'
import TaskForm from '../components/TaskForm'
import type { DailyItem, DailyReport } from '../lib/types'

export default function Daily() {
  const { userId, profile } = useAuth()
  const qc = useQueryClient()
  const { data: tasks = [] } = useTasks()
  const { data: profiles = [] } = useProfiles()

  const [date, setDate] = useState(lastWorkday())
  const [tab, setTab] = useState<'mine' | 'team'>('mine')
  const [err, setErr] = useState('')

  const { data: reports = [], isLoading, error: loadError } = useQuery({
    queryKey: ['daily', date],
    queryFn: () => listDailyReports(date),
    retry: false,
  })

  const mine = reports.find((r) => r.user_id === userId)
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['daily', date] })

  // 관리자가 쓴 일지는 팀 공유에서 제외한다 (팀원 업무만 관리)
  const members = profiles.filter((p) => !p.is_admin)

  const create = useMutation({
    mutationFn: () => createDailyReport(userId!, date, snapshotItems(tasks, userId!, date)),
    onSuccess: () => {
      setErr('')
      invalidate()
    },
    onError: (e: Error) => setErr(friendlyError(e)),
  })

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-lg font-bold">데일리 스크럼</h1>
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setDate(prevWorkday(date))} className="btn text-on-surface-variant">‹</button>
          <span className="font-medium">
            {date} ({dowOf(date)})
          </span>
          <button onClick={() => setDate(nextWorkday(date))} className="btn text-on-surface-variant">›</button>
          {date !== lastWorkday() && (
            <button onClick={() => setDate(lastWorkday())} className="btn text-xs text-on-surface-variant">
              오늘
            </button>
          )}
        </div>
        {!isWorkday(date) && <span className="text-xs text-signal-yellow">주말입니다</span>}
        {date < todayStr() && <span className="text-xs text-on-surface-variant">지난 날짜 — 수정하면 이력이 남습니다</span>}
      </div>

      {(err || loadError) && (
        <div className="mb-4 rounded-md bg-error-container text-on-error-container px-4 py-3 text-body">
          {err || friendlyError(loadError)}
        </div>
      )}

      <div className="flex gap-1.5 mb-5">
        {(['mine', 'team'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`chip text-xs ${tab === t ? 'chip-on' : 'border-outline'}`}
          >
            {t === 'mine' ? '내 일지' : `팀 전체 ${reports.filter((r) => members.some((m) => m.id === r.user_id)).length}/${members.length}`}
          </button>
        ))}
      </div>

      {tab === 'mine' ? (
        isLoading ? (
          <p className="text-sm text-on-surface-variant">불러오는 중…</p>
        ) : !mine ? (
          <div className="border border-dashed border-outline-variant rounded-md p-10 text-center">
            <p className="text-sm text-on-surface-variant mb-1">{date} 일지가 아직 없습니다.</p>
            <p className="text-xs text-on-surface-variant mb-4">
              {snapshotItems(tasks, userId ?? '', date).length > 0
                ? '생성하면 이 날짜에 기간이 걸친 내 업무의 체크포인트를 가져옵니다.'
                : '가져올 내 업무가 없어 빈 일지로 만들어집니다. 만든 뒤에 업무를 등록할 수 있습니다.'}
            </p>
            <button onClick={() => create.mutate()} disabled={create.isPending} className="btn-filled">
              {create.isPending ? '생성 중…' : err ? '다시 시도' : '일지 생성'}
            </button>
          </div>
        ) : (
          <MyDaily report={mine} date={date} onChanged={invalidate} />
        )
      ) : (
        <TeamDaily
          reports={reports}
          members={members}
          isAdmin={!!profile?.is_admin}
          date={date}
        />
      )}
    </div>
  )
}

function prevWorkday(d: string) {
  let x = addDays(d, -1)
  while (!isWorkday(x)) x = addDays(x, -1)
  return x
}
function nextWorkday(d: string) {
  let x = addDays(d, 1)
  while (!isWorkday(x)) x = addDays(x, 1)
  return x
}

// ─────────────────────────────────────────── 내 일지

function MyDaily({ report, date, onChanged }: { report: DailyReport; date: string; onChanged: () => void }) {
  const { userId } = useAuth()
  const { data: tasks = [] } = useTasks()
  const [issueNote, setIssueNote] = useState(report.issue_note ?? '')
  const [comment, setComment] = useState(report.comment ?? '')
  const [newTodo, setNewTodo] = useState('')
  const [newDone, setNewDone] = useState('')
  const [histOpen, setHistOpen] = useState(false)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    setIssueNote(report.issue_note ?? '')
    setComment(report.comment ?? '')
  }, [report.id])

  const items = report.daily_items ?? []
  const todo = items.filter((i) => i.section === 'todo')
  const done = items.filter((i) => i.section === 'done')

  const save = useMutation({
    mutationFn: (patch: Partial<DailyReport>) =>
      saveDailyReport(report, patch, { userId: userId!, today: todayStr() }),
    onSuccess: () => {
      setErr('')
      onChanged()
    },
    onError: (e: Error) => setErr(friendlyError(e)),
  })
  const toggle = useMutation({
    mutationFn: (v: { item: DailyItem; next: boolean }) =>
      completeDailyItem(v.item, v.next, { userId: userId! }),
    onSuccess: onChanged,
  })
  const editItem = useMutation({
    mutationFn: (v: { id: number; label: string }) => updateDailyItem(v.id, { label: v.label }),
    onSuccess: onChanged,
  })
  const delItem = useMutation({ mutationFn: (id: number) => deleteDailyItem(id), onSuccess: onChanged })
  const addItem = useMutation({
    mutationFn: (v: { section: 'todo' | 'done'; label: string; order: number }) =>
      addDailyItem(report.id, v.section, v.label, v.order),
    onSuccess: onChanged,
  })

  // 일지를 만든 뒤에 생긴 업무만 골라 덧붙인다
  const fresh = useMemo(
    () => (userId ? newItemsSince(snapshotItems(tasks, userId, date), items) : []),
    [tasks, userId, date, items],
  )
  const refresh = useMutation({
    mutationFn: () =>
      appendDailyItems(
        report.id,
        fresh.map((f, i) => ({ ...f, sort_order: items.length + i })),
      ),
    onSuccess: onChanged,
  })

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-md bg-error-container text-on-error-container px-4 py-3 text-body">{err}</div>
      )}

      <label className="flex items-center gap-2 text-sm bg-surface-lowest border border-outline-variant rounded-md px-4 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={report.is_leave}
          onChange={(e) => save.mutate({ is_leave: e.target.checked })}
          className=""
        />
        이 날은 휴가
        <span className="text-xs text-on-surface-variant">체크하면 팀 화면에 휴가로 표시되고 미작성 집계에서 빠집니다</span>
      </label>

      {taskFormOpen && <TaskForm onClose={() => setTaskFormOpen(false)} />}

      <Section
        title="To Do (진행 중)"
        count={todo.length}
        extra={
          <div className="flex items-center gap-3">
            {fresh.length > 0 && (
              <button onClick={() => refresh.mutate()} className="text-body-sm text-primary font-medium">
                새 업무 {fresh.length}건 불러오기
              </button>
            )}
            {!taskFormOpen && (
              <button onClick={() => setTaskFormOpen(true)} className="text-body-sm text-on-surface-variant hover:text-on-surface">
                + 내 업무 추가
              </button>
            )}
          </div>
        }
      >
        {/* 등록된 업무가 없으면 빈 포맷 그대로 두되, 여기서 바로 업무를 만들 수 있게 한다 */}
        {items.length === 0 && !taskFormOpen && (
          <div className="border border-dashed border-outline-variant rounded-md p-5 text-center mb-2">
            <p className="text-body-sm text-on-surface-variant mb-3">
              가져올 내 업무가 없습니다. 업무를 등록하면 다음 일지부터 자동으로 올라옵니다.
            </p>
            <button onClick={() => setTaskFormOpen(true)} className="btn-filled">
              내 업무 등록
            </button>
          </div>
        )}

        <ItemList
          items={todo}
          onToggle={(item, next) => toggle.mutate({ item, next })}
          onEdit={(id, label) => editItem.mutate({ id, label })}
          onDelete={(id) => delItem.mutate(id)}
        />
        <AddLine
          value={newTodo}
          setValue={setNewTodo}
          placeholder="업무 외 할 일 덧붙이기 (예: 배포 리허설 참관)"
          onSubmit={(v) => {
            addItem.mutate({ section: 'todo', label: v, order: items.length })
            setNewTodo('')
          }}
        />
      </Section>

      <Section title="Done (처리한 일)" count={done.length}>
        <ItemList
          items={done}
          onToggle={(item, next) => toggle.mutate({ item, next })}
          onEdit={(id, label) => editItem.mutate({ id, label })}
          onDelete={(id) => delItem.mutate(id)}
        />
        <AddLine
          value={newDone}
          setValue={setNewDone}
          placeholder="처리한 일 덧붙이기"
          onSubmit={(v) => {
            addItem.mutate({ section: 'done', label: v, order: items.length })
            setNewDone('')
          }}
        />
      </Section>

      <Section title="이슈 및 지원요청" human>
        <textarea
          className="field h-20 resize-none"
          value={issueNote}
          onChange={(e) => setIssueNote(e.target.value)}
          onBlur={() => issueNote !== (report.issue_note ?? '') && save.mutate({ issue_note: issueNote })}
          placeholder="막힌 것, 도움이 필요한 것"
        />
      </Section>

      <Section title="특이사항" human>
        <textarea
          className="field h-20 resize-none"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => comment !== (report.comment ?? '') && save.mutate({ comment })}
        />
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={() => save.mutate({ submitted_at: new Date().toISOString() })}
          className="btn-filled"
        >
          제출
        </button>
        {report.submitted_at && (
          <span className="text-xs text-signal-green">
            제출됨 · {report.submitted_at.slice(0, 16).replace('T', ' ')}
          </span>
        )}
        <span className="flex-1" />
        <button onClick={() => setHistOpen((v) => !v)} className="text-xs text-on-surface-variant hover:text-on-surface">
          변경 이력
        </button>
      </div>

      {histOpen && <HistoryList entity="daily" id={report.id} />}
    </div>
  )
}

function ItemList({
  items,
  onToggle,
  onEdit,
  onDelete,
}: {
  items: DailyItem[]
  onToggle: (item: DailyItem, next: boolean) => void
  onEdit: (id: number, label: string) => void
  onDelete: (id: number) => void
}) {
  if (!items.length) return <p className="text-sm text-on-surface-variant/60 py-1">항목 없음</p>
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-2 group">
          <input
            type="checkbox"
            checked={i.is_done}
            onChange={(e) => onToggle(i, e.target.checked)}
            className="shrink-0"
          />
          <input
            className="flex-1 text-sm bg-transparent outline-none border-b border-transparent focus:border-outline py-0.5"
            defaultValue={i.label}
            onBlur={(e) => e.target.value !== i.label && onEdit(i.id, e.target.value)}
          />
          {i.is_manual && <span className="text-[10px] text-on-surface-variant/60 shrink-0">직접</span>}
          <button
            onClick={() => onDelete(i.id)}
            className="opacity-0 group-hover:opacity-100 text-on-surface-variant/60 hover:text-error text-xs px-1 shrink-0"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}

function AddLine({
  value,
  setValue,
  placeholder,
  onSubmit,
}: {
  value: string
  setValue: (v: string) => void
  placeholder: string
  onSubmit: (v: string) => void
}) {
  return (
    <input
      className="field py-1 text-sm mt-2"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value.trim()) onSubmit(value.trim())
      }}
      placeholder={placeholder}
    />
  )
}

function Section({
  title,
  count,
  human,
  extra,
  children,
}: {
  title: string
  count?: number
  human?: boolean
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-lowest border border-outline-variant rounded-md p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count !== undefined && <span className="text-xs text-on-surface-variant">{count}</span>}
        {human && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-signal-yellow-c text-signal-yellow">직접 작성</span>
        )}
        <span className="flex-1" />
        {extra}
      </div>
      {children}
    </div>
  )
}


// ─────────────────────────────────────────── 팀 전체

function TeamDaily({
  reports,
  members,
  isAdmin,
  date,
}: {
  reports: DailyReport[]
  members: { id: string; name: string; part: string | null }[]
  isAdmin: boolean
  date: string
}) {
  return (
    <div className="space-y-3">
      {isAdmin && (
        <p className="text-xs text-on-surface-variant">
          관리자가 작성한 일지는 이 목록에 표시되지 않습니다. 팀원 {members.length}명의 일지만 모읍니다.
        </p>
      )}
      {members.map((m) => {
        const r = reports.find((x) => x.user_id === m.id)
        const items = r?.daily_items ?? []
        const todo = items.filter((i) => i.section === 'todo')
        const done = items.filter((i) => i.section === 'done')
        return (
          <div key={m.id} className="bg-surface-lowest border border-outline-variant rounded-md p-4">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-semibold text-sm">{m.name}</span>
              <span className="text-xs text-on-surface-variant">{m.part}</span>
              <span className="flex-1" />
              {r?.is_leave ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container">휴가</span>
              ) : r?.submitted_at ? (
                <span className="text-xs text-signal-green">제출</span>
              ) : r ? (
                <span className="text-xs text-on-surface-variant/60">작성 중</span>
              ) : (
                <span className="text-xs text-error">미작성</span>
              )}
            </div>

            {!r ? (
              <p className="text-xs text-on-surface-variant/60">{date} 일지 없음</p>
            ) : r.is_leave && !items.length ? (
              <p className="text-xs text-on-surface-variant/60">휴가</p>
            ) : (
              <div className="text-sm space-y-1.5">
                <TeamLine label="To Do" items={todo.map((i) => i.label)} />
                <TeamLine label="Done" items={done.map((i) => i.label)} />
                {r.issue_note && <TeamLine label="이슈" items={[r.issue_note]} warn />}
                {r.comment && <TeamLine label="특이" items={[r.comment]} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TeamLine({ label, items, warn }: { label: string; items: string[]; warn?: boolean }) {
  if (!items.length) return null
  return (
    <div className="flex gap-2">
      <span className={`text-xs w-10 shrink-0 pt-0.5 ${warn ? 'text-error' : 'text-on-surface-variant'}`}>{label}</span>
      <span className="text-on-surface">{items.join(' / ')}</span>
    </div>
  )
}
