# TaskBoard Lite

8명 팀 작업관리 도구. GitHub Pages 정적 배포 + Supabase.
기획 원본: `docs/SPEC.md`

## 최우선 원칙

업무 1건 등록에 30초를 넘기지 않는다.
새 기능을 추가할 때 등록 폼에 입력 필드를 늘리는 방식은 금지.

## 절대 규칙

- HashRouter만 사용 / vite base 는 '/taskboard-lite/'
- 컴포넌트에서 supabase 직접 호출 금지 — `src/lib/api.ts` 경유
- 진척률·신호등은 `src/lib/progress.ts` 순수 함수로만
- 등록 폼에 보이는 입력은 업무명·카테고리·마감일 3개까지만
- 체크포인트와 산출물은 `categories.ts` TEMPLATES 에서 자동 생성
- 중요도 필드 만들지 않음
- 회원가입·비밀번호찾기·이메일인증 화면 만들지 않음 (계정은 관리자가 대시보드에서 생성)
- SSO·사내 계정 연동 코드 작성 금지
- 마감일 변경은 사유 없이 불가
- 엑셀 생성은 클라이언트에서만, 서버 호출 없음
- .env 커밋 금지

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
src/lib/       api.ts(모든 DB 접근) supabase.ts progress.ts dates.ts
               categories.ts weekly.ts excel.ts recent.ts types.ts
src/pages/     Login ProfileSetup MyTasks Team Weekly Report
src/components/Layout TaskForm TaskRow SignalBadge IssueModal DueChangeModal
supabase/schema.sql   테이블 + RLS
```

## 명령

```
npm run dev     개발 서버
npm test        진척 로직 단위 테스트
npm run build   타입체크 + 프로덕션 빌드
```
