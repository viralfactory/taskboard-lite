import { describe, it, expect } from 'vitest'
import { agendaRowHeight, agendaStatus, buildMonthlyReport, diffText, scheduleText } from './monthly'
import type { Incident, Issue, NextMonthPlan, Task } from './types'
import { addMonths, monthRange, recentMonths, yearMonth } from './dates'

const TODAY = '2026-08-04'
const YM = '2026-07'

function task(over: Partial<Task> = {}): Task {
  return {
    id: 1,
    name: '스마트로 단말기 키인',
    cat_l1: '개발',
    cat_l2: '기능개선',
    assignee_id: 'u1',
    start_date: '2026-07-01',
    due_date: '2026-07-13',
    deliverable: '배포',
    deliverable_link: null,
    status: 'doing',
    due_change_count: 0,
    due_change_reason: null,
    created_at: '2026-07-01T00:00:00Z',
    checkpoints: [],
    issues: [],
    progress_note: null,
    initial_due_date: '2026-07-13',
    is_agenda: true,
    parent_id: null,
    ...over,
  }
}

function incident(over: Partial<Incident> = {}): Incident {
  return {
    id: 1,
    occurred_at: '2026-07-10',
    title: '외국인 온라인 회원가입 500 오류',
    system: 'WEB',
    severity: 'critical',
    cause_type: '코드결함',
    action: null,
    status: 'responding',
    recurrence_action: null,
    related_task_id: null,
    reporter_id: 'u1',
    resolved_at: null,
    created_at: '2026-07-10T00:00:00Z',
    ...over,
  }
}

function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: 1,
    task_id: 1,
    title: '스마트로 키인 결제',
    content: '단말기 공급 일정 확정 필요',
    type: '대외협의',
    impact_days: 5,
    status: 'new',
    created_at: '2026-07-05T00:00:00Z',
    resolved_at: null,
    needs_decision: true,
    sort_order: 0,
    ...over,
  }
}

const empty = { tasks: [], incidents: [], issues: [], plans: [] as NextMonthPlan[], report: null }

// ─────────────────────────────── 6.1 상태 판정

describe('agendaStatus (6.1)', () => {
  it('완료 상태면 완료', () => {
    expect(agendaStatus(task({ status: 'done' }), TODAY)).toBe('완료')
  })

  it('진척 0% + 마감일 미도래 → 진행중', () => {
    // 「규정 위반 회원 신고」 사례: 진척 0%지만 마감 7/31이 남아 있음
    const t = task({ start_date: '2026-07-25', due_date: '2026-07-31', checkpoints: [] })
    expect(agendaStatus(t, '2026-07-26')).toBe('진행중')
  })

  it('진척 0% + 마감일 경과 → 지연', () => {
    // 「스마트로 단말기 키인」 사례: 7/13이 지남
    expect(agendaStatus(task(), TODAY)).toBe('지연')
  })

  it('편차 -20%p 미만이면 마감 전이라도 지연', () => {
    const t = task({
      start_date: '2026-08-01',
      due_date: '2026-08-11',
      initial_due_date: '2026-08-11',
      checkpoints: [
        { id: 1, task_id: 1, name: 'a', is_done: false, done_at: null, sort_order: 0 },
        { id: 2, task_id: 1, name: 'b', is_done: false, done_at: null, sort_order: 1 },
      ],
    })
    // 8/6 → 계획 50%, 실적 0% → SV -50
    expect(agendaStatus(t, '2026-08-06')).toBe('지연')
  })
})

// ─────────────────────────────── 6.2 일정 표기

function cps(...done: boolean[]) {
  const names = ['요건정의', '분석', '설계', '구현', '테스트', '배포']
  return names.map((name, i) => ({
    id: i + 1, task_id: 1, name, is_done: done[i] ?? false, done_at: null, sort_order: i,
  }))
}

describe('scheduleText (6.2) — 단계는 체크포인트에서 자동으로 나온다', () => {
  it('변경 없으면 "M/D {단계}"', () => {
    const t = task({ due_date: '2026-07-29', initial_due_date: '2026-07-29', checkpoints: cps(true, true, true) })
    expect(scheduleText(t)).toBe('7/29 구현')
  })

  it('변경됐으면 "M/D → M/D {단계}"', () => {
    const t = task({ initial_due_date: '2026-07-13', due_date: '2026-08-06', checkpoints: cps(true) })
    expect(scheduleText(t)).toBe('7/13 → 8/6 분석')
  })

  it('체크포인트가 없으면 날짜만', () => {
    expect(scheduleText(task({ initial_due_date: null, due_date: '2026-07-13' }))).toBe('7/13')
  })
})

describe('diffText', () => {
  it('증가 ▲ / 감소 △ / 동일', () => {
    expect(diffText(3)).toBe('▲3건')
    expect(diffText(-2)).toBe('△2건')
    expect(diffText(0)).toBe('동일')
  })
})

// ─────────────────────────────── 6. 매핑표 전체

describe('buildMonthlyReport', () => {
  it('보고기간을 YYYY.MM.DD ~ MM.DD 로 만든다', () => {
    expect(buildMonthlyReport(YM, empty, TODAY).periodText).toBe('2026.07.01 ~ 07.31')
  })

  it('SUMMARY 안건 — N건 (완료 n · 진행 n · 지연 n)', () => {
    const tasks = [
      task({ id: 1, status: 'done' }),
      task({ id: 2, due_date: '2026-07-31', initial_due_date: '2026-07-31', start_date: '2026-07-25' }),
      task({ id: 3 }), // 마감 7/13 경과 → 지연
    ]
    const r = buildMonthlyReport(YM, { ...empty, tasks }, '2026-07-26')
    expect(r.summary.agendaText).toBe('3건 (완료 1 · 진행 1 · 지연 1)')
  })

  it('is_agenda 가 false 인 업무는 안건에서 빠진다', () => {
    const tasks = [task({ id: 1 }), task({ id: 2, name: '정기점검', is_agenda: false })]
    const r = buildMonthlyReport(YM, { ...empty, tasks }, TODAY)
    expect(r.agendas.map((a) => a.name)).toEqual(['스마트로 단말기 키인'])
  })

  it('당월에 걸치지 않는 업무는 제외한다', () => {
    const tasks = [task({ id: 1, start_date: '2026-09-01', due_date: '2026-09-10' })]
    expect(buildMonthlyReport(YM, { ...empty, tasks }, TODAY).agendas).toHaveLength(0)
  })

  it('안건 정렬은 지연 → 진행중 → 완료', () => {
    const tasks = [
      task({ id: 1, status: 'done', name: '완료건' }),
      task({ id: 2, name: '지연건' }),
      task({ id: 3, name: '진행건', start_date: '2026-07-25', due_date: '2026-07-31', initial_due_date: '2026-07-31' }),
    ]
    const r = buildMonthlyReport(YM, { ...empty, tasks }, '2026-07-26')
    expect(r.agendas.map((a) => a.name)).toEqual(['지연건', '진행건', '완료건'])
  })

  it('안건 15건 초과 시 진척율 상위 15건만 남기고 나머지를 센다', () => {
    const tasks = Array.from({ length: 18 }, (_, i) =>
      task({
        id: i + 1,
        name: `안건${i}`,
        checkpoints: [
          { id: i * 2, task_id: i, name: 'a', is_done: i % 2 === 0, done_at: null, sort_order: 0 },
          { id: i * 2 + 1, task_id: i, name: 'b', is_done: false, done_at: null, sort_order: 1 },
        ],
      }),
    )
    const r = buildMonthlyReport(YM, { ...empty, tasks }, TODAY)
    expect(r.agendas).toHaveLength(15)
    expect(r.agendaOverflow).toBe(3)
    expect(r.summary.agendaCount).toBe(18)
  })

  it('SUMMARY 장애 — 전월 대비 증감', () => {
    const incidents = [
      incident({ id: 1, occurred_at: '2026-07-03' }),
      incident({ id: 2, occurred_at: '2026-07-20' }),
      incident({ id: 3, occurred_at: '2026-06-10' }),
    ]
    const r = buildMonthlyReport(YM, { ...empty, incidents }, TODAY)
    expect(r.summary.incidentCount).toBe(2)
    expect(r.summary.prevIncidentCount).toBe(1)
    expect(r.summary.incidentText).toBe('2건 (전월 1건 대비 ▲1건)')
  })

  it('월별 추이는 최근 7개월, 당월이 마지막', () => {
    const r = buildMonthlyReport(YM, { ...empty, incidents: [incident()] }, TODAY)
    expect(r.incidents.trend).toHaveLength(7)
    expect(r.incidents.trend.map((t) => t.month)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
    ])
    expect(r.incidents.trend.at(-1)).toMatchObject({ label: '7월', count: 1 })
  })

  it('등급별 건수는 매우심각/심각/보통 순서로 항상 3칸', () => {
    const incidents = [
      incident({ id: 1, severity: 'critical' }),
      incident({ id: 2, severity: 'normal' }),
      incident({ id: 3, severity: 'normal' }),
    ]
    const r = buildMonthlyReport(YM, { ...empty, incidents }, TODAY)
    expect(r.incidents.bySeverity).toEqual([
      { severity: 'critical', label: '매우심각', count: 1 },
      { severity: 'major', label: '심각', count: 0 },
      { severity: 'normal', label: '보통', count: 2 },
    ])
  })

  it('매우심각 목록은 "제목 (시스템)" 최대 6건', () => {
    const incidents = Array.from({ length: 8 }, (_, i) =>
      incident({ id: i + 1, title: `장애${i}`, system: i % 2 ? 'POVAS' : 'WEB', occurred_at: `2026-07-0${i + 1}` }),
    )
    const r = buildMonthlyReport(YM, { ...empty, incidents }, TODAY)
    expect(r.incidents.criticalList).toHaveLength(6)
    expect(r.incidents.criticalList[0]).toBe('장애0 (WEB)')
    expect(r.incidents.criticalOverflow).toBe(2)
  })

  it('의사결정 사항은 needs_decision 이고 미해소인 이슈만, 최대 4건', () => {
    const issues = [
      issue({ id: 1 }),
      issue({ id: 2, needs_decision: false, title: '제외돼야 함' }),
      issue({ id: 3, status: 'resolved', title: '해결됨' }),
    ]
    const r = buildMonthlyReport(YM, { ...empty, issues }, TODAY)
    expect(r.decisions).toEqual([{ title: '스마트로 키인 결제', content: '단말기 공급 일정 확정 필요' }])
  })

  it('title 이 비어 있으면 이슈 유형을 제목으로 쓴다', () => {
    const r = buildMonthlyReport(YM, { ...empty, issues: [issue({ title: null })] }, TODAY)
    expect(r.decisions[0].title).toBe('대외협의')
  })

  it('차월 계획 = 수동 입력분 + 차월 마감 업무, 최대 6건', () => {
    const tasks = [
      task({ id: 1, due_date: '2026-08-06', initial_due_date: '2026-08-06' }),
      task({ id: 2, name: '9월건', due_date: '2026-09-06' }),
      task({ id: 3, name: '완료건', due_date: '2026-08-10', status: 'done' }),
    ]
    const plans: NextMonthPlan[] = [
      { id: 1, year_month: '2026-08', content: '수동 계획', sort_order: 0 },
    ]
    const r = buildMonthlyReport(YM, { ...empty, tasks, plans }, TODAY)
    expect(r.nextPlans).toEqual(['수동 계획', '스마트로 단말기 키인 (~8/6)'])
  })

  it('monthly_reports 의 수동 입력값을 반영하고, 없으면 기본값을 쓴다', () => {
    const r1 = buildMonthlyReport(YM, empty, TODAY)
    expect(r1.orgName).toBe('WEB / POVAS 운영·개발')
    expect(r1.highlight).toBe('')

    const r2 = buildMonthlyReport(
      YM,
      {
        ...empty,
        report: {
          id: 1,
          year_month: YM,
          org_name: '테스트조직',
          author_name: '홍길동',
          report_date: '2026-08-01',
          highlight: '결제 안정화 집중',
          footnote: '각주',
          base_date: '2026-07-31',
          confirmed_at: null,
        },
      },
      TODAY,
    )
    expect(r2.orgName).toBe('테스트조직')
    expect(r2.highlight).toBe('결제 안정화 집중')
    expect(r2.authorName).toBe('홍길동')
  })
})

describe('agendaRowHeight', () => {
  it('12건 이하면 0.44, 초과면 0.38', () => {
    expect(agendaRowHeight(12)).toBe(0.44)
    expect(agendaRowHeight(13)).toBe(0.38)
  })
})

describe('월 단위 날짜 유틸', () => {
  it('monthRange / addMonths / recentMonths / yearMonth', () => {
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(monthRange('2026-07')).toEqual({ start: '2026-07-01', end: '2026-07-31' })
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(recentMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(yearMonth('2026-08-04')).toBe('2026-08')
  })
})
