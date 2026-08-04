-- ════════════════════════════════════════════════════════════
--  TaskBoard Lite v2 — 운영·장애 + 월간보고
--  선행: schema.sql 이 이미 실행되어 있어야 합니다.
--  SQL Editor 에 전체를 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- ════════════════════════════════════════════════════════════

-- ─────────────────────────────── 1. 기존 테이블 확장

alter table tasks add column if not exists progress_note     text;                 -- 주요 진행 내용(결과), 2줄 이내
alter table tasks add column if not exists stage             text default 'dev';   -- dev | 적용 | 운영적용 | 배포
alter table tasks add column if not exists initial_due_date  date;                 -- 최초 마감일 (일정 변경 표기용)
alter table tasks add column if not exists is_agenda         boolean default true; -- 월간보고 '개발 안건' 포함 여부

-- 최초 마감일 백필 (기존 데이터)
update tasks set initial_due_date = due_date where initial_due_date is null;

alter table issues add column if not exists title          text;                 -- 굵은 제목 (예: 스마트로 키인 결제)
alter table issues add column if not exists needs_decision boolean default false;-- 의사결정 필요 사항 여부
alter table issues add column if not exists sort_order     int default 0;

-- ─────────────────────────────── 2. 신규 테이블

-- 장애 — 업무(tasks)와 별개 엔티티다. 장애를 태스크로 등록하지 않는다.
create table if not exists incidents (
  id serial primary key,
  occurred_at       date not null,
  title             text not null,
  system            text not null,              -- BRS | Workspace | WEB | POVAS | ERP (+ 팀이 추가한 값)
  severity          text not null,              -- critical | major | normal
  cause_type        text,                       -- 코드결함 | 데이터 | 인프라 | 외부연동 | 운영실수 | 기타
  action            text,                       -- 조치 내용
  status            text default 'responding',  -- responding | resolved
  recurrence_action text,                       -- 재발방지 대책
  related_task_id   int references tasks(id) on delete set null,
  reporter_id       uuid references profiles(id),
  resolved_at       timestamptz,
  created_at        timestamptz default now()
);
create index if not exists idx_incidents_month on incidents (occurred_at);

-- 월간보고 (수동 입력분만 저장, 나머지는 집계)
create table if not exists monthly_reports (
  id serial primary key,
  year_month   text unique not null,          -- '2026-07'
  org_name     text default 'WEB / POVAS 운영·개발',
  author_name  text,
  report_date  date,
  highlight    text,                          -- MONTHLY SUMMARY 중점 문구
  footnote     text default '데이터 출처 : 월말 Error 리포트 · 개발 진행현황 기준일',
  base_date    date,                          -- 개발 진행현황 기준일
  confirmed_at timestamptz
);

-- 차월 계획 (자동 추출분 외 수동 추가)
create table if not exists next_month_plans (
  id serial primary key,
  year_month text not null,                   -- 계획이 실행될 달 '2026-08'
  content    text not null,
  sort_order int default 0
);
create index if not exists idx_next_month_plans on next_month_plans (year_month);

-- ─────────────────────────────── 3. RLS (기존과 동일 패턴)

alter table incidents        enable row level security;
alter table monthly_reports  enable row level security;
alter table next_month_plans enable row level security;

-- incidents --------------------------------------------------
drop policy if exists read_all   on incidents;
drop policy if exists write_all  on incidents;
drop policy if exists update_all on incidents;
drop policy if exists del_admin  on incidents;

create policy read_all   on incidents for select using (auth.uid() is not null);
create policy write_all  on incidents for insert with check (auth.uid() is not null);
create policy update_all on incidents for update using (auth.uid() is not null);
create policy del_admin  on incidents for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);

-- monthly_reports --------------------------------------------
drop policy if exists read_all   on monthly_reports;
drop policy if exists write_all  on monthly_reports;
drop policy if exists update_all on monthly_reports;
drop policy if exists del_admin  on monthly_reports;

create policy read_all   on monthly_reports for select using (auth.uid() is not null);
create policy write_all  on monthly_reports for insert with check (auth.uid() is not null);
create policy update_all on monthly_reports for update using (auth.uid() is not null);
create policy del_admin  on monthly_reports for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);

-- next_month_plans -------------------------------------------
-- 차월 계획은 월간보고 화면에서 자유롭게 가감하므로 삭제도 전원 허용
drop policy if exists read_all   on next_month_plans;
drop policy if exists write_all  on next_month_plans;
drop policy if exists update_all on next_month_plans;
drop policy if exists del_admin  on next_month_plans;

create policy read_all   on next_month_plans for select using (auth.uid() is not null);
create policy write_all  on next_month_plans for insert with check (auth.uid() is not null);
create policy update_all on next_month_plans for update using (auth.uid() is not null);
create policy del_admin  on next_month_plans for delete using (auth.uid() is not null);

-- ─────────────────────────────── 4. 확인
--
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' order by tablename, cmd;
--
-- v1 20개 + v2 12개 = 총 32행이 나와야 합니다.
--
--   select column_name from information_schema.columns
--   where table_name = 'tasks' and column_name in
--     ('progress_note','stage','initial_due_date','is_agenda');
--
-- 4행이 나와야 합니다.
