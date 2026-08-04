// 진척률·신호등. 순수 함수만 둔다 (SPEC 6장).
//
//   실적진척률 = 완료 체크포인트 수 / 전체 체크포인트 수 × 100
//   계획진척률 = (오늘 - 시작일) / (마감일 - 시작일) × 100
//   편차(SV)  = 실적 - 계획
//
//   🟢 정상  SV >= -5%p
//   🟡 주의  -20%p <= SV < -5%p
//   🔴 위험  SV < -20%p  또는  마감일 초과 & 미완료

import { diffDays, todayStr } from './dates'

export type Signal = 'green' | 'yellow' | 'red'
export type TaskStatus = 'doing' | 'done' | 'hold'

export const SIGNAL_EMOJI: Record<Signal, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
}

export const SIGNAL_LABEL: Record<Signal, string> = {
  green: '정상',
  yellow: '주의',
  red: '위험',
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function calcActualPct(checkpoints: { is_done: boolean }[]): number {
  if (!checkpoints.length) return 0
  const done = checkpoints.filter((c) => c.is_done).length
  return Math.round((done / checkpoints.length) * 100)
}

export function calcPlanPct(startDate: string, dueDate: string, today = todayStr()): number {
  const total = diffDays(startDate, dueDate)
  // 당일 업무(시작=마감): 당일이 되면 100% 계획된 것으로 본다
  if (total <= 0) return diffDays(startDate, today) >= 0 ? 100 : 0
  const elapsed = diffDays(startDate, today)
  return clamp(Math.round((elapsed / total) * 100))
}

export function getSignal(args: {
  actualPct: number
  planPct: number
  dueDate: string
  status: TaskStatus
  today?: string
}): Signal {
  const { actualPct, planPct, dueDate, status } = args
  const today = args.today ?? todayStr()

  if (status === 'done') return 'green'
  if (diffDays(today, dueDate) < 0) return 'red' // 마감일 초과 & 미완료

  const sv = actualPct - planPct
  if (sv >= -5) return 'green'
  if (sv >= -20) return 'yellow'
  return 'red'
}

export interface TaskLike {
  start_date: string
  due_date: string
  status: string
  checkpoints?: { is_done: boolean }[]
}

/** 화면·엑셀에서 함께 쓰는 파생값 한 벌 */
export function progressOf(task: TaskLike, today = todayStr()) {
  const actualPct = calcActualPct(task.checkpoints ?? [])
  const planPct = calcPlanPct(task.start_date, task.due_date, today)
  const signal = getSignal({
    actualPct,
    planPct,
    dueDate: task.due_date,
    status: task.status as TaskStatus,
    today,
  })
  return { actualPct, planPct, sv: actualPct - planPct, signal }
}
