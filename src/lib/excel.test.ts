import { describe, it, expect } from 'vitest'
import { Workbook } from 'exceljs'
import { buildWorkbook, filterTasks } from './excel'
import type { Incident, Issue, Profile, Task, WeeklyReport } from './types'

const TODAY = '2026-08-04'

const profiles: Profile[] = [
  { id: 'u1', name: '홍길동', part: '개발파트', is_admin: false, last_cat_l1: null, last_cat_l2: null },
  { id: 'u2', name: '김철수', part: '운영파트', is_admin: true, last_cat_l1: null, last_cat_l2: null },
]

function task(over: Partial<Task>): Task {
  return {
    id: 1,
    name: '정산모듈 상세설계',
    cat_l1: '프로젝트',
    cat_l2: '설계',
    assignee_id: 'u1',
    start_date: '2026-08-03',
    due_date: '2026-08-07',
    deliverable: '설계서 확정',
    deliverable_link: null,
    status: 'doing',
    due_change_count: 0,
    due_change_reason: null,
    created_at: '2026-08-03T00:00:00Z',
    checkpoints: [
      { id: 1, task_id: 1, name: '설계 초안', is_done: true, done_at: '2026-08-04T01:00:00Z', sort_order: 0 },
      { id: 2, task_id: 1, name: '리뷰', is_done: false, done_at: null, sort_order: 1 },
      { id: 3, task_id: 1, name: '설계서 확정', is_done: false, done_at: null, sort_order: 2 },
    ],
    issues: [],
    progress_note: null,
    stage: 'dev',
    initial_due_date: '2026-08-07',
    is_agenda: true,
    ...over,
  }
}

const tasks: Task[] = [
  task({}),
  task({
    id: 2,
    name: '정기점검 8월',
    cat_l1: '운영',
    cat_l2: '정기점검',
    assignee_id: 'u2',
    status: 'done',
    due_change_count: 2,
    checkpoints: [
      { id: 4, task_id: 2, name: '점검 수행', is_done: true, done_at: '2026-08-04T02:00:00Z', sort_order: 0 },
      { id: 5, task_id: 2, name: '점검 결과서', is_done: true, done_at: '2026-08-05T02:00:00Z', sort_order: 1 },
    ],
  }),
]

const issues: Issue[] = [
  {
    id: 1,
    task_id: 1,
    content: '외부 연동 스펙 미확정',
    type: '대외협의',
    impact_days: 3,
    status: 'new',
    created_at: '2026-08-03T00:00:00Z',
    resolved_at: null,
    title: '외부 연동',
    needs_decision: false,
    sort_order: 0,
  },
]

const incidents: Incident[] = [
  {
    id: 1,
    occurred_at: '2026-08-03',
    title: '결제 승인 지연',
    system: 'POVAS',
    severity: 'critical',
    cause_type: '외부연동',
    action: 'PG사 재처리 요청',
    status: 'responding',
    recurrence_action: null,
    related_task_id: null,
    reporter_id: 'u1',
    resolved_at: null,
    created_at: '2026-08-03T00:00:00Z',
  },
  {
    id: 2,
    occurred_at: '2026-09-01',
    title: '기간 밖 장애',
    system: 'WEB',
    severity: 'normal',
    cause_type: null,
    action: null,
    status: 'responding',
    recurrence_action: null,
    related_task_id: null,
    reporter_id: 'u1',
    resolved_at: null,
    created_at: '2026-09-01T00:00:00Z',
  },
]

const reports: WeeklyReport[] = [
  {
    id: 1,
    user_id: 'u1',
    year_week: '2026-W32',
    comment: '특이사항 없음',
    issue_note: '연동 담당자 지정 요청',
    submitted_at: '2026-08-07T09:00:00Z',
  },
]

async function build(filterOver: Partial<Parameters<typeof buildWorkbook>[0]['filter']> = {}) {
  const blob = await buildWorkbook({
    tasks,
    issues,
    profiles,
    reports,
    incidents,
    weeks: ['2026-W32'],
    filter: { from: '2026-08-03', to: '2026-08-09', assigneeId: 'all', signal: 'all', ...filterOver },
    today: TODAY,
  })
  const wb = new Workbook()
  await wb.xlsx.load(await blob.arrayBuffer())
  return wb
}

describe('filterTasks', () => {
  const f = { from: '2026-08-03', to: '2026-08-09', assigneeId: 'all' as const, signal: 'all' as const }

  it('기간이 겹치지 않으면 제외', () => {
    expect(filterTasks(tasks, { ...f, from: '2026-09-01', to: '2026-09-30' }, TODAY)).toHaveLength(0)
  })
  it('담당자 필터', () => {
    expect(filterTasks(tasks, { ...f, assigneeId: 'u2' }, TODAY)).toHaveLength(1)
  })
  it('🔴만 필터', () => {
    // u1 업무: 실적 33% / 계획 25% → 초록. 완료 업무도 초록 → 빨강 0건
    expect(filterTasks(tasks, { ...f, signal: 'red' }, TODAY)).toHaveLength(0)
  })
})

describe('buildWorkbook', () => {
  it('시트 5개를 만든다 (v2에서 장애 추가)', async () => {
    const wb = await build()
    expect(wb.worksheets.map((w) => w.name)).toEqual(['업무현황', '주간보고', '이슈', '요약', '장애'])
  })

  it('장애 시트에 등급 배경색과 경과일이 들어간다', async () => {
    const wb = await build()
    const ws = wb.getWorksheet('장애')!
    const row = ws.getRow(2)
    const v = row.values as unknown[]
    expect(v[1]).toBe('2026-08-03')
    expect(v[2]).toBe('결제 승인 지연')
    expect(v[4]).toBe('매우심각')
    expect(v[7]).toBe('조치중')
    expect(v[9]).toBe(1) // 8/3 발생 → 8/4 기준 1일
    expect((row.getCell(4).fill as { fgColor: { argb: string } }).fgColor.argb).toBe('FFFDECEC')
  })

  it('기간 밖의 장애는 시트에 실리지 않는다', async () => {
    const wb = await build()
    const ws = wb.getWorksheet('장애')!
    // 2건 중 9월 발생분은 제외되어 데이터는 1행뿐
    expect(ws.rowCount).toBe(2)
  })

  it('모든 시트에 1행 틀고정과 자동필터가 걸린다', async () => {
    const wb = await build()
    for (const ws of wb.worksheets) {
      expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
      expect(ws.autoFilter).toBeTruthy()
      expect(ws.columns.every((c) => (c.width ?? 0) > 0)).toBe(true)
    }
  })

  it('신호 열에 배경색이 들어간다', async () => {
    const wb = await build()
    const ws = wb.getWorksheet('업무현황')!
    const cell = ws.getRow(2).getCell(11)
    expect(cell.value).toBe('🟢')
    expect((cell.fill as { fgColor: { argb: string } }).fgColor.argb).toBe('FFC6EFCE')
  })

  it('업무현황 행 값이 진척 계산과 맞는다', async () => {
    const wb = await build()
    const ws = wb.getWorksheet('업무현황')!
    const row = ws.getRow(2).values as unknown[]
    // 대분류, 중분류, 업무명, 담당자 ... 실적%, 계획%, 편차
    expect(row.slice(1, 5)).toEqual(['프로젝트', '설계', '정산모듈 상세설계', '홍길동'])
    expect(row[8]).toBe(33) // 실적 (3개 중 1개)
    expect(row[9]).toBe(25) // 계획 (8/3~8/7 중 8/4)
    expect(row[10]).toBe(8) // 편차
  })

  it('주간보고 시트에 자동 집계와 사람이 쓴 항목이 함께 들어간다', async () => {
    const wb = await build()
    const ws = wb.getWorksheet('주간보고')!
    const rows = ws.getRows(2, ws.rowCount - 1)!.map((r) => r.values as unknown[])
    const hong = rows.find((r) => r[2] === '홍길동')!
    expect(hong[1]).toBe('2026-W32')
    expect(String(hong[4])).toContain('정산모듈 상세설계') // 진행 중
    expect(hong[6]).toBe('연동 담당자 지정 요청') // 이슈 (사람 작성)
    expect(hong[7]).toBe('특이사항 없음') // 코멘트 (사람 작성)

    const kim = rows.find((r) => r[2] === '김철수')!
    expect(String(kim[3])).toContain('정기점검 8월') // 금주 완료
  })

  it('이슈 시트에 경과일이 계산된다', async () => {
    const wb = await build()
    const ws = wb.getWorksheet('이슈')!
    const row = ws.getRow(2).values as unknown[]
    expect(row[1]).toBe('외부 연동 스펙 미확정')
    expect(row[2]).toBe('정산모듈 상세설계')
    expect(row[4]).toBe(3) // 일정영향
    expect(row[7]).toBe(1) // 8/3 등록 → 8/4 기준 1일
  })

  it('요약 시트에 담당자별 행과 팀 합계 행이 있다', async () => {
    const wb = await build()
    const ws = wb.getWorksheet('요약')!
    const rows = ws.getRows(2, ws.rowCount - 1)!.map((r) => r.values as unknown[])
    expect(rows.map((r) => r[1])).toEqual(['홍길동', '김철수', '팀 합계'])

    const kim = rows.find((r) => r[1] === '김철수')!
    expect(kim[2]).toBe(1) // 전체
    expect(kim[3]).toBe(1) // 완료
    expect(kim[6]).toBe('100%') // 완료율
    expect(kim[7]).toBe('100%') // 마감준수율 (8/5 완료, 마감 8/7)
    expect(kim[8]).toBe(2) // 평균 마감변경

    const total = rows.at(-1)!
    expect(total[2]).toBe(2)
    expect(total[6]).toBe('50%')
  })
})
