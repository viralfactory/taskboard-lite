export interface Profile {
  id: string
  name: string
  part: string | null
  is_admin: boolean
  last_cat_l1: string | null
  last_cat_l2: string | null
}

export interface Checkpoint {
  id: number
  task_id: number
  name: string
  is_done: boolean
  done_at: string | null
  sort_order: number
}

export interface Task {
  id: number
  name: string
  cat_l1: string
  cat_l2: string
  assignee_id: string
  start_date: string
  due_date: string
  deliverable: string
  deliverable_link: string | null
  status: 'doing' | 'done' | 'hold'
  due_change_count: number
  due_change_reason: string | null
  created_at: string
  checkpoints: Checkpoint[]
  issues?: Issue[]
  // v2
  progress_note: string | null
  /** @deprecated v5 부터 쓰지 않는다. 진행 단계는 체크포인트가 담당한다. */
  stage?: string | null
  initial_due_date: string | null
  is_agenda: boolean
  // v5 — 2단 구조 (부모 프로젝트 : 자식 = 1:N). 자식은 다시 자식을 갖지 않는다.
  parent_id: number | null
}

export interface Issue {
  id: number
  task_id: number
  content: string
  type: string
  impact_days: number
  status: 'new' | 'working' | 'resolved'
  created_at: string
  resolved_at: string | null
  // v2
  title: string | null
  needs_decision: boolean
  sort_order: number
}

// ─────────────────────────────── v2

export interface Incident {
  id: number
  occurred_at: string
  title: string
  system: string
  severity: 'critical' | 'major' | 'normal'
  cause_type: string | null
  action: string | null
  status: 'responding' | 'resolved'
  recurrence_action: string | null
  related_task_id: number | null
  reporter_id: string | null
  resolved_at: string | null
  created_at: string
}

export interface NewIncidentInput {
  occurred_at: string
  title: string
  system: string
  severity: Incident['severity']
  cause_type?: string | null
  action?: string | null
  recurrence_action?: string | null
  reporter_id: string
}

export interface MonthlyReport {
  id: number
  year_month: string
  org_name: string | null
  author_name: string | null
  report_date: string | null
  highlight: string | null
  footnote: string | null
  base_date: string | null
  confirmed_at: string | null
}

/** 팀이 운영하면서 직접 늘리는 목록. 기본값은 코드 상수가 정본이다. */
export interface CustomOption {
  id: number
  kind: 'activity' | 'system'
  name: string
  checkpoints: string[]
  created_by: string | null
  created_at: string
}

export interface NextMonthPlan {
  id: number
  year_month: string
  content: string
  sort_order: number
}

// ─────────────────────────────── v4: 데일리 스크럼

export interface DailyItem {
  id: number
  report_id: number
  section: 'todo' | 'done'
  label: string
  task_id: number | null
  checkpoint_id: number | null
  is_manual: boolean
  is_done: boolean
  sort_order: number
}

export interface DailyReport {
  id: number
  user_id: string
  report_date: string
  is_leave: boolean
  issue_note: string | null
  comment: string | null
  created_at: string
  updated_at: string
  submitted_at: string | null
  daily_items?: DailyItem[]
}

export interface ChangeHistory {
  id: number
  entity: 'task' | 'daily'
  entity_id: number
  field: string
  old_value: string | null
  new_value: string | null
  reason: string | null
  changed_by: string | null
  changed_at: string
}

export interface WeeklyReport {
  id: number
  user_id: string
  year_week: string
  comment: string | null
  issue_note: string | null
  submitted_at: string | null
}

/** 등록 폼이 만들어내는 값 */
export interface NewTaskInput {
  name: string
  cat_l1: string
  cat_l2: string
  assignee_id: string
  start_date: string
  due_date: string
  deliverable: string
  checkpoints: string[]
  is_agenda: boolean
  parent_id: number | null
}
