import { describe, it, expect } from 'vitest'
import { newItemsSince, snapshotItems } from './daily'
import { dowOf, isWorkday, lastWorkday, localDateOf } from './dates'
import type { Task } from './types'

/** KST 기준으로 만든 ISO 문자열 (테스트 환경 타임존과 무관하게 동작하도록 로컬 시각으로 생성) */
function at(date: string, hour: number, min = 0): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, min).toISOString()
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 1,
    name: '정산모듈 설계',
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
    checkpoints: [],
    issues: [],
    progress_note: null,
    stage: 'dev',
    initial_due_date: '2026-08-07',
    is_agenda: true,
    ...over,
  }
}

function cp(id: number, name: string, done: string | null) {
  return { id, task_id: 1, name, is_done: !!done, done_at: done, sort_order: id }
}

describe('snapshotItems — To Do', () => {
  it('미완료 체크포인트를 업무명과 함께 올린다', () => {
    const t = task({ checkpoints: [cp(1, '설계 초안', at('2026-08-04', 10)), cp(2, '리뷰', null)] })
    const items = snapshotItems([t], 'u1', '2026-08-05')
    const todo = items.filter((i) => i.section === 'todo')
    expect(todo).toHaveLength(1)
    expect(todo[0].label).toBe('정산모듈 설계 — 리뷰')
    expect(todo[0].checkpoint_id).toBe(2)
  })

  it('아직 시작하지 않은 업무는 제외한다', () => {
    const t = task({ start_date: '2026-08-10', checkpoints: [cp(1, '설계', null)] })
    expect(snapshotItems([t], 'u1', '2026-08-05')).toHaveLength(0)
  })

  it('마감이 지난 미완료 업무는 계속 To Do 에 남는다', () => {
    const t = task({ due_date: '2026-08-01', checkpoints: [cp(1, '설계', null)] })
    expect(snapshotItems([t], 'u1', '2026-08-05').filter((i) => i.section === 'todo')).toHaveLength(1)
  })

  it('보류·완료 업무의 남은 체크포인트는 올리지 않는다', () => {
    const hold = task({ id: 2, status: 'hold', checkpoints: [cp(1, '설계', null)] })
    const done = task({ id: 3, status: 'done', checkpoints: [cp(2, '설계', null)] })
    expect(snapshotItems([hold, done], 'u1', '2026-08-05').filter((i) => i.section === 'todo')).toHaveLength(0)
  })

  it('체크포인트가 없는 진행 업무는 업무명 자체를 올린다', () => {
    const items = snapshotItems([task({ checkpoints: [] })], 'u1', '2026-08-05')
    expect(items).toEqual([
      { section: 'todo', label: '정산모듈 설계', task_id: 1, checkpoint_id: null, is_done: false, sort_order: 0 },
    ])
  })

  it('남의 업무는 가져오지 않는다', () => {
    const t = task({ assignee_id: 'u2', checkpoints: [cp(1, '설계', null)] })
    expect(snapshotItems([t], 'u1', '2026-08-05')).toHaveLength(0)
  })
})

describe('snapshotItems — Done', () => {
  it('그날 체크한 체크포인트만 올린다', () => {
    const t = task({
      checkpoints: [
        cp(1, '설계 초안', at('2026-08-04', 15)), // 어제
        cp(2, '리뷰', at('2026-08-05', 11)), // 오늘
        cp(3, '설계서 확정', null),
      ],
    })
    const done = snapshotItems([t], 'u1', '2026-08-05').filter((i) => i.section === 'done')
    expect(done.map((d) => d.label)).toEqual(['정산모듈 설계 — 리뷰'])
  })

  it('완료된 업무의 그날 체크분도 Done 에 올린다', () => {
    const t = task({ status: 'done', checkpoints: [cp(1, '설계', at('2026-08-05', 9))] })
    const items = snapshotItems([t], 'u1', '2026-08-05')
    expect(items.filter((i) => i.section === 'done')).toHaveLength(1)
    expect(items.filter((i) => i.section === 'todo')).toHaveLength(0)
  })

  it('이른 아침에 체크한 항목이 전날로 밀리지 않는다', () => {
    // UTC 절삭이면 08:00 KST → 전날로 잡히던 자리
    const t = task({ checkpoints: [cp(1, '설계', at('2026-08-05', 8))] })
    const done = snapshotItems([t], 'u1', '2026-08-05').filter((i) => i.section === 'done')
    expect(done).toHaveLength(1)
  })
})

describe('newItemsSince', () => {
  const t = task({ checkpoints: [cp(1, '설계 초안', null), cp(2, '리뷰', null)] })

  it('일지에 이미 있는 항목은 다시 넣지 않는다', () => {
    const snap = snapshotItems([t], 'u1', '2026-08-05')
    const existing = [{ task_id: 1, checkpoint_id: 1, label: '정산모듈 설계 — 설계 초안' }]
    const fresh = newItemsSince(snap, existing)
    expect(fresh.map((f) => f.label)).toEqual(['정산모듈 설계 — 리뷰'])
  })

  it('사용자가 라벨을 고쳤어도 같은 체크포인트면 중복으로 넣지 않는다', () => {
    const snap = snapshotItems([t], 'u1', '2026-08-05')
    const existing = [
      { task_id: 1, checkpoint_id: 1, label: '내가 고친 문구' },
      { task_id: 1, checkpoint_id: 2, label: '리뷰 진행' },
    ]
    expect(newItemsSince(snap, existing)).toHaveLength(0)
  })

  it('전부 새 항목이면 그대로 돌려준다', () => {
    const snap = snapshotItems([t], 'u1', '2026-08-05')
    expect(newItemsSince(snap, [])).toHaveLength(2)
  })
})

describe('평일 판정', () => {
  it('토·일은 평일이 아니다', () => {
    expect(isWorkday('2026-08-07')).toBe(true) // 금
    expect(isWorkday('2026-08-08')).toBe(false) // 토
    expect(isWorkday('2026-08-09')).toBe(false) // 일
    expect(isWorkday('2026-08-10')).toBe(true) // 월
  })

  it('주말이면 직전 평일로 물러난다', () => {
    expect(lastWorkday('2026-08-09')).toBe('2026-08-07')
    expect(lastWorkday('2026-08-07')).toBe('2026-08-07')
  })

  it('요일 표기', () => {
    expect(dowOf('2026-08-05')).toBe('수')
    expect(dowOf('2026-08-08')).toBe('토')
  })
})

describe('localDateOf', () => {
  it('로컬 자정 기준으로 날짜를 뽑는다', () => {
    expect(localDateOf(at('2026-08-05', 0, 30))).toBe('2026-08-05')
    expect(localDateOf(at('2026-08-05', 23, 30))).toBe('2026-08-05')
  })
})
