# 설치·환경구축 가이드

처음부터 끝까지 따라 하면 팀 8명이 접속하는 URL이 나옵니다.
**총 소요 40~60분**, 그중 실제 작업은 20분 정도이고 나머지는 프로젝트 생성 대기 시간입니다.

| 단계 | 내용 | 소요 |
|---|---|---|
| [0](#0-준비물) | 준비물 확인 | 5분 |
| [1](#1-supabase-프로젝트-생성) | Supabase 프로젝트 생성 | 5분 (+대기 2분) |
| [2](#2-테이블과-rls-만들기) | 테이블·RLS 만들기 | 2분 |
| [3](#3-로그인-정책-설정-중요) | 로그인 정책 설정 | 3분 |
| [4](#4-팀원-8명-계정-만들기) | 팀원 8명 계정 생성 | 5분 |
| [5](#5-api-키-확인) | API 키 확인 | 2분 |
| [6](#6-로컬에서-실행해-보기) | 로컬 실행 | 5분 |
| [7](#7-팀장을-admin-으로-지정) | 팀장 admin 지정 | 2분 |
| [8](#8-github-pages-배포) | GitHub Pages 배포 | 10분 |
| [9](#9-동작-확인-체크리스트) | 동작 확인 | 10분 |

---

## 0. 준비물

**계정 2개** — 둘 다 무료입니다.

- GitHub 계정 (배포용)
- Supabase 계정 — <https://supabase.com> 에서 GitHub 계정으로 가입 가능

**도구 2개** — 배포만 하고 로컬 개발을 안 할 거라면 건너뛰어도 됩니다.

```bash
node -v    # v18 이상 (없으면 https://nodejs.org 에서 LTS 설치)
git --version
```

> macOS 에서 Node 가 없다면: `brew install node`
> Windows 에서는 nodejs.org 의 LTS 설치 프로그램을 쓰세요.

**결정해 둘 것**

| 항목 | 예시 | 비고 |
|---|---|---|
| 팀원 아이디 8개 | `hong@team.local` | 실제 메일 주소가 아니어도 됩니다 |
| 초기 비밀번호 | 각자 다르게, 6자 이상 | 첫 로그인 후 본인이 변경 |
| 저장소 이름 | `taskboard-lite` | 다른 이름을 쓰면 8단계 주의사항 참고 |

---

## 1. Supabase 프로젝트 생성

1. <https://supabase.com/dashboard> → **New project**
2. 입력값

   | 항목 | 값 |
   |---|---|
   | Name | `taskboard-lite` |
   | Database Password | **강한 비밀번호를 생성하고 어딘가에 보관** |
   | Region | **Northeast Asia (Seoul)** |
   | Plan | Free |

3. **Create new project** → 프로비저닝에 1~2분 걸립니다.

> **Database Password 는 앱에서 쓰지 않습니다.** DB에 직접 접속하거나 복구할 때만 필요합니다.
> 잃어버려도 대시보드에서 재설정할 수 있지만, 지금 비밀번호 관리자에 넣어 두세요.

> **왜 Seoul 인가**: 팀이 국내에 있다면 왕복 지연이 100ms 이상 줄어듭니다.
> 리전은 **나중에 변경할 수 없으므로** 여기서 제대로 골라야 합니다.

---

## 2. 테이블과 RLS 만들기

1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 [`supabase/schema.sql`](../supabase/schema.sql) 파일을 열어 **전체 복사**
3. 편집기에 붙여넣고 **Run** (또는 `Ctrl/Cmd + Enter`)
4. `Success. No rows returned` 이 나오면 성공입니다.

**확인** — 같은 편집기에서 아래를 실행하세요.

```sql
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' order by tablename, cmd;
```

`profiles / tasks / checkpoints / issues / weekly_reports` 각 4개씩 **총 20행**이 나와야 합니다.
**Table Editor** 메뉴에서도 테이블 5개가 보입니다.

> 이 스크립트는 여러 번 실행해도 안전합니다. 나중에 정책을 손봤다가 되돌리고 싶으면 다시 Run 하면 됩니다.

---

## 3. 로그인 정책 설정 (중요)

**Authentication** → **Sign In / Providers** (버전에 따라 **Providers**) → **Email** 을 엽니다.

| 설정 | 값 | 이유 |
|---|---|---|
| Enable Email provider | **ON** | 아이디+비밀번호 로그인 |
| **Confirm email** | **OFF** | 메일을 보내지 않습니다. `@team.local` 은 실제 주소가 아니라 확인 메일이 도착할 수 없습니다 |
| **Allow new users to sign up** (Enable signup) | **OFF** | 등록된 8명 외에는 가입 불가 |
| Minimum password length | 6 (기본) | 그대로 두어도 됩니다 |

**Save** 를 누릅니다.

> `Allow new users to sign up` 토글이 Email 화면에 없으면
> **Authentication → Settings(또는 General)** 아래에 있습니다. 대시보드 버전에 따라 위치가 다릅니다.

> **이 두 개를 끄는 것이 이 앱의 보안 설계 전부입니다.**
> GitHub Pages URL 은 인터넷 전체에 공개되므로, 셀프 가입이 열려 있으면 누구나 계정을 만들어
> 팀의 업무명·이슈 내용을 열람하고 수정할 수 있습니다.

---

## 4. 팀원 8명 계정 만들기

**Authentication** → **Users** → **Add user** → **Create new user**

각 팀원마다:

| 항목 | 값 |
|---|---|
| Email | `hong@team.local` |
| Password | 초기 비밀번호 (6자 이상) |
| **Auto Confirm User** | **반드시 체크** |

> `Auto Confirm User` 를 체크하지 않으면 그 계정은 확인 메일을 기다리는 상태로 남아
> **로그인이 되지 않습니다.** `@team.local` 로는 메일이 도착할 수 없으니 되살릴 방법이 없습니다.
> 실수했다면 그 사용자를 지우고 다시 만드세요.

8명을 전부 만들면 Users 목록에 8행이 보입니다. 아이디와 초기 비밀번호를 각자에게 전달하세요.

**아이디 형식은 자유입니다.** `hong@team.local`, `hong@ourteam.kr`, 실제 사내 메일 주소 —
Supabase 는 메일 형식만 맞으면 받아들이고, 확인 메일도 보내지 않습니다.
사내 메일 주소를 그대로 쓰면 팀원이 아이디를 외우기 쉽습니다.

---

## 5. API 키 확인

**Project Settings**(톱니바퀴) → **API** (또는 **API Keys**)

| 화면의 이름 | 넣을 곳 |
|---|---|
| **Project URL** — `https://xxxxxxxx.supabase.co` | `VITE_SUPABASE_URL` |
| **anon / public** 키 (신버전은 **Publishable key**, `sb_publishable_...`) | `VITE_SUPABASE_ANON_KEY` |

두 값을 복사해 두세요. 6단계와 8단계에서 씁니다.

> ### ⚠️ `service_role` / `secret` 키는 절대 쓰지 마세요
>
> 그 키는 **RLS를 전부 무시**합니다. 이 앱은 정적 사이트라 넣는 순간 브라우저 개발자도구에
> 그대로 노출되고, URL 을 아는 누구나 테이블 전체를 읽고 지울 수 있게 됩니다.
> `.env` 에는 **anon(publishable) 키만** 넣습니다.
>
> anon 키는 공개돼도 괜찮습니다. RLS 정책이 `auth.uid() is not null` 을 요구하므로
> 로그인하지 않으면 아무 데이터도 읽히지 않습니다.

---

## 6. 로컬에서 실행해 보기

```bash
cd /Users/milliontube/Documents/PMSchedule

cp .env.example .env
# .env 를 열어 5단계의 두 값을 붙여넣습니다

npm install
npm run dev
```

터미널에 뜨는 <http://localhost:5173/taskboard-lite/> 를 엽니다.

1. 로그인 화면이 보입니다 → 4단계에서 만든 아이디·비밀번호로 로그인
2. 처음이면 **이름·파트 입력** 화면이 뜹니다 → 입력하면 `profiles` 행이 생깁니다
3. **내 업무** 화면 진입 → `N` 키를 눌러 업무를 하나 등록해 보세요

`.env` 는 `.gitignore` 에 들어 있어 커밋되지 않습니다.

---

## 7. 팀장을 admin 으로 지정

`profiles` 행은 **최초 로그인 후에** 생기므로, 팀장이 6단계에서 한 번 로그인한 뒤에 실행합니다.

**SQL Editor** 에서:

```sql
update profiles set is_admin = true
where id = (select id from auth.users where email = 'lead@team.local');
```

`lead@team.local` 을 팀장 아이디로 바꾸세요. `UPDATE 1` 이 나오면 성공입니다.

admin 이 갖는 권한은 **업무 삭제 하나뿐**입니다. 그 외에는 8명 모두 동일합니다.

---

## 8. GitHub Pages 배포

### 8-1. 저장소 만들고 올리기

**이 저장소는 이미 만들어져 있습니다** — <https://github.com/viralfactory/taskboard-lite>
이후 변경은 아래처럼 push 하면 자동 배포됩니다.

```bash
cd /Users/milliontube/Documents/PMSchedule
git add -A
git commit -m "변경 내용"
git push
```

<details>
<summary>처음부터 다시 만들어야 한다면</summary>

```bash
git init && git add . && git commit -m "최초 구현" && git branch -M main
gh repo create taskboard-lite --public --source=. --remote=origin --push
gh api -X POST repos/<계정>/taskboard-lite/pages -f build_type=workflow
```
</details>

> **저장소 이름을 `taskboard-lite` 가 아닌 것으로 만들었다면**
> `vite.config.ts` 의 `base` 를 `'/실제저장소이름/'` 으로 고치고 다시 push 하세요.
> 이게 안 맞으면 배포된 페이지가 흰 화면으로 나옵니다.

> **Free 플랜에서 Pages 는 Public 저장소에서만 동작합니다.** Private 저장소로 Pages 를
> 쓰려면 GitHub Pro 이상이 필요합니다. 이 프로젝트는 Public 으로 만들었습니다 —
> `.env` 는 커밋되지 않고 Supabase 키는 Actions Secrets 로만 주입되므로 저장소에 비밀은 없습니다.
>
> 다만 **배포된 앱 주소는 어느 경우든 인터넷에 공개**됩니다. 3단계의 로그인 설정
> (셀프 가입 OFF)이 팀 데이터를 지키는 유일한 장치인 이유입니다.

### 8-2. Secrets 등록

**Settings** → **Secrets and variables** → **Actions** → **New repository secret** 로 2개:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | 5단계의 Project URL |
| `VITE_SUPABASE_ANON_KEY` | 5단계의 anon(publishable) 키 |

### 8-3. Pages 켜기

**Settings** → **Pages** → **Source** 를 **GitHub Actions** 로 변경합니다.

### 8-4. 배포 확인

**Actions** 탭에서 `Deploy to GitHub Pages` 워크플로가 도는 것을 봅니다.
`npm ci → npm test → npm run build → deploy` 순서로 2~3분 걸립니다.

완료되면 주소는 `https://<계정>.github.io/taskboard-lite/` 입니다.
이 주소를 팀원 8명에게 전달하면 끝입니다.

이후 `main` 에 push 할 때마다 자동으로 다시 배포됩니다.

---

## 9. 동작 확인 체크리스트

기획서 13장의 항목입니다. 배포 URL 에서 순서대로 확인하세요.

| # | 확인 항목 | 기대 |
|---|---|---|
| 1 | Pages URL 접속 | 아이디/비밀번호 로그인 화면 |
| 2 | 등록되지 않은 아이디로 로그인 시도 | 실패 (셀프 가입 화면 자체가 없음) |
| 3 | 최초 로그인 | 이름·파트 입력 후 진입 |
| 4 | 새로고침 | 로그인 유지 |
| 5 | **업무 1건 등록 시간 (팀원 3명 평균)** | **30초 이내** |
| 6 | 등록 폼을 키보드만으로 저장 | `N` → 타이핑 → `Tab` → `1~4` → `Enter` |
| 7 | 중분류 선택 | 체크포인트 자동 생성 |
| 8 | 복제 `⧉` 등록 | 5초 이내 |
| 9 | 마감일 비우고 저장 | 차단 |
| 10 | 체크포인트 체크 | 진척률·신호등 즉시 변경 |
| 11 | 마감일 변경 | 사유 입력 강제, 변경 횟수 증가 |
| 12 | 주간보고 | 이번 주 완료 건이 실제로 집계됨 |
| 13 | 엑셀 다운로드 | 4개 시트, 신호 열 배경색, 1행 고정 |
| 14 | 엑셀 시트 4(요약) | 그대로 임원에게 보낼 수 있는 수준인지 눈으로 확인 |
| 15 | 개발자도구 → Network | `service_role` 키가 어디에도 없음 |

> 5번이 30초를 넘으면 기획서 7.7절의 순서대로 필드를 덜어냅니다.
> ① 체크포인트 확인 생략 → ② 대분류 5개를 3개로 → ③ 업무명만으로 저장 가능하게.

---

## 10. 문제가 생겼을 때

| 증상 | 원인 | 조치 |
|---|---|---|
| `Invalid login credentials` | 비밀번호 오타, 또는 `Auto Confirm User` 미체크 | Users 목록에서 해당 계정 삭제 후 **Auto Confirm 체크하고** 재생성 |
| `Email not confirmed` | 3단계 `Confirm email` 이 ON | OFF 로 바꾸고, 기존 계정은 재생성 |
| 로그인은 되는데 목록이 비어 있음 | RLS 정책 누락 | 2단계 확인 쿼리로 20행이 나오는지 점검, 안 되면 `schema.sql` 재실행 |
| `new row violates row-level security policy` | 정책 누락 또는 로그인 세션 만료 | 로그아웃 후 재로그인 → 그래도면 `schema.sql` 재실행 |
| 저장은 되는데 남의 업무가 안 보임 | 정상 아님 | `read_all` 정책이 5개 테이블 전부에 있는지 확인 |
| 배포 페이지가 흰 화면 | `vite.config.ts` 의 `base` 와 저장소 이름 불일치 | `base` 를 `'/저장소이름/'` 으로 수정 후 push |
| 배포 페이지에서 로그인 시 네트워크 오류 | Secrets 미등록 또는 오타 | 8-2 확인 후 **Actions 에서 재실행** (Secrets 는 빌드 시점에 주입됨) |
| Actions 가 `npm ci` 에서 실패 | `package-lock.json` 미커밋 | `git add package-lock.json` 후 push |
| 며칠 뒤 갑자기 전부 안 됨 | Free 플랜은 **7일간 요청이 없으면 프로젝트 일시정지** | 대시보드에서 **Restore** 클릭. 8명이 매일 쓰면 발생하지 않습니다 |

**로그를 보는 곳**: Supabase 대시보드 → **Logs** → `API` / `Postgres`.
브라우저는 개발자도구 → Console / Network 탭.

---

## 11. 운영

**비밀번호를 잊은 팀원** — 비밀번호 찾기 화면은 만들지 않았습니다.
팀장이 Authentication → Users → 해당 사용자 → **Reset password**(또는 계정 삭제 후 재생성)로 새 비밀번호를 정해 전달합니다.
팀원은 로그인 후 왼쪽 메뉴 **비밀번호 변경**에서 본인이 바꿉니다.

**퇴사·인사이동** — Authentication → Users 에서 계정을 삭제하면 접속이 막힙니다.
`profiles` 는 `on delete cascade` 라 함께 지워지고, 그 사람의 업무도 따라 지워집니다.
**기록을 남겨야 한다면 계정 삭제 전에 리포트 화면에서 엑셀을 받아 두세요.**

**카테고리·체크포인트 변경** — [`src/lib/categories.ts`](../src/lib/categories.ts) 의 `TEMPLATES` 만 고쳐서 push 하면 됩니다. DB 작업은 필요 없습니다.

**백업** — 대시보드 → Database → **Backups**. Free 플랜은 자동 백업이 제한적이므로,
월 1회 리포트 화면에서 엑셀을 받아 두는 것으로 충분합니다.

**무료 한도** — 8명 사용 기준으로 어느 쪽도 근처에 가지 않습니다.

| 항목 | Free 한도 | 예상 사용 |
|---|---|---|
| DB 용량 | 500MB | 연간 수 MB |
| 월간 활성 사용자 | 50,000 | 8 |
| API 요청 | 무제한 | — |
| GitHub Pages | 월 100GB 전송 | 무시할 수준 |

---

## 부록. 명령어 요약

```bash
npm install      # 최초 1회
npm run dev      # 개발 서버 (localhost:5173/taskboard-lite/)
npm test         # 진척 로직 · 엑셀 생성 단위 테스트 26개
npm run build    # 타입체크 + 프로덕션 빌드
npm run preview  # 빌드 결과를 로컬에서 확인
```
