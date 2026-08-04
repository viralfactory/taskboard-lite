# TaskBoard Lite

8명 팀 작업관리 도구. 업무 등록 → 체크포인트로 진척 갱신 → 주간보고·엑셀 리포트.
GitHub Pages 정적 배포 + Supabase(Postgres + Auth). 서버 없음.

| 문서 | 내용 |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | **설치·환경구축 전체 안내** — Supabase 생성부터 배포·문제해결까지 |
| [`docs/SPEC.md`](docs/SPEC.md) | 기획 원본 (v1) |
| [`docs/SPEC-V2.md`](docs/SPEC-V2.md) | v2 델타 — 운영·장애 관리 + 월간보고 자동 생성 |
| [`CLAUDE.md`](CLAUDE.md) | 개발 규칙 · 기획서와 다르게 구현한 부분 |

## 1. 빠른 시작

처음이라면 [`docs/SETUP.md`](docs/SETUP.md) 를 순서대로 따라가세요. 요약하면:

1. Supabase 프로젝트 생성 (리전 **Seoul**)
2. SQL Editor 에서 순서대로 실행 —
   [`schema.sql`](supabase/schema.sql) → [`schema-v2.sql`](supabase/schema-v2.sql) → [`schema-v3.sql`](supabase/schema-v3.sql) → [`schema-v4.sql`](supabase/schema-v4.sql)
3. Authentication > Email 에서 `Confirm email` **OFF**, `Allow new users to sign up` **OFF**
4. Authentication > Users 에서 팀원 8명 생성 (**Auto Confirm User 체크**)
5. 로컬 실행
   ```bash
   cp .env.example .env    # Project URL + Publishable key
   npm install
   npm run dev
   ```
6. GitHub 저장소 push → Pages Source 를 **GitHub Actions** 로 → Secrets 2개 등록

Publishable key(구 anon key)만 사용합니다. **Secret key(`sb_secret_…`) 는 절대 넣지 마세요** — 정적 사이트라 브라우저에 그대로 노출되고 RLS가 무력화됩니다.

## 2. 사용법

| 화면 | 경로 | 하는 일 |
|---|---|---|
| 내 업무 | `#/` | 등록·수정·복제, 체크포인트 토글, 이슈 등록 |
| 팀 현황 | `#/team` | 전체 업무, 🔴 상단 고정, 담당자·카테고리·신호 필터 |
| 장애 관리 | `#/incidents` | 20초 등록, 등급별 카드, 7개월 추이, 24시간 미조치 강조 |
| 데일리 | `#/daily` | 일지 생성 시 업무를 가져옴, To Do / Done, 이슈·특이사항, 팀 전체 |
| 주간보고 | `#/weekly` | 자동 초안 + 이슈·코멘트 + 주요 진행 내용 입력 |
| 월간보고 | `#/monthly` | 자동 집계 미리보기 → **PPTX / 엑셀** 다운로드 |
| 리포트 | `#/report` | 조건 선택 → 미리보기 → 엑셀 5시트 다운로드 |

### 등록 단축키

| 키 | 동작 |
|---|---|
| `N` | 새 업무 등록 폼 열기 |
| `I` | 장애 등록 폼 열기 (장애 관리 화면) |
| `1`~`4` | 포커스된 칩 그룹에서 n번째 선택 |
| `Ctrl+Enter` | 저장 후 폼 유지 (연속 등록) |
| `Enter` | 저장 후 닫기 |
| `Esc` | 취소 |

`⧉` 복제 버튼은 이름·카테고리·체크포인트를 그대로 두고 날짜만 다음 주기로 옮깁니다.

## 3. 카테고리·체크포인트 바꾸기

[`src/lib/categories.ts`](src/lib/categories.ts) 의 `TEMPLATES` 만 수정하고 push 하면 됩니다.
DB 작업은 필요 없습니다. 산출물은 각 템플릿의 **마지막 항목**으로 자동 설정됩니다.

**`업무개선/역량` 의 활동명과 장애의 시스템명은 화면에서 바로 추가**할 수 있습니다
(등록 폼 → `전체 ▾` 또는 `+ 시스템`). 추가한 항목은 팀 전체가 공유합니다.

## 4. 개발 명령

```bash
npm run dev     # 개발 서버
npm test        # 단위 테스트 77개 (진척·주간·월간·데일리·엑셀·PPTX)
npm run build   # 타입체크 + 프로덕션 빌드
```
