import { describe, it, expect } from 'vitest'
import { friendlyError } from './errors'

describe('friendlyError', () => {
  it('테이블 없음 → 실행할 SQL 을 알려준다', () => {
    const msg = friendlyError(new Error("Could not find the table 'public.daily_reports' in the schema cache"))
    expect(msg).toContain('schema-v2.sql')
  })
  it('컬럼 없음 → 스키마가 오래됐다고 알린다', () => {
    expect(friendlyError(new Error('column tasks.stage does not exist'))).toContain('오래됐')
  })
  it('RLS 거부 → 재로그인 안내', () => {
    expect(friendlyError(new Error('new row violates row-level security policy'))).toContain('권한')
  })
  it('세션 만료', () => {
    expect(friendlyError(new Error('JWT expired'))).toContain('로그인')
  })
  it('중복', () => {
    expect(friendlyError(new Error('duplicate key value violates unique constraint'))).toBe('이미 있는 항목입니다.')
  })
  it('네트워크', () => {
    expect(friendlyError(new Error('Failed to fetch'))).toContain('네트워크')
  })
  it('모르는 오류는 원문 그대로', () => {
    expect(friendlyError(new Error('무언가 이상함'))).toBe('무언가 이상함')
  })
})
