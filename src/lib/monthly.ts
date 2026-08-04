// 월간보고 집계 (SPEC-V2 6장 매핑표). 전부 순수 함수다.
// 월간보고의 모든 수치는 이 파일을 거친다 — 화면에서 직접 집계하지 않는다.

import { addMonths, mdOf, monthRange, recentMonths, todayStr } from './dates'
import { progressOf } from './progress'
import { SEVERITY_ORDER, type Severity } from './constants'
import type { Incident, Issue, MonthlyReport, NextMonthPlan, Task } from './types'

export type AgendaStatus = '완료' | '진행중' | '지연'

/**
 * 6.1 상태 자동 판정.
 *   완료   : status = 'done'
 *   지연   : 미완료 AND (오늘 > 마감일 OR 실적 − 계획 < -20%p)
 *   진행중 : 그 외
 * 지연 조건은 v1 신호등의 🔴 조건과 정확히 같으므로 progress.ts 를 재사용한다.
 */
export function agendaStatus(task: Task, today = todayStr()): AgendaStatus {
  if (task.status === 'done') return '완료'
  return progressOf(task, today).signal === 'red' ? '지연' : '진행중'
}

/**
 * 6.2 일정 표기.
 *   최초 마감 == 현재 마감  →  "M/D {stage}"        예: 7/29 운영 적용
 *   최초 마감 != 현재 마감  →  "M/D → M/D {stage}"  예: 7/13 → 8/6 dev
 * 일정이 밀린 사실이 자동으로 드러난다. 숨길 수 없다.
 */
export function scheduleText(task: Task): string {
  const stage = task.stage || 'dev'
  const initial = task.initial_due_date
  if (!initial || initial === task.due_date) return `${mdOf(task.due_date)} ${stage}`
  return `${mdOf(initial)} → ${mdOf(task.due_date)} ${stage}`
}

/** 기간이 해당 월과 겹치는가 */
function inMonth(task: Task, ym: string): boolean {
  const { start, end } = monthRange(ym)
  return task.start_date <= end && task.due_date >= start
}

export interface AgendaRow {
  id: number
  name: string
  progressNote: string
  status: AgendaStatus
  pct: number
  schedule: string
}

export interface MonthlyData {
  yearMonth: string
  /** 'YYYY.MM.DD ~ MM.DD' */
  periodText: string
  orgName: string
  authorName: string
  reportDate: string
  baseDate: string
  footnote: string
  highlight: string

  summary: {
    agendaCount: number
    done: number
    doing: number
    delayed: number
    agendaText: string
    incidentCount: number
    prevIncidentCount: number
    incidentDiff: number
    incidentText: string
  }

  agendas: AgendaRow[]
  agendaOverflow: number

  incidents: {
    trend: { month: string; label: string; count: number }[]
    bySeverity: { severity: Severity; label: string; count: number }[]
    criticalList: string[]
    criticalOverflow: number
  }

  decisions: { title: string; content: string }[]
  nextPlans: string[]
}

const MAX_AGENDA = 15
const MAX_CRITICAL = 6
const MAX_DECISION = 4
const MAX_NEXT_PLAN = 6

export interface MonthlySource {
  tasks: Task[]
  incidents: Incident[]
  issues: Issue[]
  plans: NextMonthPlan[]
  report: MonthlyReport | null
}

export function buildMonthlyReport(
  ym: string,
  src: MonthlySource,
  today = todayStr(),
): MonthlyData {
  const { start, end } = monthRange(ym)
  const prevYm = addMonths(ym, -1)
  const nextYm = addMonths(ym, 1)

  // ── 1. 개발 안건
  const agendaTasks = src.tasks.filter((t) => t.is_agenda !== false && inMonth(t, ym))
  const withStatus = agendaTasks.map((t) => ({ t, s: agendaStatus(t, today) }))
  const rank: Record<AgendaStatus, number> = { 지연: 0, 진행중: 1, 완료: 2 }
  withStatus.sort((a, b) => rank[a.s] - rank[b.s] || a.t.due_date.localeCompare(b.t.due_date))

  const allRows: AgendaRow[] = withStatus.map(({ t, s }) => ({
    id: t.id,
    name: t.name,
    progressNote: t.progress_note ?? '',
    status: s,
    pct: progressOf(t, today).actualPct,
    schedule: scheduleText(t),
  }))
  // 15건 초과 시 진척율 상위 순으로 15건만 표기
  const agendas =
    allRows.length <= MAX_AGENDA
      ? allRows
      : [...allRows].sort((a, b) => b.pct - a.pct).slice(0, MAX_AGENDA)

  const done = withStatus.filter((x) => x.s === '완료').length
  const delayed = withStatus.filter((x) => x.s === '지연').length
  const doing = withStatus.length - done - delayed

  // ── 2. 장애
  const monthIncidents = (m: string) => {
    const r = monthRange(m)
    return src.incidents.filter((i) => i.occurred_at >= r.start && i.occurred_at <= r.end)
  }
  const cur = monthIncidents(ym)
  const prevCount = monthIncidents(prevYm).length
  const diff = cur.length - prevCount

  const trend = recentMonths(ym, 7).map((m) => ({
    month: m,
    label: `${Number(m.slice(5, 7))}월`,
    count: monthIncidents(m).length,
  }))

  const bySeverity = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    label: { critical: '매우심각', major: '심각', normal: '보통' }[sev],
    count: cur.filter((i) => i.severity === sev).length,
  }))

  const criticalAll = cur
    .filter((i) => i.severity === 'critical')
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const criticalList = criticalAll.slice(0, MAX_CRITICAL).map((i) => `${i.title} (${i.system})`)

  // ── 3. 의사결정 필요 사항
  const decisions = src.issues
    .filter((i) => i.needs_decision && i.status !== 'resolved')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at))
    .slice(0, MAX_DECISION)
    .map((i) => ({ title: i.title?.trim() || i.type, content: i.content }))

  // ── 4. 차월 계획 = 차월 마감 업무 + 수동 추가분
  const nextRange = monthRange(nextYm)
  const fromTasks = src.tasks
    .filter((t) => t.status !== 'done' && t.due_date >= nextRange.start && t.due_date <= nextRange.end)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((t) => `${t.name} (~${mdOf(t.due_date)})`)
  const manual = [...src.plans]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p) => p.content)
  const nextPlans = [...manual, ...fromTasks].slice(0, MAX_NEXT_PLAN)

  // ── 헤더
  const dot = (d: string) => d.replace(/-/g, '.')
  const periodText = `${dot(start)} ~ ${dot(end).slice(5)}`

  const r = src.report
  return {
    yearMonth: ym,
    periodText,
    orgName: r?.org_name ?? 'WEB / POVAS 운영·개발',
    authorName: r?.author_name ?? '',
    reportDate: r?.report_date ?? '',
    baseDate: r?.base_date ?? '',
    footnote: r?.footnote ?? '데이터 출처 : 월말 Error 리포트 · 개발 진행현황 기준일',
    highlight: r?.highlight ?? '',
    summary: {
      agendaCount: withStatus.length,
      done,
      doing,
      delayed,
      agendaText: `${withStatus.length}건 (완료 ${done} · 진행 ${doing} · 지연 ${delayed})`,
      incidentCount: cur.length,
      prevIncidentCount: prevCount,
      incidentDiff: diff,
      incidentText: `${cur.length}건 (전월 ${prevCount}건 대비 ${diffText(diff)})`,
    },
    agendas,
    agendaOverflow: Math.max(0, allRows.length - agendas.length),
    incidents: {
      trend,
      bySeverity,
      criticalList,
      criticalOverflow: Math.max(0, criticalAll.length - criticalList.length),
    },
    decisions,
    nextPlans,
  }
}

/** ▲ 증가 / △ 감소 — 동일하면 '동일' */
export function diffText(diff: number): string {
  if (diff > 0) return `▲${diff}건`
  if (diff < 0) return `△${Math.abs(diff)}건`
  return '동일'
}

/** 안건 수에 따른 표 행 높이 (인치) — 12건 초과 시 축소 */
export function agendaRowHeight(count: number): number {
  return count > 12 ? 0.38 : 0.44
}
