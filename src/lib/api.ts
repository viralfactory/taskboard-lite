// 모든 DB 접근은 여기를 지난다. 컴포넌트는 supabase 클라이언트를 직접 import 하지 않는다.
import { supabase } from './supabase'
import type { Issue, NewTaskInput, Profile, Task, WeeklyReport } from './types'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

// ─────────────────────────────────────────── auth / profile

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSessionUser() {
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export function onAuthChange(cb: () => void) {
  const { data } = supabase.auth.onAuthStateChange(() => cb())
  return () => data.subscription.unsubscribe()
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function createProfile(p: { id: string; name: string; part: string }): Promise<Profile> {
  return unwrap(await supabase.from('profiles').insert(p).select().single())
}

export async function listProfiles(): Promise<Profile[]> {
  return unwrap(await supabase.from('profiles').select('*').order('name'))
}

async function updateLastCategory(userId: string, l1: string, l2: string) {
  await supabase.from('profiles').update({ last_cat_l1: l1, last_cat_l2: l2 }).eq('id', userId)
}

// ─────────────────────────────────────────── tasks

const TASK_SELECT = '*, checkpoints(*), issues(*)'

function sortNested(tasks: Task[]): Task[] {
  for (const t of tasks) {
    t.checkpoints = (t.checkpoints ?? []).sort((a, b) => a.sort_order - b.sort_order)
    t.issues = (t.issues ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  return tasks
}

export async function listTasks(): Promise<Task[]> {
  const data = unwrap<Task[]>(
    await supabase.from('tasks').select(TASK_SELECT).order('due_date', { ascending: true }),
  )
  return sortNested(data)
}

/** 등록 폼 저장. 체크포인트까지 함께 만들고 profiles.last_cat_* 을 갱신한다. */
export async function createTask(input: NewTaskInput, currentUserId: string): Promise<Task> {
  const { checkpoints, ...taskFields } = input
  const task = unwrap<Task>(await supabase.from('tasks').insert(taskFields).select().single())

  if (checkpoints.length) {
    const rows = checkpoints.map((name, i) => ({ task_id: task.id, name, sort_order: i }))
    const { error } = await supabase.from('checkpoints').insert(rows)
    if (error) throw new Error(error.message)
  }
  await updateLastCategory(currentUserId, input.cat_l1, input.cat_l2)
  return task
}

export async function updateTask(id: number, patch: Partial<Task>) {
  const { checkpoints, issues, ...fields } = patch as Record<string, unknown> & {
    checkpoints?: unknown
    issues?: unknown
  }
  void checkpoints
  void issues
  const { error } = await supabase.from('tasks').update(fields).eq('id', id)
  if (error) throw new Error(error.message)
}

/** 마감일 변경은 사유 없이 불가. due_change_count 를 함께 올린다. */
export async function changeDueDate(task: Task, newDue: string, reason: string) {
  const trimmed = reason.trim()
  if (!trimmed) throw new Error('마감일 변경 사유는 필수입니다.')
  const { error } = await supabase
    .from('tasks')
    .update({
      due_date: newDue,
      due_change_reason: trimmed,
      due_change_count: (task.due_change_count ?? 0) + 1,
    })
    .eq('id', task.id)
  if (error) throw new Error(error.message)
}

export async function deleteTask(id: number) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────── checkpoints

export async function toggleCheckpoint(id: number, isDone: boolean) {
  const { error } = await supabase
    .from('checkpoints')
    .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function addCheckpoint(taskId: number, name: string, sortOrder: number) {
  const { error } = await supabase
    .from('checkpoints')
    .insert({ task_id: taskId, name, sort_order: sortOrder })
  if (error) throw new Error(error.message)
}

export async function deleteCheckpoint(id: number) {
  const { error } = await supabase.from('checkpoints').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────── issues

export async function createIssue(input: {
  task_id: number
  content: string
  type: string
  impact_days: number
}) {
  const { error } = await supabase.from('issues').insert(input)
  if (error) throw new Error(error.message)
}

export async function updateIssue(id: number, patch: Partial<Issue>) {
  const next = { ...patch }
  if (patch.status === 'resolved') next.resolved_at = new Date().toISOString()
  const { error } = await supabase.from('issues').update(next).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listIssues(): Promise<Issue[]> {
  return unwrap(await supabase.from('issues').select('*').order('created_at', { ascending: false }))
}

// ─────────────────────────────────────────── weekly reports

export async function listWeeklyReports(yearWeek: string): Promise<WeeklyReport[]> {
  return unwrap(await supabase.from('weekly_reports').select('*').eq('year_week', yearWeek))
}

export async function listAllWeeklyReports(): Promise<WeeklyReport[]> {
  return unwrap(await supabase.from('weekly_reports').select('*'))
}

export async function saveWeeklyReport(input: {
  user_id: string
  year_week: string
  comment: string
  issue_note: string
  submit: boolean
}) {
  const row = {
    user_id: input.user_id,
    year_week: input.year_week,
    comment: input.comment,
    issue_note: input.issue_note,
    submitted_at: input.submit ? new Date().toISOString() : null,
  }
  const { error } = await supabase.from('weekly_reports').upsert(row, { onConflict: 'user_id,year_week' })
  if (error) throw new Error(error.message)
}
