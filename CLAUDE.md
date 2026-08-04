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
- **업무 등록 폼에 보이는 입력은 4개(업무명·카테고리·마감일·단계)를 넘기지 않는다.**
  새 필드는 주간보고 또는 상세 화면으로 보낸다.
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
- `progress_note` 는 등록 시 입력받지 않는다. 주간보고 작성 시에만 입력한다.
- `initial_due_date` 는 사용자가 수정할 수 없다. 최초 저장 시 자동 설정
  (`api.ts` 의 `updateTask` 가 이 필드를 버린다).
- 월간보고의 모든 수치는 `src/lib/monthly.ts` 순수 함수를 거친다. 화면에서 직접 집계 금지.
- PPTX 생성은 클라이언트 pptxgenjs. 서버 호출 없음.
- **PPTX 색상 hex 에 '#' 을 붙이면 파일이 깨진다. 8자리 hex 도 금지.**
  (`exportPptx.test.ts` 가 산출물의 `srgbClr` 을 검사해 이를 막는다)
- PPTX 옵션 객체를 여러 `addText` 에 재사용하지 말 것.

## v3 추가 규칙

- 대분류 `개선활동` + `역량개발` 은 **`업무개선/역량`** 으로 통합됐다.
  구 이름이 들어오면 `categories.normalizeL1()` 로 보정한다.
- **기본 목록은 코드 상수가 정본이다.** 팀이 운영하며 덧붙이는 항목만
  `custom_options` 테이블에 쌓는다 (`kind='activity'` 활동명 / `kind='system'` 시스템명).
  기본 항목을 DB로 옮기지 말 것 — 템플릿·판정 기준이 코드에 있어야 리뷰가 가능하다.
- 등록 폼은 **팝업이 아니라 목록 위 인라인 섹션**이다. 화면을 가리지 않기 위한 것이므로
  모달로 되돌리지 말 것. (업무 등록·장애 등록 둘 다)

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
               weekly.ts monthly.ts          집계 순수 함수
               excel.ts exportPptx.ts        출력 (둘 다 동적 import)
src/pages/     Login ProfileSetup MyTasks Team Incidents Weekly Monthly Report
src/components/Layout TaskForm TaskRow SignalBadge
               IssueModal DueChangeModal IncidentForm
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
npm test        단위 테스트 61개 (진척·월간집계·엑셀·PPTX)
npm run build   타입체크 + 프로덕션 빌드
```
