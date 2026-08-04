import { useQuery } from '@tanstack/react-query'
import { listProfiles, listTasks } from '../lib/api'
import type { Profile, Task } from '../lib/types'

export function useTasks() {
  return useQuery<Task[]>({ queryKey: ['tasks'], queryFn: listTasks })
}

export function useProfiles() {
  return useQuery<Profile[]>({ queryKey: ['profiles'], queryFn: listProfiles })
}

export function nameMap(profiles: Profile[]): Record<string, string> {
  return Object.fromEntries(profiles.map((p) => [p.id, p.name]))
}

/** task_id → 자식 목록 (2단계까지만이므로 한 겹이면 충분하다) */
export function childrenMap(tasks: Task[]): Map<number, Task[]> {
  const m = new Map<number, Task[]>()
  for (const t of tasks) {
    if (t.parent_id == null) continue
    const arr = m.get(t.parent_id) ?? []
    arr.push(t)
    m.set(t.parent_id, arr)
  }
  return m
}

/** 부모 뒤에 자식이 따라오도록 평탄화한 목록 */
export function withHierarchy(tasks: Task[], kids: Map<number, Task[]>): { task: Task; isChild: boolean }[] {
  const out: { task: Task; isChild: boolean }[] = []
  const shown = new Set<number>()
  for (const t of tasks) {
    if (t.parent_id != null) continue // 자식은 부모 아래에서 그린다
    out.push({ task: t, isChild: false })
    shown.add(t.id)
    for (const c of kids.get(t.id) ?? []) {
      out.push({ task: c, isChild: true })
      shown.add(c.id)
    }
  }
  // 부모가 필터로 걸러진 자식은 홀로 보여 준다
  for (const t of tasks) if (!shown.has(t.id)) out.push({ task: t, isChild: false })
  return out
}
