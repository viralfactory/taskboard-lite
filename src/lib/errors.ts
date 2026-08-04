// Supabase 오류를 사람이 읽고 조치할 수 있는 문장으로 바꾼다.
// 화면에서 실패를 조용히 삼키지 않기 위한 것 — 눌렀는데 아무 일도 안 일어나는 상황을 만들지 않는다.

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)

  // 테이블이 없음 (스키마 SQL 미실행)
  if (/PGRST205|schema cache|relation .* does not exist/i.test(msg)) {
    return 'DB에 필요한 테이블이 없습니다. Supabase SQL Editor 에서 supabase/schema-v2.sql → v3 → v4 를 순서대로 실행하세요.'
  }
  // 컬럼이 없음 (일부만 실행)
  if (/PGRST204|column .* does not exist/i.test(msg)) {
    return 'DB 스키마가 앱보다 오래됐습니다. supabase/schema-v2.sql → v3 → v4 를 순서대로 실행하세요.'
  }
  if (/row-level security/i.test(msg)) {
    return '권한이 없어 저장하지 못했습니다. 로그아웃 후 다시 로그인해 보세요.'
  }
  if (/JWT|Invalid API key|not authenticated/i.test(msg)) {
    return '로그인이 만료됐습니다. 다시 로그인하세요.'
  }
  if (/duplicate key|unique constraint/i.test(msg)) {
    return '이미 있는 항목입니다.'
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    return '서버에 연결하지 못했습니다. 네트워크를 확인하세요.'
  }
  return msg
}
