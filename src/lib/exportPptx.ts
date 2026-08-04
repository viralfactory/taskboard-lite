// 월간보고 PPTX 1슬라이드 (SPEC-V2 7장). 브라우저에서 직접 생성한다. 서버 호출 없음.
//
// 주의 (pptxgenjs):
//   - 색상 hex 에 '#' 을 붙이면 파일이 깨진다. 8자리 hex 도 금지.
//   - 옵션 객체를 여러 addText 에 재사용하지 말 것 (내부에서 변형됨).
// 라이브러리가 무거우므로 다운로드 시점에 동적으로 불러온다.

import type PptxGenJS from 'pptxgenjs'
import { agendaRowHeight, type MonthlyData } from './monthly'

const NAVY = '1F3864'
const ICE_L = 'EAF1FA'
const LINE = 'D6DEEA'
const TXT = '222222'
const MUT = '7A8699'
const OK_BG = 'D9F2E6'
const OK_TX = '1E7A5A'
const ING_BG = '1F3864'
const ING_TX = 'FFFFFF'
const DLY_BG = 'FBE0E0'
const DLY_TX = 'C0392B'
const BAR = '2E7D5B'
const SEV1 = 'C0392B'
const SEV1_BG = 'FDECEC'
const SEV2 = 'B7791F'
const SEV2_BG = 'FDF6E3'
const SEV3 = '1E7A5A'
const SEV3_BG = 'E4F5EE'

const FONT = '맑은 고딕'

const STATUS_STYLE: Record<string, { bg: string; tx: string }> = {
  완료: { bg: OK_BG, tx: OK_TX },
  진행중: { bg: ING_BG, tx: ING_TX },
  지연: { bg: DLY_BG, tx: DLY_TX },
}

const SEV_STYLE = [
  { color: SEV1, bg: SEV1_BG },
  { color: SEV2, bg: SEV2_BG },
  { color: SEV3, bg: SEV3_BG },
]

/** 섹션 1 표 열 너비 (인치) */
const COL = { name: 1.85, note: 3.3, status: 0.9, pct: 0.95, sched: 1.06 }
const TABLE_X = 0.42
const TABLE_Y = 1.78
const TABLE_W = 8.06
const HEADER_H = 0.34
/** 섹션 3 상단 y. 표가 이 선을 넘지 않아야 한다. */
const SECTION3_Y = 5.55

export async function exportMonthlyPptx(d: MonthlyData): Promise<void> {
  const pres = await __buildPresentation(d)
  await pres.writeFile({ fileName: `활동_월간요약보고서_${d.yearMonth}.pptx` })
}

/** 슬라이드 구성만 수행한다 (테스트에서 파일 바이트를 검사하기 위해 분리) */
export async function __buildPresentation(d: MonthlyData): Promise<PptxGenJS> {
  const { default: Pptx } = await import('pptxgenjs')
  const pres = new Pptx()
  pres.defineLayout({ name: 'A4WIDE', width: 13.333, height: 7.5 })
  pres.layout = 'A4WIDE'

  const s = pres.addSlide()
  const monthNum = Number(d.yearMonth.slice(5, 7))

  // ── 헤더
  s.addText('활동 월간 요약 보고서', {
    x: 0.4, y: 0.18, w: 6.5, h: 0.55,
    fontSize: 32, bold: true, color: NAVY, fontFace: FONT,
  })
  s.addText(d.orgName, {
    x: 0.42, y: 0.72, w: 5.0, h: 0.28,
    fontSize: 12, color: MUT, fontFace: FONT,
  })

  s.addShape(pres.ShapeType.rect, {
    x: 8.3, y: 0.16, w: 4.6, h: 0.62,
    fill: { color: 'FFFFFF' }, line: { color: LINE, width: 1 },
  })
  s.addText(
    [
      { text: '보고기간  ', options: { color: MUT } },
      { text: d.periodText, options: { color: TXT, bold: true } },
      { text: '\n작성자  ', options: { color: MUT } },
      { text: d.authorName || '-', options: { color: TXT } },
      { text: '    보고일  ', options: { color: MUT } },
      { text: d.reportDate || '-', options: { color: TXT } },
    ],
    { x: 8.45, y: 0.22, w: 4.3, h: 0.5, fontSize: 10.5, fontFace: FONT, lineSpacingMultiple: 1.1 },
  )

  // ── MONTHLY SUMMARY 밴드
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.42, y: 0.9, w: 12.45, h: 0.45,
    fill: { color: ICE_L }, line: { color: ICE_L }, rectRadius: 0.08,
  })
  s.addText(
    [
      { text: 'MONTHLY SUMMARY   ', options: { color: NAVY, bold: true, fontSize: 10 } },
      { text: '개발 안건 ', options: { color: MUT, fontSize: 11 } },
      { text: d.summary.agendaText, options: { color: TXT, bold: true, fontSize: 11 } },
      { text: '     장애 ', options: { color: MUT, fontSize: 11 } },
      { text: d.summary.incidentText, options: { color: TXT, bold: true, fontSize: 11 } },
      ...(d.highlight
        ? [
            { text: '     중점 ', options: { color: MUT, fontSize: 11 } },
            { text: d.highlight, options: { color: TXT, bold: true, fontSize: 11 } },
          ]
        : []),
    ],
    { x: 0.62, y: 0.9, w: 12.1, h: 0.45, fontFace: FONT, valign: 'middle' },
  )

  // ── 1. 개발 안건별 진행 현황
  s.addText('1. 개발 안건별 진행 현황', {
    x: 0.5, y: 1.4, w: 5.0, h: 0.32,
    fontSize: 14, bold: true, color: NAVY, fontFace: FONT,
  })
  drawAgendaTable(pres, s, d)

  // ── 2. 장애 발생 추이
  s.addText('2. 장애 발생 추이', {
    x: 8.78, y: 1.4, w: 4.0, h: 0.32,
    fontSize: 14, bold: true, color: NAVY, fontFace: FONT,
  })
  s.addShape(pres.ShapeType.rect, {
    x: 8.7, y: 1.78, w: 4.2, h: 3.55,
    fill: { color: 'FFFFFF' }, line: { color: LINE, width: 1 },
  })
  drawTrendChart(pres, s, d)
  drawSeverityCards(pres, s, d)
  drawCriticalList(s, d)

  // ── 3. 주요 이슈 및 의사결정 필요 사항
  s.addText('3. 주요 이슈 및 의사결정 필요 사항', {
    x: 0.5, y: SECTION3_Y, w: 6.0, h: 0.32,
    fontSize: 14, bold: true, color: NAVY, fontFace: FONT,
  })
  s.addShape(pres.ShapeType.rect, {
    x: 0.42, y: 5.92, w: 8.06, h: 1.15,
    fill: { color: 'F7F9FC' }, line: { color: LINE, width: 1 },
  })
  if (d.decisions.length) {
    s.addText(
      d.decisions.flatMap((x, i) => [
        { text: `${x.title}  `, options: { bold: true, color: TXT, breakLine: false } },
        { text: x.content + (i < d.decisions.length - 1 ? '\n' : ''), options: { color: MUT } },
      ]),
      { x: 0.58, y: 6.0, w: 7.75, h: 1.0, fontSize: 10, fontFace: FONT, lineSpacingMultiple: 1.15 },
    )
  } else {
    s.addText('해당 없음', { x: 0.58, y: 6.0, w: 7.75, h: 0.3, fontSize: 10, color: MUT, fontFace: FONT })
  }

  // ── 4. 차월 계획
  s.addText(`4. 차월(${monthNum === 12 ? 1 : monthNum + 1}월) 계획`, {
    x: 8.78, y: SECTION3_Y, w: 4.0, h: 0.32,
    fontSize: 14, bold: true, color: NAVY, fontFace: FONT,
  })
  s.addShape(pres.ShapeType.rect, {
    x: 8.7, y: 5.92, w: 4.2, h: 1.15,
    fill: { color: 'F7F9FC' }, line: { color: LINE, width: 1 },
  })
  s.addText(d.nextPlans.length ? d.nextPlans.map((p) => `· ${p}`).join('\n') : '· 등록된 계획 없음', {
    x: 8.86, y: 6.0, w: 3.9, h: 1.0, fontSize: 10, color: TXT, fontFace: FONT, lineSpacingMultiple: 1.15,
  })

  // ── 각주
  const foot = [d.footnote, d.baseDate ? `기준일 ${d.baseDate}` : '', d.agendaOverflow ? `외 ${d.agendaOverflow}건` : '']
    .filter(Boolean)
    .join('  ·  ')
  s.addText(foot, { x: 0.42, y: 7.14, w: 9.0, h: 0.25, fontSize: 9, color: MUT, fontFace: FONT })
  s.addText(d.orgName, {
    x: 10.5, y: 7.14, w: 2.4, h: 0.25,
    fontSize: 9, color: MUT, align: 'right', fontFace: FONT,
  })

  return pres
}

// ─────────────────────────────── 섹션 1 표

function drawAgendaTable(pres: PptxGenJS, s: PptxGenJS.Slide, d: MonthlyData) {
  const heads = ['안건', '주요 진행 내용', '상태', '진척율', '일정']
  const widths = [COL.name, COL.note, COL.status, COL.pct, COL.sched]
  const xs: number[] = []
  let acc = TABLE_X
  for (const w of widths) {
    xs.push(acc)
    acc += w
  }

  // 헤더
  s.addShape(pres.ShapeType.rect, {
    x: TABLE_X, y: TABLE_Y, w: TABLE_W, h: HEADER_H,
    fill: { color: NAVY }, line: { color: NAVY },
  })
  heads.forEach((h, i) => {
    s.addText(h, {
      x: xs[i], y: TABLE_Y, w: widths[i], h: HEADER_H,
      fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT,
      align: i <= 1 ? 'left' : 'center', valign: 'middle',
      margin: i <= 1 ? [0, 0, 0, 6] : 0,
    })
  })

  // 표가 섹션3을 침범하지 않도록 행 높이를 조정한다
  const available = SECTION3_Y - 0.1 - (TABLE_Y + HEADER_H)
  const n = d.agendas.length
  const rowH = n ? Math.min(agendaRowHeight(n), available / n) : agendaRowHeight(n)

  d.agendas.forEach((row, r) => {
    const y = TABLE_Y + HEADER_H + r * rowH
    const st = STATUS_STYLE[row.status]

    s.addText(row.name, {
      x: xs[0], y, w: widths[0], h: rowH,
      fontSize: 10, bold: true, color: TXT, fontFace: FONT, valign: 'middle',
      margin: [0, 2, 0, 6], shrinkText: true,
    })
    s.addText(row.progressNote, {
      x: xs[1], y, w: widths[1], h: rowH,
      fontSize: 9.5, color: MUT, fontFace: FONT, valign: 'middle',
      margin: [0, 4, 0, 4], shrinkText: true,
    })

    // 상태 배지
    const badgeH = Math.min(0.24, rowH - 0.1)
    s.addShape(pres.ShapeType.roundRect, {
      x: xs[2] + 0.11, y: y + (rowH - badgeH) / 2, w: widths[2] - 0.22, h: badgeH,
      fill: { color: st.bg }, line: { color: st.bg }, rectRadius: 0.06,
    })
    s.addText(row.status, {
      x: xs[2] + 0.11, y: y + (rowH - badgeH) / 2, w: widths[2] - 0.22, h: badgeH,
      fontSize: 9, bold: true, color: st.tx, align: 'center', valign: 'middle', fontFace: FONT,
    })

    // 진척율 + 진행바
    s.addText(`${row.pct}%`, {
      x: xs[3], y: y + rowH * 0.12, w: widths[3], h: rowH * 0.45,
      fontSize: 10, bold: true, color: TXT, align: 'center', valign: 'middle', fontFace: FONT,
    })
    const barW = widths[3] - 0.24
    const barY = y + rowH * 0.64
    s.addShape(pres.ShapeType.rect, {
      x: xs[3] + 0.12, y: barY, w: barW, h: 0.06,
      fill: { color: 'EEEEEE' }, line: { color: 'EEEEEE' },
    })
    if (row.pct > 0) {
      s.addShape(pres.ShapeType.rect, {
        x: xs[3] + 0.12, y: barY, w: (barW * Math.min(100, row.pct)) / 100, h: 0.06,
        fill: { color: BAR }, line: { color: BAR },
      })
    }

    s.addText(row.schedule, {
      x: xs[4], y, w: widths[4], h: rowH,
      fontSize: 10, color: TXT, align: 'center', valign: 'middle', fontFace: FONT, shrinkText: true,
    })

    // 행 구분선
    s.addShape(pres.ShapeType.line, {
      x: TABLE_X, y: y + rowH, w: TABLE_W, h: 0,
      line: { color: LINE, width: 0.75 },
    })
  })

  if (!d.agendas.length) {
    s.addText('등록된 안건이 없습니다', {
      x: TABLE_X, y: TABLE_Y + HEADER_H + 0.1, w: TABLE_W, h: 0.3,
      fontSize: 10, color: MUT, align: 'center', fontFace: FONT,
    })
  }
}

// ─────────────────────────────── 섹션 2

function drawTrendChart(pres: PptxGenJS, s: PptxGenJS.Slide, d: MonthlyData) {
  const labels = d.incidents.trend.map((t) => t.label)
  const values = d.incidents.trend.map((t) => t.count)
  // 단일 시리즈에 색 배열을 주면 데이터포인트별로 적용된다. 당월(마지막)만 강조.
  const colors = d.incidents.trend.map((_, i) => (i === d.incidents.trend.length - 1 ? NAVY : 'B9C6DC'))

  s.addChart(
    pres.ChartType.bar,
    [{ name: '장애 건수', labels, values }],
    {
      x: 8.85, y: 2.15, w: 3.9, h: 1.55,
      barDir: 'col',
      chartColors: colors,
      showValue: true,
      dataLabelPosition: 'outEnd',
      dataLabelFontSize: 9,
      dataLabelFontFace: FONT,
      showLegend: false,
      valAxisHidden: true,
      catAxisLabelFontFace: FONT,
      catAxisLabelFontSize: 9,
      catGridLine: { style: 'none' },
      valGridLine: { style: 'none' },
    },
  )
}

function drawSeverityCards(pres: PptxGenJS, s: PptxGenJS.Slide, d: MonthlyData) {
  d.incidents.bySeverity.forEach((sv, i) => {
    const style = SEV_STYLE[i]
    const x = 8.85 + i * 1.32
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 3.85, w: 1.24, h: 0.62,
      fill: { color: style.bg }, line: { color: style.color, width: 1 }, rectRadius: 0.06,
    })
    s.addText(sv.label, {
      x, y: 3.89, w: 1.24, h: 0.22,
      fontSize: 10, bold: true, color: style.color, align: 'center', fontFace: FONT,
    })
    s.addText(`${sv.count}건`, {
      x, y: 4.11, w: 1.24, h: 0.32,
      fontSize: 15, bold: true, color: style.color, align: 'center', fontFace: FONT,
    })
  })
}

function drawCriticalList(s: PptxGenJS.Slide, d: MonthlyData) {
  const list = d.incidents.criticalList
  const text = list.length
    ? list.map((t) => `· ${t}`).join('\n') + (d.incidents.criticalOverflow ? `\n· 외 ${d.incidents.criticalOverflow}건` : '')
    : '· 매우심각 장애 없음'
  s.addText(text, {
    x: 8.85, y: 4.62, w: 3.9, h: 0.9,
    fontSize: 9, color: TXT, fontFace: FONT, lineSpacingMultiple: 1.1, shrinkText: true,
  })
}
