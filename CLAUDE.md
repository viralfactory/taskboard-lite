# TaskBoard Lite

8명 팀 작업관리 도구. GitHub Pages 정적 배포 + Supabase.
기획 원본: `docs/SPEC.md` (v1) · `docs/SPEC-V2.md` (v2 델타 — 운영·장애 + 월간보고)

## 최우선 원칙

업무 1건 등록에 30초를 넘기지 않는다. 장애 1건은 20초.
새 기능을 추가할 때 등록 폼에 입력 필드를 늘리는 방식은 금지.

## 절대 규칙

- HashRouter만 사용 / vite base 는 '/taskboard-lite/'
- 컴포넌트에서 supabase 직접 호출 금지 — `src/lib/api.ts` 경유
- 진척률·신호등은 `src/lib/progress.ts` 순수 함수로만
- **업무 등록 폼에 보이는 입력은 3개(업무명·카테고리·마감일)를 넘기지 않는다.**
  새 필드는 접힌 영역·주간보고·상세 화면으로 보낸다.
- 체크포인트와 산출물은 `categories.ts` TEMPLATES 에서 자동 생성
- 중요도 필드 만들지 않음
- 회원가입·비밀번호찾기·이메일인증 화면 만들지 않음 (계정은 관리자가 대시보드에서 생성)
- SSO·사내 계정 연동 코드 작성 금지
- 마감일 변경은 사유 없이 불가
- 엑셀 생성은 클라이언트에서만, 서버 호출 없음
- .env 커밋 금지

## v2 추가 규칙

- 장애(`incidents`)는 업무(`tasks`)와 별개 엔티티다. 장애를 태스크로 등록하지 않는다.
- 장애 등급 판정 기준은 `constants.ts` 에 고정. 화면에서 임의 등급을 추가하지 않는다.
- 시스템 목록도 `constants.ts` 의 `SYSTEMS` 배열 순서가 화면 순서다.
  (BRS · Workspace · WEB · POVAS · ERP) 팀이 추가한 항목은 뒤에 붙는다.
- `progress_note` 는 등록 시 입력받지 않는다. 주간보고 작성 시에만 입력한다.
- `initial_due_date` 는 사용자가 수정할 수 없다. 최초 저장 시 자동 설정
  (`api.ts` 의 `updateTask` 가 이 필드를 버린다).
- 월간보고의 모든 수치는 `src/lib/monthly.ts` 순수 함수를 거친다. 화면에서 직접 집계 금지.
- PPTX 생성은 클라이언트 pptxgenjs. 서버 호출 없음.
- **PPTX 색상 hex 에 '#' 을 붙이면 파일이 깨진다. 8자리 hex 도 금지.**
  (`exportPptx.test.ts` 가 산출물의 `srgbClr` 을 검사해 이를 막는다)
- PPTX 옵션 객체를 여러 `addText` 에 재사용하지 말 것.

## v3 추가 규칙

- 대분류 `개선활동` + `역량개발` 은 **`업무개선/기타`** 로 통합됐다.
  구 이름이 들어오면 `categories.normalizeL1()` 로 보정한다.
- **기본 목록은 코드 상수가 정본이다.** 팀이 운영하며 덧붙이는 항목만
  `custom_options` 테이블에 쌓는다 (`kind='activity'` 활동명 / `kind='system'` 시스템명).
  활동명을 추가할 수 있는 대분류는 `categories.CUSTOM_L1` 하나뿐이다.
  기본 항목을 DB로 옮기지 말 것 — 템플릿·판정 기준이 코드에 있어야 리뷰가 가능하다.
- 등록 폼은 **팝업이 아니라 목록 위 인라인 섹션**이다. 화면을 가리지 않기 위한 것이므로
  모달로 되돌리지 말 것. (업무 등록·장애 등록 둘 다)

## v4 추가 규칙 (데일리 스크럼)

- **일지는 자동으로 생기지 않는다.** 개발자가 '일지 생성' 을 눌러야 만들어지고,
  그 시점 스냅샷이 `daily_items` 로 복사된다. 복사 뒤로는 일지가 정본이다 —
  원본 업무를 고쳐도 지난 일지는 바뀌지 않는다 (해당일자부터 반영).
- 항목 단위는 **체크포인트**다. To Do = 미완료 체크포인트 / Done = 그날 체크한 것.
- 새로 생긴 업무는 '다시 불러오기' 로 본인이 당긴다. 자동으로 밀어 넣지 않는다.
- **토·일은 제외.** 휴가는 일지에서 그날 체크하며, 표시는 되되 작성은 선택이다.
- 관리자(`is_admin`)가 쓴 일지는 팀 공유 목록에서 제외한다.
- 업무 변경은 `change_history` 에 남긴다. 작업명·기간은 자주 바뀌므로 반드시 포함.
  이력 테이블에는 **update / delete 정책을 만들지 않는다** — 고칠 수 있으면 이력이 아니다.
- 지난 날짜 일지를 고치면 이력을 남긴다. 당일 작성분은 남기지 않는다(잡음).
- **`done_at` 같은 timestamptz 를 `slice(0,10)` 하지 말 것.** UTC 기준이라
  KST 오전 9시 이전 기록이 전날로 잡힌다. `dates.localDateOf()` 를 쓴다.

## 디자인 (Material 3)

- 색상은 `src/lib/theme.ts` 가 **소스 색상 하나에서 팔레트 전체를 생성**한다
  (구글 공식 `@material/material-color-utilities`). 결과는 `--md-*` CSS 변수로
  `:root` 에 꽂히고, `index.css` 의 Tailwind 토큰이 그 변수를 참조한다.
- **화면에 hex 색상을 직접 쓰지 말 것.** `bg-primary`, `text-on-surface-variant`
  같은 M3 색 역할만 쓴다. 사용자가 색을 바꾸면 전부 따라 바뀌어야 한다.
  (신호등·장애 등급처럼 의미가 고정된 색만 예외)
- 버튼은 `.btn`(text) / `.btn-filled` / `.btn-tonal` / `.btn-outlined`,
  칩은 `.chip` / `.chip-on`, 입력은 `.field`, 카드는 `.card`.
- 밀도는 **Compact** 다 (버튼 높이 32px). 표와 목록이 많아 M3 기본 여백을
  그대로 쓰면 한 화면에 보이는 업무 수가 절반이 된다.
- 색상 스타일은 개인 설정이라 `localStorage` 에만 저장한다 (DB 아님).
- `@material/material-color-utilities` 는 내부 import 에 확장자가 없어
  Node ESM 으로 못 읽는다. vitest 는 `server.deps.inline` 로 처리해 뒀다.

## v5 구조 (중요)

- **업무 1건 = 프로젝트 1개.** 업무명이 곧 프로젝트명이므로 `프로젝트` 대분류는 없다.
- **진행 단계는 체크포인트가 담당한다.** 개발 대분류는 전부
  요건정의 → 분석 → 설계 → 구현 → 테스트 → 배포 6단계를 체크포인트로 갖는다.
  `tasks.stage` 컬럼은 더 이상 쓰지 않는다 (DB 에는 남아 있다).
- **현재 단계 = 가장 뒤에 완료된 체크포인트의 다음 것** (`progress.currentStage`).
  체크포인트는 순서대로 하지 않아도 되고 여러 개를 한 번에 체크할 수 있으므로
  '첫 미완료' 로 판정하면 틀린다.
- **2단 구조**: `tasks.parent_id` 로 부모 프로젝트 : 자식 = 1:N. 깊이는 2단계까지만.
  자식을 가진 업무는 다시 자식이 될 수 없다 (등록 폼에서 후보를 걸러 낸다).
- **부모의 진척률·마감일·시작일은 자식에서 끌어올린다** (`progress.rollup*`).
  부모 자체 체크포인트는 세지 않는다.
- **월간보고 안건은 자식 각각을 올린다.** 부모는 묶음이라 안건에서 뺀다.
  단계별 건수(`byStage`)가 자동 집계의 핵심이다.

## 용어

계획진척률 = 경과일 기준 / 실적진척률 = 완료 체크포인트 비율
신호등: SV = 실적 - 계획. -5%p 이상 🟢, -20%p 이상 🟡, 미만 🔴

## 기획서와 다르게 구현한 것

- **엑셀 라이브러리: SheetJS → ExcelJS.** SheetJS 커뮤니티 에디션은 쓰기 시
  셀 배경색과 틀고정(`<pane>`)을 지원하지 않아 SPEC 9장의 서식 요구
  (신호 열 배경색 + `freeze A2`)를 충족할 수 없다. ExcelJS도 브라우저에서
  직접 생성하므로 '서버 불필요' 원칙은 그대로다.
- **최근 사용 카테고리 3개**: `profiles.last_cat_*` 는 1개만 저장하므로,
  나머지 2개는 `localStorage`(`src/lib/recent.ts`)에 둔다. 등록 속도만을 위한
  값이라 테이블을 늘리지 않았다.
- `weekly_reports` 에 `issue_note` 컬럼 추가 (주간보고 4번 항목 저장용).
- **`checkpoints` 삭제 정책만 전원 허용.** SPEC 3장은 '삭제만 admin' 이지만,
  상세 화면에서 체크포인트를 지우는 것은 일반 편집 동작이라 admin 전용으로 두면
  팀원에게 항상 실패하는 버튼이 된다. 나머지 4개 테이블은 삭제 = admin 그대로.

## 구조

```
src/lib/       api.ts(모든 DB 접근) supabase.ts progress.ts dates.ts types.ts
               categories.ts constants.ts recent.ts
               weekly.ts monthly.ts daily.ts  집계 순수 함수
               excel.ts exportPptx.ts        출력 (둘 다 동적 import)
src/pages/     Login ProfileSetup MyTasks Team Incidents Daily Weekly Monthly Report
src/components/Layout TaskForm TaskRow SignalBadge
               IssueModal DueChangeModal IncidentForm HistoryList
supabase/schema.sql      v1 테이블 + RLS
supabase/schema-v2.sql   v2 확장 + 신규 3테이블 (schema.sql 이후 실행)
```

## 라이브러리 선택 이유

- 엑셀: **ExcelJS** (SheetJS 아님). CE 는 쓰기 시 셀 배경색·틀고정을 지원하지 않는다.
- PPTX: **pptxgenjs 4.x**. `varyColors` 옵션은 v4 타입에 없고, 단일 시리즈에
  `chartColors` 배열을 주면 데이터포인트별로 적용된다 (테스트로 확인).
- 둘 다 무거우므로 다운로드 시점에 `await import()` 로 불러온다.

## 명령

```
npm run dev     개발 서버
npm test        단위 테스트 102개 (진척·월간집계·엑셀·PPTX)
npm run build   타입체크 + 프로덕션 빌드
```
