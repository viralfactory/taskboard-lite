// 주간보고 자동 초안 집계 (SPEC 10장) — 1·2·3번 항목은 여기서 자동으로 만든다.
import { addWeeks, weekRange } from './dates'
import { progressOf } from './progress'
import type { Task } from './types'

/** 완료 시점: 마지막으로 체크된 체크포인트의 done_at, 없으면 마감일 */
export function doneDateOf(t: Task): string {
  const stamps = (t.checkpoints ?? []).map((c) => c.done_at).filter((v): v is string => !!v)
  if (!stamps.length) return t.due_date
  return stamps.sort().at(-1)!.slice(0, 10)
}

export interface WeeklyDigest {
  done: Task[]
  doing: Task[]
  next: Task[]
}

export function buildDigest(tasks: Task[], userId: string, yearWeek: string): WeeklyDigest {
  const { start, end } = weekRange(yearWeek)
  const nextW = weekRange(addWeeks(yearWeek, 1))
  const mine = tasks.filter((t) => t.assignee_id === userId)

  const done = mine.filter((t) => {
    if (t.status !== 'done') return false
    const d = doneDateOf(t)
    return d >= start && d <= end
  })

  const doing = mine.filter(
    (t) => t.status !== 'done' && t.start_date <= end && t.due_date >= start,
  )

  // 차주 계획 = 마감이 다음 주 안에 있거나, 이번 주말 기준 이미 지연된 미완료 업무
  const next = mine.filter(
    (t) => t.status !== 'done' && ((t.due_date >= nextW.start && t.due_date <= nextW.end) || t.due_date < start),
  )

  return { done, doing, next }
}

export function digestText(d: WeeklyDigest, today?: string): string {
  const lines: string[] = []
  lines.push('■ 금주 완료')
  lines.push(...(d.done.length ? d.done.map((t) => `- ${t.name} (${t.deliverable})`) : ['- 없음']))
  lines.push('', '■ 진행 중')
  lines.push(
    ...(d.doing.length
      ? d.doing.map((t) => {
          const p = progressOf(t, today)
          return `- ${t.name} · ${p.actualPct}% (계획 ${p.planPct}%) ~${t.due_date}`
        })
      : ['- 없음']),
  )
  lines.push('', '■ 차주 계획')
  lines.push(...(d.next.length ? d.next.map((t) => `- ${t.name} (~${t.due_date})`) : ['- 없음']))
  return lines.join('\n')
}
