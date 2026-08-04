import { describe, it, expect } from 'vitest'
import { nameFromEmail } from './names'

describe('nameFromEmail', () => {
  it('메일 앞부분을 이름으로 만든다', () => {
    expect(nameFromEmail('jin@team.local')).toBe('Jin')
    expect(nameFromEmail('jayce@team.local')).toBe('Jayce')
    expect(nameFromEmail('sloan@team.local')).toBe('Sloan')
  })
  it('성은 버리고 첫 단어만 쓴다', () => {
    expect(nameFromEmail('jayce.kim@team.local')).toBe('Jayce')
    expect(nameFromEmail('sloan_lee@team.local')).toBe('Sloan')
    expect(nameFromEmail('min-ho@team.local')).toBe('Min')
  })
  it('이미 대문자면 그대로 둔다', () => {
    expect(nameFromEmail('Steven@team.local')).toBe('Steven')
  })
  it('값이 없으면 빈 문자열', () => {
    expect(nameFromEmail(null)).toBe('')
    expect(nameFromEmail('')).toBe('')
  })
})
