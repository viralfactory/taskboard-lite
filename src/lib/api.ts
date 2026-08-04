// 모든 DB 접근은 여기를 지난다. 컴포넌트는 supabase 클라이언트를 직접 import 하지 않는다.
import { supabase } from './supabase'
import type {
  ChangeHistory,
  CustomOption,
  DailyItem,
  DailyReport,
  Incident,
  Issue,
  MonthlyReport,
  NewIncidentInput,
  NewTaskInput,
  NextMonthPlan,
  Profile,
  Task,
  WeeklyReport,
} from './types'

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
  // initial_due_date 는 사용자가 수정할 수 없다. 최초 저장 시 자동 설정.
  const row = { ...taskFields, initial_due_date: input.due_date }
  const task = unwrap<Task>(await supabase.from('tasks').insert(row).select().single())

  if (checkpoints.length) {
    const rows = checkpoints.map((name, i) => ({ task_id: task.id, name, sort_order: i }))
    const { error } = await supabase.from('checkpoints').insert(rows)
    if (error) throw new Error(error.message)
  }
  await updateLastCategory(currentUserId, input.cat_l1, input.cat_l2)
  return task
}

/** 변경 이력을 남기는 필드. 작업명·기간은 상황에 따라 자주 바뀌므로 반드시 포함한다. */
const TRACKED_FIELDS = ['name', 'start_date', 'due_date', 'status', 'stage', 'assignee_id'] as const

async function recordHistory(
  entity: 'task' | 'daily',
  rows: { entity_id: number; field: string; old_value: string; new_value: string; reason?: string }[],
  userId?: string,
) {
  if (!rows.length) return
  await supabase
    .from('change_history')
    .insert(rows.map((r) => ({ ...r, entity, changed_by: userId ?? null })))
}

export async function updateTask(
  id: number,
  patch: Partial<Task>,
  ctx?: { before?: Task; userId?: string; reason?: string },
) {
  const { checkpoints, issues, initial_due_date, ...fields } = patch as Record<string, unknown> & {
    checkpoints?: unknown
    issues?: unknown
    initial_due_date?: unknown
  }
  void checkpoints
  void issues
  void initial_due_date // 최초 마감일은 수정 대상이 아니다
  const { error } = await supabase.from('tasks').update(fields).eq('id', id)
  if (error) throw new Error(error.message)

  if (ctx?.before) {
    const before = ctx.before as unknown as Record<string, unknown>
    await recordHistory(
      'task',
      TRACKED_FIELDS.filter((f) => f in fields && String(fields[f] ?? '') !== String(before[f] ?? '')).map(
        (f) => ({
          entity_id: id,
          field: f,
          old_value: String(before[f] ?? ''),
          new_value: String(fields[f] ?? ''),
          reason: ctx.reason,
        }),
      ),
      ctx.userId,
    )
  }
}

/** 마감일 변경은 사유 없이 불가. due_change_count 를 함께 올린다. */
export async function changeDueDate(task: Task, newDue: string, reason: string, userId?: string) {
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

  await recordHistory(
    'task',
    [{ entity_id: task.id, field: 'due_date', old_value: task.due_date, new_value: newDue, reason: trimmed }],
    userId,
  )
}

export async function listHistory(entity: 'task' | 'daily', id: number): Promise<ChangeHistory[]> {
  return unwrap(
    await supabase
      .from('change_history')
      .select('*')
      .eq('entity', entity)
      .eq('entity_id', id)
      .order('changed_at', { ascending: false }),
  )
}

export async function deleteTask(id: number) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────── checkpoints

export async function toggleCheckpoint(
  id: number,
  isDone: boolean,
  ctx?: { taskId: number; name: string; userId?: string },
) {
  const { error } = await supabase
    .from('checkpoints')
    .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw new Error(error.message)

  if (ctx) {
    await recordHistory(
      'task',
      [
        {
          entity_id: ctx.taskId,
          field: 'checkpoint',
          old_value: `${ctx.name} ${isDone ? '미완료' : '완료'}`,
          new_value: `${ctx.name} ${isDone ? '완료' : '미완료'}`,
        },
      ],
      ctx.userId,
    )
  }
}

export async function addCheckpoint(
  taskId: number,
  name: string,
  sortOrder: number,
  userId?: string,
) {
  const { error } = await supabase
    .from('checkpoints')
    .insert({ task_id: taskId, name, sort_order: sortOrder })
  if (error) throw new Error(error.message)
  await recordHistory(
    'task',
    [{ entity_id: taskId, field: 'checkpoint', old_value: '', new_value: `${name} 추가` }],
    userId,
  )
}

export async function deleteCheckpoint(
  id: number,
  ctx?: { taskId: number; name: string; userId?: string },
) {
  const { error } = await supabase.from('checkpoints').delete().eq('id', id)
  if (error) throw new Error(error.message)
  if (ctx) {
    await recordHistory(
      'task',
      [{ entity_id: ctx.taskId, field: 'checkpoint', old_value: `${ctx.name}`, new_value: '삭제됨' }],
      ctx.userId,
    )
  }
}

// ─────────────────────────────────────────── issues

export async function createIssue(input: {
  task_id: number
  title: string
  content: string
  type: string
  impact_days: number
  needs_decision: boolean
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

// ═══════════════════════════════════════════ v2

// ─────────────────────────────────────────── incidents

export async function listIncidents(): Promise<Incident[]> {
  return unwrap(
    await supabase.from('incidents').select('*').order('occurred_at', { ascending: false }),
  )
}

export async function createIncident(input: NewIncidentInput) {
  const { error } = await supabase.from('incidents').insert(input)
  if (error) throw new Error(error.message)
}

export async function updateIncident(id: number, patch: Partial<Incident>) {
  const next = { ...patch }
  if (patch.status === 'resolved' && !patch.resolved_at) next.resolved_at = new Date().toISOString()
  if (patch.status === 'responding') next.resolved_at = null
  const { error } = await supabase.from('incidents').update(next).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteIncident(id: number) {
  const { error } = await supabase.from('incidents').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ═══════════════════════════════════════════ v4 — 데일리 스크럼
//
// 일지는 자동으로 생기지 않는다. '일지 생성' 을 눌러야 만들어지고,
// 그 시점 스냅샷이 daily_items 로 복사된다.

const DAILY_SELECT = '*, daily_items(*)'

export async function listDailyReports(date: string): Promise<DailyReport[]> {
  const rows = unwrap<DailyReport[]>(
    await supabase.from('daily_reports').select(DAILY_SELECT).eq('report_date', date),
  )
  for (const r of rows) r.daily_items = (r.daily_items ?? []).sort((a, b) => a.sort_order - b.sort_order)
  return rows
}

export async function createDailyReport(
  userId: string,
  date: string,
  items: Omit<DailyItem, 'id' | 'report_id' | 'is_manual'>[],
): Promise<DailyReport> {
  const report = unwrap<DailyReport>(
    await supabase.from('daily_reports').insert({ user_id: userId, report_date: date }).select().single(),
  )
  if (items.length) {
    const { error } = await supabase
      .from('daily_items')
      .insert(items.map((i) => ({ ...i, report_id: report.id })))
    if (error) throw new Error(error.message)
  }
  return report
}

/** '다시 불러오기' — 이미 있는 항목은 건드리지 않고 새로 생긴 것만 덧붙인다 */
export async function appendDailyItems(
  reportId: number,
  items: Omit<DailyItem, 'id' | 'report_id' | 'is_manual'>[],
) {
  if (!items.length) return
  const { error } = await supabase
    .from('daily_items')
    .insert(items.map((i) => ({ ...i, report_id: reportId })))
  if (error) throw new Error(error.message)
}

/** 지난 날짜의 일지를 고치면 이력을 남긴다 (오늘 작성분은 남기지 않는다 — 잡음) */
export async function saveDailyReport(
  report: DailyReport,
  patch: Partial<DailyReport>,
  ctx: { userId: string; today: string },
) {
  const { error } = await supabase
    .from('daily_reports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', report.id)
  if (error) throw new Error(error.message)

  if (report.report_date < ctx.today) {
    const before = report as unknown as Record<string, unknown>
    const fields = patch as unknown as Record<string, unknown>
    await recordHistory(
      'daily',
      (['issue_note', 'is_leave'] as const)
        .filter((f) => f in fields && String(fields[f] ?? '') !== String(before[f] ?? ''))
        .map((f) => ({
          entity_id: report.id,
          field: f,
          old_value: String(before[f] ?? ''),
          new_value: String(fields[f] ?? ''),
        })),
      ctx.userId,
    )
  }
}

export async function addDailyItem(
  reportId: number,
  section: 'todo' | 'done',
  label: string,
  sortOrder: number,
) {
  const { error } = await supabase
    .from('daily_items')
    .insert({ report_id: reportId, section, label, sort_order: sortOrder, is_manual: true })
  if (error) throw new Error(error.message)
}

export async function updateDailyItem(id: number, patch: Partial<DailyItem>) {
  const { error } = await supabase.from('daily_items').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteDailyItem(id: number) {
  const { error } = await supabase.from('daily_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** 일지 안에서 항목을 체크하면 원본 체크포인트도 함께 완료 처리한다 */
export async function completeDailyItem(item: DailyItem, isDone: boolean, ctx: { userId: string; taskName?: string }) {
  await updateDailyItem(item.id, { is_done: isDone, section: isDone ? 'done' : 'todo' })
  if (item.checkpoint_id && item.task_id) {
    await toggleCheckpoint(item.checkpoint_id, isDone, {
      taskId: item.task_id,
      name: ctx.taskName ?? item.label,
      userId: ctx.userId,
    })
  }
}

// ─────────────────────────────────────────── custom_options (사용자가 늘리는 목록)

export async function listCustomOptions(): Promise<CustomOption[]> {
  return unwrap(await supabase.from('custom_options').select('*').order('created_at'))
}

export async function createCustomOption(input: {
  kind: CustomOption['kind']
  name: string
  checkpoints?: string[]
  created_by: string
}): Promise<CustomOption> {
  return unwrap(
    await supabase
      .from('custom_options')
      .insert({ checkpoints: [], ...input })
      .select()
      .single(),
  )
}

export async function deleteCustomOption(id: number) {
  const { error } = await supabase.from('custom_options').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────── monthly report

export async function getMonthlyReport(yearMonth: string): Promise<MonthlyReport | null> {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('*')
    .eq('year_month', yearMonth)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function saveMonthlyReport(input: {
  year_month: string
  org_name: string
  author_name: string
  report_date: string | null
  highlight: string
  base_date: string | null
  confirm?: boolean
}) {
  const row = {
    year_month: input.year_month,
    org_name: input.org_name,
    author_name: input.author_name,
    report_date: input.report_date || null,
    highlight: input.highlight,
    base_date: input.base_date || null,
    ...(input.confirm ? { confirmed_at: new Date().toISOString() } : {}),
  }
  const { error } = await supabase
    .from('monthly_reports')
    .upsert(row, { onConflict: 'year_month' })
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────── next month plans

export async function listNextMonthPlans(yearMonth: string): Promise<NextMonthPlan[]> {
  return unwrap(
    await supabase.from('next_month_plans').select('*').eq('year_month', yearMonth).order('sort_order'),
  )
}

export async function addNextMonthPlan(yearMonth: string, content: string, sortOrder: number) {
  const { error } = await supabase
    .from('next_month_plans')
    .insert({ year_month: yearMonth, content, sort_order: sortOrder })
  if (error) throw new Error(error.message)
}

export async function deleteNextMonthPlan(id: number) {
  const { error } = await supabase.from('next_month_plans').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
