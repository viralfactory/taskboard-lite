// src/lib/categories.ts — 변경 시 이 파일만 수정 후 push
//
// 업무 1건 = 프로젝트 1개다. 업무명이 곧 프로젝트명이므로 '프로젝트' 대분류는 두지 않는다.
// 진행 단계(요건정의→…→배포)는 중분류가 아니라 체크포인트로 관리한다.
// 체크포인트는 순서대로 하지 않아도 되고, 여러 개를 한 번에 체크할 수 있다.

/** 개발 업무가 지나가는 6단계. 개발 대분류 전체가 이 흐름을 쓴다. */
export const DEV_STAGES = ['요건정의', '분석', '설계', '구현', '테스트', '배포']

export const TEMPLATES: Record<string, Record<string, string[]>> = {
  '개발': {
    'POC':      [...DEV_STAGES],
    '신규개발':  [...DEV_STAGES],
    '기능개선':  [...DEV_STAGES],
    '리팩토링':  [...DEV_STAGES],
    '테스트':    [...DEV_STAGES],
  },
  '운영': {
    '장애대응':   ['원인 파악', '조치 완료', '결과 공유'],
    '정기점검':   ['점검 수행', '점검 결과서'],
    '사용자지원': ['요청 분석', '처리 완료', '요청자 회신'],
    '데이터관리': ['작업 계획', '작업 수행', '결과 검증'],
  },
  // 이 대분류만 활동명을 사용자가 추가할 수 있다. 기본 4개.
  '업무개선/역량': {
    '프로세스개선': ['현황 분석', '개선안 수립', '적용', '효과 확인'],
    '표준화':       ['현황 조사', '표준안 작성', '공유 및 적용'],
    '교육수강':     ['수강 시작', '수강 완료', '학습 정리 공유'],
    '지식공유':     ['자료 준비', '공유 세션', '자료 배포'],
  },
}

export const L1_LIST = Object.keys(TEMPLATES)

export const ISSUE_TYPES = ['기술', '자원', '대외협의', '요건변경', '기타'] as const

/** 사용자가 활동명(중분류)을 추가할 수 있는 유일한 대분류 */
export const CUSTOM_L1 = '업무개선/역량'

/** 사용자가 추가한 활동의 기본 체크포인트 — 등록 폼에서 그대로 고칠 수 있다 */
export const DEFAULT_ACTIVITY_CHECKPOINTS = ['계획 수립', '수행', '결과 정리']

/** 사라진 대분류 → 대체 이름 (구 데이터·localStorage 보정용) */
export const MERGED_L1: Record<string, string> = {
  '개선활동': CUSTOM_L1,
  '역량개발': CUSTOM_L1,
  '프로젝트': '개발', // 업무 자체가 프로젝트이므로 개발로 흡수
}

export function normalizeL1(l1: string): string {
  return MERGED_L1[l1] ?? l1
}

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
