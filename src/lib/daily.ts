// 데일리 스크럼 (일자별 일지) 집계. 순수 함수만 둔다.
//
// 자동으로 매일 생기지 않는다. 개발자가 '일지 생성' 을 누르는 순간
// 아래 snapshotItems() 로 그날 기준 항목을 만들어 daily_items 에 복사한다.
// 복사된 뒤로는 그 일지가 정본이다 — 원본 업무를 고쳐도 지난 일지는 바뀌지 않는다.
//
// 항목 단위는 체크포인트다.
//   To Do : 기간이 걸쳐 있는 미완료 업무의 미완료 체크포인트
//   Done  : 그날 완료 처리된 체크포인트

import { localDateOf } from './dates'
import type { Task } from './types'

export type DailySection = 'todo' | 'done'

export interface SnapshotItem {
  section: DailySection
  label: string
  task_id: number
  checkpoint_id: number | null
  is_done: boolean
  sort_order: number
}

const sep = ' — '

/** 그날 기준 To Do / Done 항목을 만든다 (생성 시점 1회만 호출) */
export function snapshotItems(tasks: Task[], userId: string, date: string): SnapshotItem[] {
  const mine = tasks.filter((t) => t.assignee_id === userId)
  const todo: SnapshotItem[] = []
  const done: SnapshotItem[] = []

  for (const t of mine) {
    // 아직 시작하지 않은 업무는 그날의 할 일이 아니다
    if (t.start_date > date) continue

    for (const c of t.checkpoints ?? []) {
      const doneOn = c.done_at ? localDateOf(c.done_at) : null
      if (c.is_done) {
        // 그날 체크한 것만 Done 에 올린다 (어제 끝낸 건 오늘 일지에 다시 올리지 않는다)
        if (doneOn === date) {
          done.push({
            section: 'done',
            label: `${t.name}${sep}${c.name}`,
            task_id: t.id,
            checkpoint_id: c.id,
            is_done: true,
            sort_order: done.length,
          })
        }
        continue
      }
      // 보류·완료된 업무의 남은 체크포인트는 오늘 할 일이 아니다
      if (t.status !== 'doing') continue
      todo.push({
        section: 'todo',
        label: `${t.name}${sep}${c.name}`,
        task_id: t.id,
        checkpoint_id: c.id,
        is_done: false,
        sort_order: todo.length,
      })
    }

    // 체크포인트가 하나도 없는 진행 업무는 업무 자체를 항목으로 올린다
    if (t.status === 'doing' && (t.checkpoints ?? []).length === 0) {
      todo.push({
        section: 'todo',
        label: t.name,
        task_id: t.id,
        checkpoint_id: null,
        is_done: false,
        sort_order: todo.length,
      })
    }
  }

  return [...todo, ...done]
}

/**
 * 일지를 만든 뒤에 생긴 항목만 골라낸다 ('다시 불러오기').
 * 이미 일지에 있는 체크포인트는 사용자가 손댔을 수 있으므로 건드리지 않는다.
 */
export function newItemsSince(
  snapshot: SnapshotItem[],
  existing: { task_id: number | null; checkpoint_id: number | null; label: string }[],
): SnapshotItem[] {
  const has = (s: SnapshotItem) =>
    existing.some((e) =>
      s.checkpoint_id != null
        ? e.checkpoint_id === s.checkpoint_id
        : e.task_id === s.task_id && e.label === s.label,
    )
  return snapshot.filter((s) => !has(s))
}
