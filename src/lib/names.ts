/**
 * 메일 주소에서 표시 이름을 뽑는다.
 *   jin@team.local        → Jin
 *   jayce.kim@team.local  → Jayce Kim
 *   sloan_lee@team.local  → Sloan Lee
 * 최초 로그인 화면의 기본값으로만 쓰고, 본인이 고칠 수 있다.
 */
export function nameFromEmail(email: string | null | undefined): string {
  if (!email) return ''
  const local = email.split('@')[0] ?? ''
  return local
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
