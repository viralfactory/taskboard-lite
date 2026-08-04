// 날짜 유틸. 모두 'YYYY-MM-DD' 문자열과 로컬 자정 Date 사이에서만 오간다.
// (타임존 때문에 new Date('2026-08-04') 를 직접 쓰지 않는다)

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function todayStr(): string {
  return fmt(new Date())
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return fmt(d)
}

/** a → b 일수 (b - a) */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)
}

/** 기준일이 속한 주의 금요일 (금·토·일이면 그 주의 금요일 그대로) */
export function thisFriday(base = todayStr()): string {
  const d = parseDate(base)
  const dow = d.getDay() // 0=일
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  return addDays(base, mondayOffset + 4)
}

export function nextFriday(base = todayStr()): string {
  return addDays(thisFriday(base), 7)
}

export function endOfMonth(base = todayStr()): string {
  const d = parseDate(base)
  return fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/** 기준일이 속한 주의 월요일 */
export function mondayOf(base = todayStr()): string {
  const dow = parseDate(base).getDay()
  return addDays(base, dow === 0 ? -6 : 1 - dow)
}

export function sundayOf(base = todayStr()): string {
  return addDays(mondayOf(base), 6)
}

/** ISO 8601 주차 문자열 — '2026-W32' */
export function isoWeek(base = todayStr()): string {
  // 그 주 목요일이 속한 해가 ISO 기준 연도
  const thuStr = addDays(mondayOf(base), 3)
  const year = parseDate(thuStr).getFullYear()
  const week = Math.floor(diffDays(`${year}-01-01`, thuStr) / 7) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** '2026-W32' → 그 주 월요일 */
export function weekStart(yearWeek: string): string {
  const [y, w] = yearWeek.split('-W')
  const jan4 = new Date(Number(y), 0, 4)
  const mondayOfW1 = mondayOf(fmt(jan4))
  return addDays(mondayOfW1, (Number(w) - 1) * 7)
}

export function weekRange(yearWeek: string): { start: string; end: string } {
  const start = weekStart(yearWeek)
  return { start, end: addDays(start, 6) }
}

export function addWeeks(yearWeek: string, n: number): string {
  return isoWeek(addDays(weekStart(yearWeek), n * 7))
}

/**
 * 복제 등록의 '다음 주기' 날짜.
 * 원래 기간(span)은 유지한 채 오늘부터 다시 시작한다 — 정기 반복 업무에서 가장 예측 가능한 규칙.
 */
export function nextCycleDates(start: string, due: string, today = todayStr()) {
  const span = Math.max(0, diffDays(start, due))
  return { start: today, due: addDays(today, span) }
}

// ─────────────────────────────── v2: 월 단위

/** 'YYYY-MM' */
export function yearMonth(base = todayStr()): string {
  return base.slice(0, 7)
}

export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number)
  return { start: `${ym}-01`, end: fmt(new Date(y, m, 0)) }
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 최근 n개월 (ym 포함, 오래된 것부터) */
export function recentMonths(ym: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(ym, i - (n - 1)))
}

/** 'M/D' — 보고서 일정 표기용 */
export function mdOf(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}
