-- ════════════════════════════════════════════════════════════
--  TaskBoard Lite v3
--   1) 개선활동 + 역량개발 → '업무개선/역량' 통합
--   2) 활동명(중분류)과 시스템명을 사용자가 추가할 수 있게 custom_options 신설
--  선행: schema.sql, schema-v2.sql
--  여러 번 실행해도 안전합니다.
-- ════════════════════════════════════════════════════════════

-- ─────────────────────────────── 1. 기존 데이터 통합

update tasks
   set cat_l1 = '업무개선/역량'
 where cat_l1 in ('개선활동', '역량개발');

update profiles
   set last_cat_l1 = '업무개선/역량'
 where last_cat_l1 in ('개선활동', '역량개발');

-- ─────────────────────────────── 2. 사용자가 늘리는 목록

-- 기본 목록은 여전히 코드 상수가 정본이다(categories.ts / constants.ts).
-- 이 테이블은 팀이 운영하면서 직접 덧붙이는 항목만 담는다.
--
--   kind = 'activity' : '업무개선/역량' 아래 활동명. checkpoints 사용
--   kind = 'system'   : 장애 등록의 시스템명.       checkpoints 미사용
create table if not exists custom_options (
  id serial primary key,
  kind        text not null check (kind in ('activity', 'system')),
  name        text not null,
  checkpoints text[] not null default '{}',
  created_by  uuid references profiles(id),
  created_at  timestamptz default now(),
  unique (kind, name)
);
create index if not exists idx_custom_options_kind on custom_options (kind);

alter table custom_options enable row level security;

drop policy if exists read_all   on custom_options;
drop policy if exists write_all  on custom_options;
drop policy if exists update_all on custom_options;
drop policy if exists del_admin  on custom_options;

create policy read_all   on custom_options for select using (auth.uid() is not null);
create policy write_all  on custom_options for insert with check (auth.uid() is not null);
create policy update_all on custom_options for update using (auth.uid() is not null);
-- 오타로 만든 항목을 본인이 지울 수 있어야 하므로 삭제도 전원 허용.
-- 항목을 지워도 이미 등록된 업무·장애는 문자열을 그대로 보관하므로 영향이 없다.
create policy del_admin  on custom_options for delete using (auth.uid() is not null);

-- ─────────────────────────────── 3. 확인
--
--   select cat_l1, count(*) from tasks group by cat_l1;
--   → '개선활동' / '역량개발' 이 남아 있지 않아야 합니다.
--
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' order by tablename, cmd;
--   → 9개 테이블 × 4 = 36행
