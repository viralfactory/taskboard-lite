// v2 상수 (SPEC-V2 3.3). 장애 등급 판정 기준은 여기에 고정한다 —
// 화면에서 임의 등급을 추가하지 않는다. 등급이 사람마다 달라지면 월별 추이가 의미를 잃는다.

/** 기본 시스템. 팀이 운영하며 늘리는 항목은 custom_options(kind='system') 에 쌓인다. */
export const SYSTEMS = ['WEB', 'POVAS', 'BRS', 'Workspace', '공통'] as const
export type SystemName = (typeof SYSTEMS)[number]

export type Severity = 'critical' | 'major' | 'normal'

export const SEVERITY: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: '매우심각', color: 'C0392B', bg: 'FDE8E8' },
  major: { label: '심각', color: 'B7791F', bg: 'FDF6E3' },
  normal: { label: '보통', color: '1E7A5A', bg: 'E4F5EE' },
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'major', 'normal']

/** 등급 판정 기준 — 등록 화면에 그대로 노출해 판단이 갈리지 않게 한다 */
export const SEVERITY_CRITERIA: Record<Severity, string> = {
  critical: '서비스 전면 중단, 결제·주문·가입 실패, 개인정보 노출 위험, 정산·출고 데이터 오류',
  major: '일부 기능 불가하나 우회 수단 존재, 특정 채널·특정 회원군에 한정',
  normal: '화면 표시 오류, 경미한 데이터 불일치, 사용자 영향 제한적',
}

export const CAUSE_TYPES = ['코드결함', '데이터', '인프라', '외부연동', '운영실수', '기타'] as const

export const STAGES = ['dev', '적용', '운영적용', '배포'] as const
export type Stage = (typeof STAGES)[number]

export const INCIDENT_STATUS: Record<string, string> = {
  responding: '조치중',
  resolved: '해결',
}

/** 매우심각 장애는 24시간 내 원인·조치 등록이 필요하다 (SPEC-V2 2.2) */
export const CRITICAL_ACTION_HOURS = 24

/** 등록 후 7일 경과 미조치는 팀장 보고 대상 */
export const STALE_INCIDENT_DAYS = 7
