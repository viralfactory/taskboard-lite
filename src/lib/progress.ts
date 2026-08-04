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
  id?: number
  start_date: string
  due_date: string
  status: string
  checkpoints?: { is_done: boolean; name?: string }[]
}

/**
 * 현재 단계 = 가장 뒤에 완료된 체크포인트의 '다음' 것.
 * 체크포인트는 순서대로 하지 않아도 되고 여러 개를 한 번에 체크할 수 있으므로,
 * '첫 미완료' 가 아니라 '가장 진행된 지점' 을 기준으로 삼는다.
 *
 *   ☑요건정의 ☐분석 ☑설계 ☐구현 → '구현'  (분석이 아니다)
 *   전부 미완료 → 첫 단계
 *   전부 완료   → '완료'
 */
export function currentStage(checkpoints: { is_done: boolean; name?: string }[]): string {
  if (!checkpoints.length) return ''
  let lastDone = -1
  checkpoints.forEach((c, i) => {
    if (c.is_done) lastDone = i
  })
  if (lastDone < 0) return checkpoints[0].name ?? ''
  if (lastDone >= checkpoints.length - 1) return '완료'
  return checkpoints[lastDone + 1].name ?? ''
}

/**
 * 부모 업무의 진척률은 자식에서 끌어올린다 (자식 진척률의 단순 평균).
 * 자식이 없으면 자기 체크포인트로 계산한다.
 */
export function rollupActualPct(task: TaskLike, children: TaskLike[]): number {
  if (!children.length) return calcActualPct(task.checkpoints ?? [])
  const sum = children.reduce((acc, c) => acc + calcActualPct(c.checkpoints ?? []), 0)
  return Math.round(sum / children.length)
}

/** 부모의 마감일 = 자식 중 가장 늦은 날 */
export function rollupDueDate(task: TaskLike, children: TaskLike[]): string {
  if (!children.length) return task.due_date
  return children.reduce((mx, c) => (c.due_date > mx ? c.due_date : mx), children[0].due_date)
}

/** 부모의 시작일 = 자식 중 가장 이른 날 */
export function rollupStartDate(task: TaskLike, children: TaskLike[]): string {
  if (!children.length) return task.start_date
  return children.reduce((mn, c) => (c.start_date < mn ? c.start_date : mn), children[0].start_date)
}

/**
 * 화면·엑셀에서 함께 쓰는 파생값 한 벌.
 * children 을 넘기면 부모로 보고 자식에서 끌어올린다.
 */
export function progressOf(task: TaskLike, today = todayStr(), children: TaskLike[] = []) {
  const actualPct = rollupActualPct(task, children)
  const startDate = rollupStartDate(task, children)
  const dueDate = rollupDueDate(task, children)
  const planPct = calcPlanPct(startDate, dueDate, today)
  const signal = getSignal({
    actualPct,
    planPct,
    dueDate,
    status: task.status as TaskStatus,
    today,
  })
  return { actualPct, planPct, sv: actualPct - planPct, signal, dueDate, startDate }
}
