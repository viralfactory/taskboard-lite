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
