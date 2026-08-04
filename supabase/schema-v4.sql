-- ════════════════════════════════════════════════════════════
--  TaskBoard Lite v4 — 데일리 스크럼 + 업무 변경 이력
--  선행: schema.sql, schema-v2.sql, schema-v3.sql
--  여러 번 실행해도 안전합니다.
-- ════════════════════════════════════════════════════════════

-- ─────────────────────────────── 1. 데일리 일지
--
-- 자동으로 매일 생기지 않는다. 개발자가 '일지 생성' 을 눌러야 행이 만들어지고,
-- 그 시점에 기간이 걸친 업무의 체크포인트를 daily_items 로 복사한다.
-- 복사된 뒤로는 이 일지가 정본이다 — 원본 업무를 고쳐도 지난 일지는 바뀌지 않는다.

create table if not exists daily_reports (
  id serial primary key,
  user_id     uuid references profiles(id) on delete cascade,
  report_date date not null,
  is_leave    boolean default false,      -- 휴가. 표시는 되지만 작성은 선택
  issue_note  text,                       -- 이슈 및 지원요청
  comment     text,                       -- 특이사항
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  submitted_at timestamptz,
  unique (user_id, report_date)
);
create index if not exists idx_daily_reports_date on daily_reports (report_date);

-- 일지 안의 항목. 생성 시점 스냅샷 + 사용자가 덧붙인 것
create table if not exists daily_items (
  id serial primary key,
  report_id     int references daily_reports(id) on delete cascade,
  section       text not null,            -- todo | done
  label         text not null,            -- 복사 시점의 '업무명 — 체크포인트명'
  task_id       int references tasks(id) on delete set null,   -- 추적용. 끊겨도 label 은 남는다
  checkpoint_id int references checkpoints(id) on delete set null,
  is_manual     boolean default false,    -- 사용자가 직접 덧붙인 항목
  is_done       boolean default false,    -- 일지 안에서의 체크 상태
  sort_order    int default 0
);
create index if not exists idx_daily_items_report on daily_items (report_id);

-- ─────────────────────────────── 2. 변경 이력
--
-- 작업명·기간은 상황에 따라 바뀐다. 무엇이 언제 어떻게 바뀌었는지 남긴다.
-- 업무(task)와 지난 일지(daily) 가 같은 테이블을 쓴다.

create table if not exists change_history (
  id serial primary key,
  entity     text not null,               -- task | daily
  entity_id  int not null,
  field      text not null,               -- name | start_date | due_date | status | stage | assignee_id | checkpoint | issue_note | comment | is_leave | item
  old_value  text,
  new_value  text,
  reason     text,                        -- 마감일 변경 사유 등
  changed_by uuid references profiles(id),
  changed_at timestamptz default now()
);
create index if not exists idx_change_history on change_history (entity, entity_id, changed_at desc);

-- ─────────────────────────────── 3. RLS (기존과 동일 패턴)

alter table daily_reports enable row level security;
alter table daily_items   enable row level security;
alter table change_history enable row level security;

-- daily_reports ----------------------------------------------
drop policy if exists read_all   on daily_reports;
drop policy if exists write_all  on daily_reports;
drop policy if exists update_all on daily_reports;
drop policy if exists del_admin  on daily_reports;

create policy read_all   on daily_reports for select using (auth.uid() is not null);
create policy write_all  on daily_reports for insert with check (auth.uid() is not null);
create policy update_all on daily_reports for update using (auth.uid() is not null);
create policy del_admin  on daily_reports for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);

-- daily_items ------------------------------------------------
-- 항목은 일지 안에서 자유롭게 가감하므로 삭제도 전원 허용
drop policy if exists read_all   on daily_items;
drop policy if exists write_all  on daily_items;
drop policy if exists update_all on daily_items;
drop policy if exists del_admin  on daily_items;

create policy read_all   on daily_items for select using (auth.uid() is not null);
create policy write_all  on daily_items for insert with check (auth.uid() is not null);
create policy update_all on daily_items for update using (auth.uid() is not null);
create policy del_admin  on daily_items for delete using (auth.uid() is not null);

-- change_history ---------------------------------------------
-- 이력은 고치거나 지울 수 없어야 의미가 있다. update / delete 정책을 만들지 않는다.
drop policy if exists read_all   on change_history;
drop policy if exists write_all  on change_history;

create policy read_all   on change_history for select using (auth.uid() is not null);
create policy write_all  on change_history for insert with check (auth.uid() is not null);

-- ─────────────────────────────── 4. 확인
--
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' order by tablename, cmd;
--   → 기존 36행 + daily_reports 4 + daily_items 4 + change_history 2 = 46행
