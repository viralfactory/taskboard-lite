-- ════════════════════════════════════════════════════════════
--  TaskBoard Lite v5
--   1) 업무 2단 구조 (부모 프로젝트 : 자식 단위프로젝트 = 1:N)
--   2) '프로젝트' 대분류 제거 — 업무 자체가 프로젝트다
--   3) 단계(stage) 컬럼 사용 중단 — 진행 단계는 체크포인트가 담당한다
--  선행: schema.sql → v2 → v3 → v4
--  여러 번 실행해도 안전합니다.
-- ════════════════════════════════════════════════════════════

-- ─────────────────────────────── 1. 2단 구조
--
-- 큰 업무를 단위 프로젝트로 쪼갤 때만 쓰는 최소한의 연결고리다.
-- 깊이는 2단계까지만 — 자식은 다시 자식을 갖지 않는다 (앱에서 막는다).

alter table tasks add column if not exists parent_id int references tasks(id) on delete set null;
create index if not exists idx_tasks_parent on tasks (parent_id);

-- ─────────────────────────────── 2. '프로젝트' 대분류 흡수
--
-- 기존 '프로젝트 > 요건정의/설계/구현/검증/이행' 은 업무 유형이 아니라
-- 한 프로젝트가 지나가는 단계였다. 이제 그 단계는 체크포인트가 담당한다.

update tasks
   set cat_l1 = '개발',
       cat_l2 = case cat_l2
                  when '요건정의' then '신규개발'
                  when '설계'     then '신규개발'
                  when '구현'     then '신규개발'
                  when '검증'     then '테스트'
                  when '이행'     then '신규개발'
                  else '신규개발'
                end
 where cat_l1 = '프로젝트';

update profiles set last_cat_l1 = '개발', last_cat_l2 = '신규개발'
 where last_cat_l1 = '프로젝트';

-- ─────────────────────────────── 3. 확인
--
--   select cat_l1, cat_l2, count(*) from tasks group by 1,2 order by 1,2;
--   → '프로젝트' 가 남아 있지 않아야 합니다.
--
--   select column_name from information_schema.columns
--    where table_name = 'tasks' and column_name = 'parent_id';
--   → 1행
--
--   -- 부모-자식 확인
--   select p.name as 부모, c.name as 자식
--     from tasks c join tasks p on p.id = c.parent_id
--    order by p.name, c.name;

-- ─────────────────────────────── 참고
--
-- tasks.stage 컬럼은 지우지 않고 남겨 둡니다. 앱은 더 이상 쓰지 않지만,
-- 이전에 입력한 값을 확인할 일이 있을 수 있어 보존합니다.
-- 완전히 정리하려면: alter table tasks drop column stage;
