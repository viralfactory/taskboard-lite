# TaskBoard Lite

8명 팀 작업관리 도구. 업무 등록 → 체크포인트로 진척 갱신 → 주간보고·엑셀 리포트.
GitHub Pages 정적 배포 + Supabase(Postgres + Auth). 서버 없음.

| 문서 | 내용 |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | **설치·환경구축 전체 안내** — Supabase 생성부터 배포·문제해결까지 |
| [`docs/SPEC.md`](docs/SPEC.md) | 기획 원본 |
| [`CLAUDE.md`](CLAUDE.md) | 개발 규칙 · 기획서와 다르게 구현한 부분 |

## 1. 빠른 시작

처음이라면 [`docs/SETUP.md`](docs/SETUP.md) 를 순서대로 따라가세요. 요약하면:

1. Supabase 프로젝트 생성 (리전 **Seoul**)
2. SQL Editor 에 [`supabase/schema.sql`](supabase/schema.sql) 전체 실행
3. Authentication > Email 에서 `Confirm email` **OFF**, `Allow new users to sign up` **OFF**
4. Authentication > Users 에서 팀원 8명 생성 (**Auto Confirm User 체크**)
5. 로컬 실행
   ```bash
   cp .env.example .env    # Project URL + anon(publishable) key
   npm install
   npm run dev
   ```
6. GitHub 저장소 push → Pages Source 를 **GitHub Actions** 로 → Secrets 2개 등록

`anon key` 만 사용합니다. **`service_role` key 는 절대 넣지 마세요** — 정적 사이트라 브라우저에 그대로 노출되고 RLS가 무력화됩니다.

## 2. 사용법

| 화면 | 경로 | 하는 일 |
|---|---|---|
| 내 업무 | `#/` | 등록·수정·복제, 체크포인트 토글, 이슈 등록 |
| 팀 현황 | `#/team` | 전체 업무, 🔴 상단 고정, 담당자·카테고리·신호 필터 |
| 주간보고 | `#/weekly` | 자동 초안 + 이슈·코멘트 입력 후 제출 / 팀 통합본 |
| 리포트 | `#/report` | 조건 선택 → 미리보기 → 엑셀 4시트 다운로드 |

### 등록 단축키

| 키 | 동작 |
|---|---|
| `N` | 새 업무 등록 폼 열기 |
| `1`~`4` | 포커스된 칩 그룹에서 n번째 선택 |
| `Ctrl+Enter` | 저장 후 폼 유지 (연속 등록) |
| `Enter` | 저장 후 닫기 |
| `Esc` | 취소 |

`⧉` 복제 버튼은 이름·카테고리·체크포인트를 그대로 두고 날짜만 다음 주기로 옮깁니다.

## 3. 카테고리·체크포인트 바꾸기

[`src/lib/categories.ts`](src/lib/categories.ts) 의 `TEMPLATES` 만 수정하고 push 하면 됩니다.
DB 작업은 필요 없습니다. 산출물은 각 템플릿의 **마지막 항목**으로 자동 설정됩니다.

## 4. 개발 명령

```bash
npm run dev     # 개발 서버
npm test        # 진척 로직 · 엑셀 생성 단위 테스트 (26개)
npm run build   # 타입체크 + 프로덕션 빌드
```
