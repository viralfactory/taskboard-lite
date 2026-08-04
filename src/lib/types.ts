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
}
