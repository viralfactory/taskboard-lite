import { describe, it, expect } from 'vitest'
import { calcActualPct, calcPlanPct, getSignal, progressOf } from './progress'
import { isoWeek, thisFriday, nextFriday, endOfMonth, weekRange, nextCycleDates } from './dates'

describe('calcActualPct', () => {
  it('체크포인트가 없으면 0', () => {
    expect(calcActualPct([])).toBe(0)
  })
  it('완료 비율을 반올림한다', () => {
    expect(calcActualPct([{ is_done: true }, { is_done: false }])).toBe(50)
    expect(calcActualPct([{ is_done: true }, { is_done: true }, { is_done: false }])).toBe(67)
    expect(calcActualPct([{ is_done: true }, { is_done: true }])).toBe(100)
  })
})

describe('calcPlanPct', () => {
  it('경과일 비율을 낸다', () => {
    expect(calcPlanPct('2026-08-01', '2026-08-11', '2026-08-06')).toBe(50)
    expect(calcPlanPct('2026-08-01', '2026-08-11', '2026-08-01')).toBe(0)
    expect(calcPlanPct('2026-08-01', '2026-08-11', '2026-08-11')).toBe(100)
  })
  it('0~100 으로 자른다', () => {
    expect(calcPlanPct('2026-08-01', '2026-08-11', '2026-07-20')).toBe(0)
    expect(calcPlanPct('2026-08-01', '2026-08-11', '2026-09-01')).toBe(100)
  })
  it('시작=마감 당일 업무', () => {
    expect(calcPlanPct('2026-08-04', '2026-08-04', '2026-08-04')).toBe(100)
    expect(calcPlanPct('2026-08-04', '2026-08-04', '2026-08-03')).toBe(0)
  })
})

describe('getSignal', () => {
  const base = { dueDate: '2026-08-31', status: 'doing' as const, today: '2026-08-04' }

  it('SV >= -5 이면 초록', () => {
    expect(getSignal({ ...base, actualPct: 50, planPct: 50 })).toBe('green')
    expect(getSignal({ ...base, actualPct: 45, planPct: 50 })).toBe('green')
  })
  it('-20 <= SV < -5 이면 노랑', () => {
    expect(getSignal({ ...base, actualPct: 44, planPct: 50 })).toBe('yellow')
    expect(getSignal({ ...base, actualPct: 30, planPct: 50 })).toBe('yellow')
  })
  it('SV < -20 이면 빨강', () => {
    expect(getSignal({ ...base, actualPct: 29, planPct: 50 })).toBe('red')
  })
  it('마감일 초과 & 미완료면 무조건 빨강', () => {
    expect(
      getSignal({ actualPct: 90, planPct: 90, dueDate: '2026-08-01', status: 'doing', today: '2026-08-04' }),
    ).toBe('red')
  })
  it('완료된 업무는 마감이 지나도 초록', () => {
    expect(
      getSignal({ actualPct: 100, planPct: 100, dueDate: '2026-08-01', status: 'done', today: '2026-08-04' }),
    ).toBe('green')
  })
})

describe('progressOf', () => {
  it('실적·계획·편차·신호를 한 번에 낸다', () => {
    const r = progressOf(
      {
        start_date: '2026-08-01',
        due_date: '2026-08-11',
        status: 'doing',
        checkpoints: [{ is_done: true }, { is_done: false }, { is_done: false }, { is_done: false }],
      },
      '2026-08-06',
    )
    expect(r.actualPct).toBe(25)
    expect(r.planPct).toBe(50)
    expect(r.sv).toBe(-25)
    expect(r.signal).toBe('red')
  })
})

describe('dates', () => {
  it('이번주 금요일 / 다음주 금요일', () => {
    // 2026-08-04 는 화요일
    expect(thisFriday('2026-08-04')).toBe('2026-08-07')
    expect(nextFriday('2026-08-04')).toBe('2026-08-14')
    // 일요일은 그 주(직전 월요일 기준)의 금요일
    expect(thisFriday('2026-08-09')).toBe('2026-08-07')
  })
  it('이달 말', () => {
    expect(endOfMonth('2026-08-04')).toBe('2026-08-31')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
  })
  it('ISO 주차', () => {
    expect(isoWeek('2026-08-04')).toBe('2026-W32')
    expect(isoWeek('2026-01-01')).toBe('2026-W01')
    expect(isoWeek('2027-01-01')).toBe('2026-W53')
    expect(isoWeek('2025-12-31')).toBe('2026-W01')
  })
  it('주차 → 기간', () => {
    expect(weekRange('2026-W32')).toEqual({ start: '2026-08-03', end: '2026-08-09' })
  })
  it('복제 시 기간 유지, 오늘부터', () => {
    expect(nextCycleDates('2026-07-01', '2026-07-08', '2026-08-04')).toEqual({
      start: '2026-08-04',
      due: '2026-08-11',
    })
  })
})
