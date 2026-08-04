import { describe, it, expect } from 'vitest'
import { buildTokens, DEFAULT_SOURCE, PRESETS } from './theme'

const HEX = /^#[0-9a-f]{6}$/i

describe('buildTokens', () => {
  it('M3 색 역할을 모두 만든다', () => {
    const t = buildTokens(DEFAULT_SOURCE)
    for (const role of [
      'primary', 'on-primary', 'primary-container', 'on-primary-container',
      'secondary', 'tertiary', 'error', 'surface', 'on-surface',
      'surface-variant', 'on-surface-variant', 'outline', 'outline-variant',
    ]) {
      expect(t[role], role).toMatch(HEX)
    }
  })

  it('surface container 단계를 만든다', () => {
    const t = buildTokens(DEFAULT_SOURCE)
    for (const k of [
      'surface-container-lowest', 'surface-container-low', 'surface-container',
      'surface-container-high', 'surface-container-highest',
    ]) {
      expect(t[k], k).toMatch(HEX)
    }
    // 밝기 순서: lowest 가 가장 밝다
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16)
    expect(lum(t['surface-container-lowest'])).toBeGreaterThan(lum(t['surface-container-highest']))
  })

  it('소스 색상이 바뀌면 primary 도 바뀐다', () => {
    const a = buildTokens('#6750A4')
    const b = buildTokens('#0B57D0')
    expect(a.primary).not.toBe(b.primary)
    expect(a['primary-container']).not.toBe(b['primary-container'])
  })

  it('모든 프리셋이 유효한 팔레트를 만든다', () => {
    for (const p of PRESETS) {
      const t = buildTokens(p.source)
      expect(t.primary, p.id).toMatch(HEX)
      expect(t.surface, p.id).toMatch(HEX)
    }
  })

  it('신호등 색은 팔레트와 무관하게 고정된다', () => {
    const a = buildTokens('#6750A4')
    const b = buildTokens('#146C2E')
    expect(a['signal-red']).toBe(b['signal-red'])
    expect(a['signal-green']).toBe(b['signal-green'])
  })
})
