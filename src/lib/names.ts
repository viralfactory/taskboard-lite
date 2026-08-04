/**
 * 메일 주소에서 표시 이름을 뽑는다. 성은 빼고 이름만 쓴다.
 *   jin@team.local        → Jin
 *   jayce.kim@team.local  → Jayce
 *   sloan_lee@team.local  → Sloan
 * 최초 로그인 화면의 기본값으로만 쓰고, 본인이 고칠 수 있다.
 */
export function nameFromEmail(email: string | null | undefined): string {
  if (!email) return ''
  const first = (email.split('@')[0] ?? '').split(/[._\-\s]+/).filter(Boolean)[0] ?? ''
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : ''
}
