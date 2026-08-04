// src/lib/categories.ts — 변경 시 이 파일만 수정 후 push
export const TEMPLATES: Record<string, Record<string, string[]>> = {
  '운영': {
    '장애대응':   ['원인 파악', '조치 완료', '결과 공유'],
    '정기점검':   ['점검 수행', '점검 결과서'],
    '사용자지원': ['요청 분석', '처리 완료', '요청자 회신'],
    '데이터관리': ['작업 계획', '작업 수행', '결과 검증'],
  },
  '개발': {
    'POC':        ['목표·범위 정의', '프로토타입 구현', '검증', '결과 보고'],
    '신규개발':   ['설계', '구현', '테스트', '배포'],
    '기능개선':   ['영향도 분석', '구현', '테스트', '배포'],
    '리팩토링':   ['범위 확정', '리팩토링', '회귀 테스트'],
    '테스트':     ['테스트 케이스 작성', '테스트 수행', '결과 정리'],
  },
  '프로젝트': {
    '요건정의':   ['요건 수집', '요건정의서 작성', '검토 확정'],
    '설계':       ['설계 초안', '리뷰', '설계서 확정'],
    '구현':       ['개발', '단위 테스트', '코드 리뷰'],
    '검증':       ['테스트 수행', '결함 조치', '검증 완료'],
    '이행':       ['이행 계획', '이행 수행', '안정화 확인'],
  },
  // 개선활동 + 역량개발 통합. 이 대분류만 활동명을 사용자가 추가할 수 있다.
  '업무개선/역량': {
    '프로세스개선': ['현황 분석', '개선안 수립', '적용', '효과 확인'],
    '자동화':       ['대상 선정', '개발', '적용 확인'],
    '표준화':       ['현황 조사', '표준안 작성', '공유 및 적용'],
    '교육수강':     ['수강 시작', '수강 완료', '학습 정리 공유'],
    '자격취득':     ['학습 계획', '학습 수행', '응시 및 결과'],
    '기술연구':     ['자료 조사', '실습·검증', '결과 정리'],
    '지식공유':     ['자료 준비', '공유 세션', '자료 배포'],
  },
}

/** 사용자가 활동명(중분류)을 추가할 수 있는 유일한 대분류 */
export const CUSTOM_L1 = '업무개선/역량'

/** 사용자가 추가한 활동의 기본 체크포인트 — 등록 폼에서 그대로 고칠 수 있다 */
export const DEFAULT_ACTIVITY_CHECKPOINTS = ['계획 수립', '수행', '결과 정리']

/** 통합 전 이름 → 통합 후 이름 (구 데이터·localStorage 보정용) */
export const MERGED_L1: Record<string, string> = {
  '개선활동': CUSTOM_L1,
  '역량개발': CUSTOM_L1,
}

export function normalizeL1(l1: string): string {
  return MERGED_L1[l1] ?? l1
}

export const L1_LIST = Object.keys(TEMPLATES)

export const ISSUE_TYPES = ['기술', '자원', '대외협의', '요건변경', '기타'] as const

/** 중분류 템플릿 체크포인트. 알 수 없는 조합이면 빈 배열. */
export function checkpointsOf(l1: string, l2: string): string[] {
  return TEMPLATES[l1]?.[l2] ?? []
}

/** 산출물은 템플릿의 마지막 항목으로 자동 설정된다. */
export function deliverableOf(l1: string, l2: string): string {
  const cps = checkpointsOf(l1, l2)
  return cps.length ? cps[cps.length - 1] : ''
}

/** 화면에 늘어놓기 위한 전체 (대>중) 조합 목록 */
export function allPairs(): { l1: string; l2: string }[] {
  return L1_LIST.flatMap((l1) => Object.keys(TEMPLATES[l1]).map((l2) => ({ l1, l2 })))
}
