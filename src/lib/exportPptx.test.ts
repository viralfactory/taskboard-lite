import { describe, it, expect, beforeAll } from 'vitest'
import { buildMonthlyReport } from './monthly'
import type { Incident, Issue, NextMonthPlan, Task } from './types'

// PPTX 생성은 브라우저 API(writeFile) 를 쓰므로, 여기서는 슬라이드 구성 로직을
// 직접 호출해 pptxgenjs 가 실제로 파일을 만들 수 있는지(= 손상되지 않는지) 확인한다.
// SPEC-V2 검증 9번 "PowerPoint 에서 정상 열림" 의 자동화 가능한 부분이다.

const YM = '2026-07'
const TODAY = '2026-08-04'

function task(over: Partial<Task> = {}): Task {
  return {
    id: 1, name: '스마트로 단말기 키인', cat_l1: '개발', cat_l2: '기능개선',
    assignee_id: 'u1', start_date: '2026-07-01', due_date: '2026-07-13',
    deliverable: '배포', deliverable_link: null, status: 'doing',
    due_change_count: 0, due_change_reason: null, created_at: '2026-07-01T00:00:00Z',
    checkpoints: [], issues: [],
    progress_note: '결제 연동 개발 완료, 운영 반영 대기',
    stage: 'dev', initial_due_date: '2026-07-13', is_agenda: true,
    ...over,
  }
}

function incident(over: Partial<Incident> = {}): Incident {
  return {
    id: 1, occurred_at: '2026-07-10', title: '외국인 온라인 회원가입 500 오류',
    system: 'WEB', severity: 'critical', cause_type: '코드결함', action: null,
    status: 'responding', recurrence_action: null, related_task_id: null,
    reporter_id: 'u1', resolved_at: null, created_at: '2026-07-10T00:00:00Z',
    ...over,
  }
}

const issues: Issue[] = [
  {
    id: 1, task_id: 1, title: '스마트로 키인 결제', content: '단말기 공급 일정 확정 필요',
    type: '대외협의', impact_days: 5, status: 'new',
    created_at: '2026-07-05T00:00:00Z', resolved_at: null,
    needs_decision: true, sort_order: 0,
  },
]

const plans: NextMonthPlan[] = [{ id: 1, year_month: '2026-08', content: '결제 안정화', sort_order: 0 }]

/** exportPptx.ts 의 슬라이드 구성부를 node 에서 그대로 실행해 파일 바이트를 얻는다 */
async function renderToBuffer(agendaCount: number) {
  const tasks = Array.from({ length: agendaCount }, (_, i) =>
    task({
      id: i + 1,
      name: `안건 ${i + 1}`,
      initial_due_date: i % 2 ? '2026-07-13' : '2026-07-29',
      due_date: i % 2 ? '2026-08-06' : '2026-07-29',
      checkpoints: [
        { id: i * 2 + 1, task_id: i + 1, name: 'a', is_done: true, done_at: '2026-07-20T00:00:00Z', sort_order: 0 },
        { id: i * 2 + 2, task_id: i + 1, name: 'b', is_done: i % 3 === 0, done_at: null, sort_order: 1 },
      ],
    }),
  )
  const incidents = [
    incident({ id: 1, occurred_at: '2026-07-03' }),
    incident({ id: 2, occurred_at: '2026-07-11', severity: 'major', title: '조회 화면 오류' }),
    incident({ id: 3, occurred_at: '2026-06-15' }),
    incident({ id: 4, occurred_at: '2026-05-15', severity: 'normal' }),
  ]
  const data = buildMonthlyReport(
    YM,
    {
      tasks, incidents, issues, plans,
      report: {
        id: 1, year_month: YM, org_name: 'WEB / POVAS 운영·개발', author_name: '홍길동',
        report_date: '2026-08-01', highlight: '결제 안정화 집중',
        footnote: '데이터 출처 : 월말 Error 리포트', base_date: '2026-07-31', confirmed_at: null,
      },
    },
    TODAY,
  )

  // exportMonthlyPptx 는 writeFile 로 끝나므로, 같은 구성으로 만든 뒤 바이트를 뽑는다
  const mod = await import('./exportPptx')
  const pres = await mod.__buildPresentation(data)
  return { data, buf: (await pres.write({ outputType: 'nodebuffer' })) as Buffer }
}

let xml: { chart: string; sheet: string; buf: Buffer }

beforeAll(async () => {
  const { buf } = await renderToBuffer(6)
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buf)
  const chartFile = Object.keys(zip.files).find((f) => f.includes('charts/chart'))!
  xml = {
    chart: await zip.file(chartFile)!.async('string'),
    sheet: await zip.file('ppt/slides/slide1.xml')!.async('string'),
    buf,
  }
}, 60_000)

describe('PPTX 생성', () => {
  it('유효한 pptx zip 이 만들어진다 (손상 없음)', () => {
    // PK 시그니처 + 필수 파트 존재
    expect(xml.buf.subarray(0, 2).toString()).toBe('PK')
    expect(xml.sheet).toContain('<p:sld')
  })

  it('슬라이드에 4개 섹션 제목이 모두 들어간다', () => {
    for (const t of [
      '활동 월간 요약 보고서',
      '1. 개발 안건별 진행 현황',
      '2. 장애 발생 추이',
      '3. 주요 이슈 및 의사결정 필요 사항',
      '4. 차월(8월) 계획',
    ]) {
      expect(xml.sheet).toContain(t)
    }
  })

  it('SUMMARY 밴드에 집계값이 들어간다', () => {
    expect(xml.sheet).toContain('MONTHLY SUMMARY')
    expect(xml.sheet).toContain('전월 1건 대비 ▲1건')
  })

  it('일정 칸이 6.2 형식으로 들어간다', () => {
    expect(xml.sheet).toContain('7/13 → 8/6 dev')
    expect(xml.sheet).toContain('7/29 dev')
  })

  it('의사결정 사항과 차월 계획이 들어간다', () => {
    expect(xml.sheet).toContain('스마트로 키인 결제')
    expect(xml.sheet).toContain('결제 안정화')
  })

  it('색상 hex 에 # 이나 8자리가 섞이지 않는다', () => {
    // srgbClr val 은 반드시 6자리 hex
    const vals = [...xml.sheet.matchAll(/srgbClr val="([^"]+)"/g)].map((m) => m[1])
    expect(vals.length).toBeGreaterThan(0)
    expect(vals.every((v) => /^[0-9A-Fa-f]{6}$/.test(v))).toBe(true)
  })

  it('차트가 7개월 카테고리를 갖는다', () => {
    for (const m of ['1월', '5월', '6월', '7월']) expect(xml.chart).toContain(m)
  })

  it('차트 막대가 데이터포인트별 색을 갖고 당월만 NAVY 로 강조된다', () => {
    // pptxgenjs 가 chartColors 배열을 dPt 로 펼쳤는지 확인
    const dPtCount = (xml.chart.match(/<c:dPt>/g) ?? []).length
    expect(dPtCount).toBe(7)
    const colors = [...xml.chart.matchAll(/<c:dPt>[\s\S]*?srgbClr val="([0-9A-F]{6})"/g)].map((m) => m[1])
    expect(colors).toEqual(['B9C6DC', 'B9C6DC', 'B9C6DC', 'B9C6DC', 'B9C6DC', 'B9C6DC', '1F3864'])
  })
})

describe('표 넘침 방지', () => {
  it('안건 15건이어도 표가 섹션3(y=5.55)을 넘지 않는다', async () => {
    const { data, buf } = await renderToBuffer(20)
    expect(data.agendas).toHaveLength(15)
    expect(data.agendaOverflow).toBe(5)

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buf)
    const sheet = await zip.file('ppt/slides/slide1.xml')!.async('string')
    // EMU: 1인치 = 914400. 표 영역 도형들의 최대 y+h 가 5.55인치를 넘지 않아야 한다
    const limit = Math.round(5.55 * 914400)
    const offs = [...sheet.matchAll(/<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)]
    const tableBottom = offs
      .map((m) => ({ x: +m[1], y: +m[2], cy: +m[4] }))
      // 표 영역(x < 8.5인치)에서 표 시작(y>=1.78인치) 이후 ~ 섹션3 위쪽에 놓인 도형들
      .filter((o) => o.x < 8.5 * 914400 && o.y >= 1.78 * 914400 && o.y < limit)
      .reduce((mx, o) => Math.max(mx, o.y + o.cy), 0)
    expect(tableBottom).toBeLessThanOrEqual(limit)
  }, 60_000)
})
