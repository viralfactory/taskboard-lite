-- ════════════════════════════════════════════════════════════
--  표시 이름을 메일 주소 기준으로 정리
--    jin@team.local        → Jin
--    jayce.kim@team.local  → Jayce Kim
--    sloan_lee@team.local  → Sloan Lee
--  팀장은 Steven 으로 고정.
--
--  SQL Editor 에 전체를 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- ════════════════════════════════════════════════════════════

-- ─────────────────────────────── 0. 먼저 지금 상태를 봅니다
--
--   select u.email, p.name, p.part, p.is_admin
--     from auth.users u left join profiles p on p.id = u.id
--    order by u.email;
--
-- name 이 비어 있는 줄 = 아직 한 번도 로그인하지 않은 계정입니다.

-- ─────────────────────────────── 1. 이미 가입한 계정의 이름을 메일에서 다시 뽑는다

update profiles p
   set name = initcap(replace(replace(split_part(u.email, '@', 1), '.', ' '), '_', ' '))
  from auth.users u
 where u.id = p.id;

-- ─────────────────────────────── 2. 아직 로그인하지 않은 계정도 미리 만들어 둔다
--
-- 이렇게 하면 그 사람이 로그인하기 전에도 팀 현황·데일리 목록에 이름이 보입니다.

insert into profiles (id, name, part)
select u.id,
       initcap(replace(replace(split_part(u.email, '@', 1), '.', ' '), '_', ' ')),
       null
  from auth.users u
 where not exists (select 1 from profiles p where p.id = u.id);

-- ─────────────────────────────── 3. 팀장을 Steven 으로

update profiles set name = 'Steven' where is_admin;

-- is_admin 이 아직 지정되지 않았다면 아이디로 직접 정하세요:
--   update profiles set name = 'Steven', is_admin = true
--    where id = (select id from auth.users where email = 'lead@team.local');

-- ─────────────────────────────── 4. 결과 확인
--
--   select u.email, p.name, p.is_admin
--     from auth.users u join profiles p on p.id = u.id
--    order by p.is_admin desc, p.name;
--
-- 기대: Steven(팀장) + Jin / Jayce / Sloan …

-- ─────────────────────────────── 참고
--
-- 각자 원하는 표기가 따로 있다면 1번은 건너뛰고, 본인이 최초 로그인 화면에서
-- 고치게 두면 됩니다. 앱이 메일 주소에서 뽑은 이름을 기본값으로 채워 줍니다.
-- (src/lib/names.ts)
