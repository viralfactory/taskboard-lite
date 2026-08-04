-- ════════════════════════════════════════════════════════════
--  TaskBoard Lite — 테이블 + RLS
--  Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
--  여러 번 실행해도 안전합니다 (create if not exists / drop policy if exists).
-- ════════════════════════════════════════════════════════════

-- ─────────────────────────────── 1. 테이블

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  part text,
  is_admin boolean default false,
  last_cat_l1 text,                  -- 최근 사용 카테고리 (등록 속도용)
  last_cat_l2 text
);

create table if not exists tasks (
  id serial primary key,
  name text not null,
  cat_l1 text not null,
  cat_l2 text not null,
  assignee_id uuid references profiles(id) not null,
  start_date date not null,
  due_date date not null,
  deliverable text not null,         -- 템플릿 마지막 항목에서 자동 채움
  deliverable_link text,             -- 완료 시 증빙
  status text default 'doing',       -- doing | done | hold
  due_change_count int default 0,
  due_change_reason text,
  created_at timestamptz default now()
);

create table if not exists checkpoints (
  id serial primary key,
  task_id int references tasks(id) on delete cascade,
  name text not null,
  is_done boolean default false,
  done_at timestamptz,
  sort_order int default 0
);

create table if not exists issues (
  id serial primary key,
  task_id int references tasks(id) on delete cascade,
  content text not null,
  type text not null,                -- 기술 | 자원 | 대외협의 | 요건변경 | 기타
  impact_days int default 0,
  status text default 'new',         -- new | working | resolved
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists weekly_reports (
  id serial primary key,
  user_id uuid references profiles(id),
  year_week text not null,           -- '2026-W32'
  comment text,
  issue_note text,                   -- 주간보고 4번(이슈·지원요청) 저장용
  submitted_at timestamptz,
  unique (user_id, year_week)
);

create index if not exists idx_tasks_assignee    on tasks(assignee_id);
create index if not exists idx_tasks_due         on tasks(due_date);
create index if not exists idx_checkpoints_task  on checkpoints(task_id);
create index if not exists idx_issues_task       on issues(task_id);

-- ─────────────────────────────── 2. RLS 켜기

alter table profiles       enable row level security;
alter table tasks          enable row level security;
alter table checkpoints    enable row level security;
alter table issues         enable row level security;
alter table weekly_reports enable row level security;

-- ─────────────────────────────── 3. 정책
-- 읽기·쓰기는 로그인 사용자 전원, 삭제만 admin.
-- 8명은 서로 신뢰하는 동료이므로 남의 업무 수정을 허용한다.
-- (profiles 만 예외: 본인 행만 생성·수정)

-- profiles ---------------------------------------------------
drop policy if exists read_all    on profiles;
drop policy if exists write_self  on profiles;
drop policy if exists update_self on profiles;
drop policy if exists del_admin   on profiles;

create policy read_all    on profiles for select using (auth.uid() is not null);
create policy write_self  on profiles for insert with check (auth.uid() = id);
create policy update_self on profiles for update using (auth.uid() = id);
create policy del_admin   on profiles for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
);

-- tasks ------------------------------------------------------
drop policy if exists read_all   on tasks;
drop policy if exists write_all  on tasks;
drop policy if exists update_all on tasks;
drop policy if exists del_admin  on tasks;

create policy read_all   on tasks for select using (auth.uid() is not null);
create policy write_all  on tasks for insert with check (auth.uid() is not null);
create policy update_all on tasks for update using (auth.uid() is not null);
create policy del_admin  on tasks for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);

-- checkpoints ------------------------------------------------
drop policy if exists read_all   on checkpoints;
drop policy if exists write_all  on checkpoints;
drop policy if exists update_all on checkpoints;
drop policy if exists del_admin  on checkpoints;

create policy read_all   on checkpoints for select using (auth.uid() is not null);
create policy write_all  on checkpoints for insert with check (auth.uid() is not null);
create policy update_all on checkpoints for update using (auth.uid() is not null);
-- 체크포인트는 등록 폼에서 지우는 일이 흔하므로 삭제도 전원 허용
create policy del_admin  on checkpoints for delete using (auth.uid() is not null);

-- issues -----------------------------------------------------
drop policy if exists read_all   on issues;
drop policy if exists write_all  on issues;
drop policy if exists update_all on issues;
drop policy if exists del_admin  on issues;

create policy read_all   on issues for select using (auth.uid() is not null);
create policy write_all  on issues for insert with check (auth.uid() is not null);
create policy update_all on issues for update using (auth.uid() is not null);
create policy del_admin  on issues for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);

-- weekly_reports ---------------------------------------------
drop policy if exists read_all   on weekly_reports;
drop policy if exists write_all  on weekly_reports;
drop policy if exists update_all on weekly_reports;
drop policy if exists del_admin  on weekly_reports;

create policy read_all   on weekly_reports for select using (auth.uid() is not null);
create policy write_all  on weekly_reports for insert with check (auth.uid() is not null);
create policy update_all on weekly_reports for update using (auth.uid() is not null);
create policy del_admin  on weekly_reports for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);

-- ─────────────────────────────── 4. 확인
-- 아래를 실행하면 5개 테이블에 정책이 붙었는지 한눈에 보입니다.
--
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' order by tablename, cmd;
--
-- 기대: profiles 4개, tasks 4개, checkpoints 4개, issues 4개, weekly_reports 4개 (총 20개)

-- ─────────────────────────────── 5. 팀장을 admin 으로
-- profiles 행은 '최초 로그인 + 이름·파트 입력' 후에 생깁니다.
-- 팀장이 한 번 로그인한 뒤 아래를 1회 실행하세요. (아이디는 실제 값으로 교체)
--
--   update profiles set is_admin = true
--   where id = (select id from auth.users where email = 'lead@team.local');
