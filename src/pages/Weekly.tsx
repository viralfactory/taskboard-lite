import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listWeeklyReports, saveWeeklyReport, updateTask } from '../lib/api'
import { addWeeks, isoWeek, weekRange } from '../lib/dates'
import { buildDigest, type WeeklyDigest } from '../lib/weekly'
import { progressOf } from '../lib/progress'
import SignalBadge from '../components/SignalBadge'
import { useProfiles, useTasks, nameMap } from '../hooks/useTasks'
import { useAuth } from '../hooks/useAuth'
import type { Task } from '../lib/types'

export default function Weekly() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const { data: tasks = [] } = useTasks()
  const { data: profiles = [] } = useProfiles()
  const names = nameMap(profiles)

  const [week, setWeek] = useState(isoWeek())
  const [tab, setTab] = useState<'mine' | 'team'>('mine')
  const { start, end } = weekRange(week)

  const { data: reports = [] } = useQuery({
    queryKey: ['weekly', week],
    queryFn: () => listWeeklyReports(week),
  })

  const mineReport = reports.find((r) => r.user_id === userId)
  const digest = useMemo(
    () => (userId ? buildDigest(tasks, userId, week) : { done: [], doing: [], next: [] }),
    [tasks, userId, week],
  )

  const [issueNote, setIssueNote] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    setIssueNote(mineReport?.issue_note ?? '')
    setComment(mineReport?.comment ?? '')
  }, [mineReport?.id, week])

  const openIssues = useMemo(
    () =>
      tasks
        .filter((t) => t.assignee_id === userId)
        .flatMap((t) => (t.issues ?? []).filter((i) => i.status !== 'resolved').map((i) => ({ t, i }))),
    [tasks, userId],
  )

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      saveWeeklyReport({
        user_id: userId!,
        year_week: week,
        comment,
        issue_note: issueNote,
        submit,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['weekly', week] }),
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-lg font-bold">주간보고</h1>
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setWeek(addWeeks(week, -1))} className="btn text-on-surface-variant">
            ‹
          </button>
          <span className="font-medium">{week}</span>
          <button onClick={() => setWeek(addWeeks(week, 1))} className="btn text-on-surface-variant">
            ›
          </button>
          <span className="text-xs text-on-surface-variant ml-1">
            {start} ~ {end}
          </span>
        </div>
      </div>

      <div className="flex gap-1.5 mb-5">
        {(['mine', 'team'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`chip text-xs ${
              tab === t ? 'chip-on' : 'border-outline'
            }`}
          >
            {t === 'mine' ? '내 보고' : '팀 통합본'}
          </button>
        ))}
      </div>

      {tab === 'mine' ? (
        <div className="space-y-5">
          <AutoSections digest={digest} />

          {/* progress_note 는 등록 시 받지 않는다. 이미 회고하는 이 시점에만 입력한다. */}
          <ProgressNotes tasks={[...digest.doing, ...digest.done]} />

          <Section title="4. 이슈 및 지원 요청" human>
            {openIssues.length > 0 && (
              <ul className="text-sm space-y-1 mb-2">
                {openIssues.map(({ t, i }) => (
                  <li key={i.id} className="text-on-surface">
                    • [{i.type}] {i.content}{' '}
                    <span className="text-on-surface-variant">
                      ({t.name}
                      {i.impact_days > 0 ? ` · ${i.impact_days}일 영향` : ''})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <textarea
              className="field h-20 resize-none"
              value={issueNote}
              onChange={(e) => setIssueNote(e.target.value)}
              placeholder="추가로 지원이 필요한 사항"
            />
          </Section>

          <Section title="5. 특이사항 코멘트 (3줄 이내)" human>
            <textarea
              className="field h-20 resize-none"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Section>

          <div className="flex items-center gap-3">
            <button
              onClick={() => save.mutate(true)}
              disabled={save.isPending}
              className="btn-filled"
            >
              제출
            </button>
            <button onClick={() => save.mutate(false)} className="btn-outlined">
              임시 저장
            </button>
            {mineReport?.submitted_at && (
              <span className="text-xs text-signal-green">
                제출됨 · {mineReport.submitted_at.slice(0, 16).replace('T', ' ')}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {profiles.map((p) => {
            const d = buildDigest(tasks, p.id, week)
            const r = reports.find((x) => x.user_id === p.id)
            const empty = !d.done.length && !d.doing.length && !d.next.length && !r
            return (
              <div key={p.id} className="bg-surface-lowest border border-outline-variant rounded-md p-4">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-semibold text-sm">{p.name}</span>
                  <span className="text-xs text-on-surface-variant">{p.part}</span>
                  <span className="flex-1" />
                  <span className={`text-xs ${r?.submitted_at ? 'text-signal-green' : 'text-on-surface-variant/60'}`}>
                    {r?.submitted_at ? '제출' : '미제출'}
                  </span>
                </div>
                {empty ? (
                  <p className="text-xs text-on-surface-variant/60">기록 없음</p>
                ) : (
                  <div className="text-sm space-y-2">
                    <Line label="완료" items={d.done.map((t) => `${t.name} (${t.deliverable})`)} />
                    <Line
                      label="진행"
                      items={d.doing.map((t) => `${t.name} ${progressOf(t).actualPct}%`)}
                    />
                    <Line label="차주" items={d.next.map((t) => `${t.name} ~${t.due_date}`)} />
                    {r?.issue_note && <Line label="이슈" items={[r.issue_note]} />}
                    {r?.comment && <Line label="코멘트" items={[r.comment]} />}
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-xs text-on-surface-variant">
            담당자 이름은 프로필 기준입니다. ({Object.keys(names).length}명)
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * 월간보고 「주요 진행 내용」의 원천. 2줄 이내로 제한한다.
 * 여기서 안 쓰면 월간보고 표의 그 칸이 빈칸으로 나간다.
 */
function ProgressNotes({ tasks }: { tasks: Task[] }) {
  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: (v: { id: number; note: string }) => updateTask(v.id, { progress_note: v.note }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  if (!tasks.length) return null
  const agenda = tasks.filter((t) => t.is_agenda !== false)
  if (!agenda.length) return null

  return (
    <Section title="주요 진행 내용 (월간보고용)" human>
      <p className="text-xs text-on-surface-variant mb-3">
        결과 중심으로 2줄 이내. 월간보고 「1. 개발 안건별 진행 현황」 표에 그대로 들어갑니다.
      </p>
      <div className="space-y-2">
        {agenda.map((t) => (
          <div key={t.id}>
            <div className="text-xs text-on-surface-variant mb-1 truncate">{t.name}</div>
            <textarea
              className="field h-14 resize-none text-sm"
              defaultValue={t.progress_note ?? ''}
              maxLength={200}
              placeholder="예: 결제 연동 개발 완료, 운영 반영 대기"
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v !== (t.progress_note ?? '')) save.mutate({ id: t.id, note: v })
              }}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}

function Line({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="flex gap-2">
      <span className="text-xs text-on-surface-variant w-10 shrink-0 pt-0.5">{label}</span>
      <span className="text-on-surface">{items.join(' / ')}</span>
    </div>
  )
}

function Section({
  title,
  human,
  children,
}: {
  title: string
  human?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-lowest border border-outline-variant rounded-md p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            human ? 'bg-signal-yellow-c text-signal-yellow' : 'bg-surface-high text-on-surface-variant'
          }`}
        >
          {human ? '직접 작성' : '자동'}
        </span>
      </div>
      {children}
    </div>
  )
}

function AutoSections({ digest }: { digest: WeeklyDigest }) {
  return (
    <>
      <Section title="1. 금주 완료 업무">
        <TaskLines tasks={digest.done} render={(t) => `${t.name} — 산출물: ${t.deliverable}`} />
      </Section>
      <Section title="2. 진행 중 업무">
        {digest.doing.length === 0 ? (
          <p className="text-sm text-on-surface-variant/60">없음</p>
        ) : (
          <ul className="space-y-1.5">
            {digest.doing.map((t) => {
              const p = progressOf(t)
              return (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{t.name}</span>
                  <span className="text-on-surface-variant text-xs">
                    {p.actualPct}% / 계획 {p.planPct}%
                  </span>
                  <SignalBadge signal={p.signal} />
                </li>
              )
            })}
          </ul>
        )}
      </Section>
      <Section title="3. 차주 계획">
        <TaskLines tasks={digest.next} render={(t) => `${t.name} (~${t.due_date})`} />
      </Section>
    </>
  )
}

function TaskLines({ tasks, render }: { tasks: Task[]; render: (t: Task) => string }) {
  if (!tasks.length) return <p className="text-sm text-on-surface-variant/60">없음</p>
  return (
    <ul className="space-y-1 text-sm">
      {tasks.map((t) => (
        <li key={t.id}>• {render(t)}</li>
      ))}
    </ul>
  )
}
