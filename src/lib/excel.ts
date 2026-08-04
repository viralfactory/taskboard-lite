// 엑셀 리포트 (SPEC 9장) — 브라우저에서 직접 생성한다. 서버 호출 없음.
//
// 기획서는 SheetJS(xlsx) 를 지정했으나, SheetJS 커뮤니티 에디션은 쓰기 시
// 셀 배경색과 틀고정(<pane>) 을 지원하지 않아 9장의 '서식' 요구를 채울 수 없다.
// 동일하게 클라이언트 전용인 ExcelJS 로 대체했다. (서버 불필요 원칙은 그대로)
// ExcelJS 는 무겁고 리포트 화면에서만 쓰므로 다운로드 시점에 동적으로 불러온다.
import type ExcelJS from 'exceljs'
import { diffDays, todayStr } from './dates'
import { progressOf, SIGNAL_EMOJI, type Signal } from './progress'
import { buildDigest, doneDateOf } from './weekly'
import { INCIDENT_STATUS, SEVERITY } from './constants'
import type { Incident, Issue, Profile, Task, WeeklyReport } from './types'

const FILL: Record<Signal, string> = {
  green: 'FFC6EFCE',
  yellow: 'FFFFEB9C',
  red: 'FFFFC7CE',
}

export interface ReportFilter {
  from: string
  to: string
  assigneeId: string | 'all'
  signal: 'all' | 'red'
}

interface BuildArgs {
  tasks: Task[]
  issues: Issue[]
  profiles: Profile[]
  reports: WeeklyReport[]
  weeks: string[]
  filter: ReportFilter
  today?: string
  /** v2 — 시트 5 「장애」. 기간(from~to) 내 발생 건만 싣는다. */
  incidents?: Incident[]
}

/** 기간·담당자·신호 조건을 적용한 업무 목록 */
export function filterTasks(tasks: Task[], f: ReportFilter, today = todayStr()): Task[] {
  return tasks.filter((t) => {
    // 기간이 겹치는 업무
    if (t.due_date < f.from || t.start_date > f.to) return false
    if (f.assigneeId !== 'all' && t.assignee_id !== f.assigneeId) return false
    if (f.signal === 'red' && progressOf(t, today).signal !== 'red') return false
    return true
  })
}

function styleHeader(ws: ExcelJS.Worksheet, widths: number[]) {
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle' }
  header.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    c.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } }
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }] // 1행 헤더 고정
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: widths.length } }
  ws.columns.forEach((c, i) => {
    c.width = widths[i]
  })
}

export async function buildWorkbook(args: BuildArgs): Promise<Blob> {
  const today = args.today ?? todayStr()
  const { Workbook } = await import('exceljs')
  const wb = new Workbook()
  wb.creator = 'TaskBoard Lite'
  const nameOf = (id: string) => args.profiles.find((p) => p.id === id)?.name ?? '—'
  const rows = filterTasks(args.tasks, args.filter, today)

  // ── 시트 1: 업무현황
  {
    const ws = wb.addWorksheet('업무현황')
    ws.addRow([
      '대분류', '중분류', '업무명', '담당자', '시작일', '마감일', '산출물',
      '실적%', '계획%', '편차', '신호', '상태', '마감변경횟수',
    ])
    for (const t of rows) {
      const p = progressOf(t, today)
      const r = ws.addRow([
        t.cat_l1, t.cat_l2, t.name, nameOf(t.assignee_id), t.start_date, t.due_date, t.deliverable,
        p.actualPct, p.planPct, p.sv, SIGNAL_EMOJI[p.signal],
        { doing: '진행', done: '완료', hold: '보류' }[t.status] ?? t.status,
        t.due_change_count ?? 0,
      ])
      r.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[p.signal] } }
      r.getCell(11).alignment = { horizontal: 'center' }
      ;[5, 6].forEach((i) => (r.getCell(i).alignment = { horizontal: 'center' }))
    }
    styleHeader(ws, [10, 12, 34, 10, 12, 12, 20, 8, 8, 8, 8, 8, 12])
  }

  // ── 시트 2: 주간보고
  {
    const ws = wb.addWorksheet('주간보고')
    ws.addRow(['주차', '담당자', '금주 완료', '진행 중', '차주 계획', '이슈', '코멘트'])
    for (const week of args.weeks) {
      for (const prof of args.profiles) {
        if (args.filter.assigneeId !== 'all' && prof.id !== args.filter.assigneeId) continue
        const d = buildDigest(args.tasks, prof.id, week)
        const rep = args.reports.find((r) => r.user_id === prof.id && r.year_week === week)
        if (!d.done.length && !d.doing.length && !d.next.length && !rep) continue
        const r = ws.addRow([
          week,
          prof.name,
          d.done.map((t) => `${t.name} (${t.deliverable})`).join('\n'),
          d.doing.map((t) => `${t.name} ${progressOf(t, today).actualPct}%`).join('\n'),
          d.next.map((t) => `${t.name} (~${t.due_date})`).join('\n'),
          rep?.issue_note ?? '',
          rep?.comment ?? '',
        ])
        ;[3, 4, 5, 6, 7].forEach((i) => (r.getCell(i).alignment = { wrapText: true, vertical: 'top' }))
      }
    }
    styleHeader(ws, [12, 10, 40, 40, 40, 30, 30])
  }

  // ── 시트 3: 이슈
  {
    const ws = wb.addWorksheet('이슈')
    ws.addRow(['이슈', '연관 업무', '유형', '일정영향(일)', '상태', '등록일', '경과일'])
    const taskById = new Map(args.tasks.map((t) => [t.id, t]))
    const shown = args.issues.filter((i) => {
      const t = taskById.get(i.task_id)
      if (!t) return false
      return rows.some((r) => r.id === t.id)
    })
    for (const i of shown) {
      const created = i.created_at.slice(0, 10)
      const until = i.resolved_at ? i.resolved_at.slice(0, 10) : today
      ws.addRow([
        i.content,
        taskById.get(i.task_id)?.name ?? '',
        i.type,
        i.impact_days ?? 0,
        { new: '신규', working: '조치중', resolved: '해결' }[i.status] ?? i.status,
        created,
        diffDays(created, until),
      ])
    }
    styleHeader(ws, [46, 30, 10, 12, 10, 12, 8])
  }

  // ── 시트 4: 요약 (임원 보고용)
  {
    const ws = wb.addWorksheet('요약')
    ws.addRow(['담당자', '전체', '완료', '진행', '지연', '완료율', '마감준수율', '평균 마감변경'])

    const targets = args.profiles.filter(
      (p) => args.filter.assigneeId === 'all' || p.id === args.filter.assigneeId,
    )
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

    const summarize = (list: Task[]) => {
      const total = list.length
      const done = list.filter((t) => t.status === 'done').length
      const doing = list.filter((t) => t.status !== 'done').length
      const late = list.filter((t) => progressOf(t, today).signal === 'red').length
      // 마감준수율 = 완료 업무 중 마감일 내에 끝낸 비율
      const onTime = list.filter((t) => t.status === 'done' && doneDateOf(t) <= t.due_date).length
      const changes = list.reduce((s, t) => s + (t.due_change_count ?? 0), 0)
      return [
        total, done, doing, late,
        `${pct(done, total)}%`,
        `${pct(onTime, done)}%`,
        total ? Number((changes / total).toFixed(1)) : 0,
      ]
    }

    for (const p of targets) {
      ws.addRow([p.name, ...summarize(rows.filter((t) => t.assignee_id === p.id))])
    }
    const totalRow = ws.addRow(['팀 합계', ...summarize(rows)])
    totalRow.font = { bold: true }
    totalRow.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      c.border = { top: { style: 'thin', color: { argb: 'FF94A3B8' } } }
    })
    styleHeader(ws, [12, 8, 8, 8, 8, 10, 12, 14])
  }

  // ── 시트 5: 장애 (v2, SPEC-V2 7.8)
  {
    const list = (args.incidents ?? []).filter(
      (i) => i.occurred_at >= args.filter.from && i.occurred_at <= args.filter.to,
    )
    const ws = wb.addWorksheet('장애')
    ws.addRow([
      '발생일', '제목', '시스템', '등급', '원인유형', '조치 내용', '상태', '재발방지 대책', '경과일',
    ])
    for (const i of list) {
      const until = i.resolved_at ? i.resolved_at.slice(0, 10) : today
      const r = ws.addRow([
        i.occurred_at,
        i.title,
        i.system,
        SEVERITY[i.severity]?.label ?? i.severity,
        i.cause_type ?? '',
        i.action ?? '',
        INCIDENT_STATUS[i.status] ?? i.status,
        i.recurrence_action ?? '',
        diffDays(i.occurred_at, until),
      ])
      const bg = { critical: 'FFFDECEC', major: 'FFFDF6E3', normal: 'FFE4F5EE' }[i.severity]
      if (bg) {
        r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        r.getCell(4).alignment = { horizontal: 'center' }
      }
      r.getCell(1).alignment = { horizontal: 'center' }
      ;[6, 8].forEach((c) => (r.getCell(c).alignment = { wrapText: true, vertical: 'top' }))
    }
    styleHeader(ws, [12, 40, 10, 10, 12, 34, 10, 34, 8])
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
