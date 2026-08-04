// Material 3 색상 시스템.
// 구글 공식 유틸리티로 소스 색상 하나에서 색 역할(color role) 전체를 만든다.
// 만들어진 값은 CSS 변수로 :root 에 꽂고, Tailwind 토큰이 그 변수를 참조한다.

import { argbFromHex, hexFromArgb, themeFromSourceColor } from '@material/material-color-utilities'

export interface Preset {
  id: string
  label: string
  source: string
}

/** 색상 스타일 프리셋. source 하나에서 팔레트 전체가 생성된다. */
export const PRESETS: Preset[] = [
  { id: 'purple', label: '보라 (Material 기본)', source: '#6750A4' },
  { id: 'blue', label: '블루', source: '#0B57D0' },
  { id: 'teal', label: '틸', source: '#00696E' },
  { id: 'green', label: '그린', source: '#146C2E' },
  { id: 'orange', label: '오렌지', source: '#9A4600' },
  { id: 'rose', label: '로즈', source: '#8F4A5A' },
  { id: 'slate', label: '뉴트럴', source: '#4A5568' },
]

export const DEFAULT_SOURCE = PRESETS[0].source

/** CSS 변수 이름 ↔ M3 색 역할 */
const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground',
  'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'outline', 'outlineVariant',
  'inverseSurface', 'inverseOnSurface', 'inversePrimary',
  'shadow', 'scrim',
] as const

type Role = (typeof ROLES)[number]

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

/**
 * M3 는 surface 위에 primary 를 얇게 섞어 단계(surface container)를 만든다.
 * 공식 스펙의 톤 값(light: 94/96/92/87 …)에 대응하도록 뉴트럴 팔레트에서 직접 뽑는다.
 */
const CONTAINER_TONES: Record<string, number> = {
  'surface-container-lowest': 100,
  'surface-container-low': 96,
  'surface-container': 94,
  'surface-container-high': 92,
  'surface-container-highest': 90,
  'surface-dim': 87,
  'surface-bright': 98,
}

export function buildTokens(sourceHex: string): Record<string, string> {
  const theme = themeFromSourceColor(argbFromHex(sourceHex))
  const scheme = theme.schemes.light as unknown as Record<Role, number>
  const out: Record<string, string> = {}

  for (const role of ROLES) {
    const v = scheme[role]
    if (typeof v === 'number') out[kebab(role)] = hexFromArgb(v)
  }
  for (const [name, tone] of Object.entries(CONTAINER_TONES)) {
    out[name] = hexFromArgb(theme.palettes.neutral.tone(tone))
  }
  // 신호등은 의미가 고정된 색이라 팔레트에서 만들지 않고 M3 톤 규칙만 따른다
  out['signal-green'] = '#1E6C4A'
  out['signal-green-container'] = '#C6F0DA'
  out['signal-yellow'] = '#7A5900'
  out['signal-yellow-container'] = '#FFE08A'
  out['signal-red'] = '#B3261E'
  out['signal-red-container'] = '#F9DEDC'

  return out
}

const KEY = 'tbl.themeSource'

export function loadSource(): string {
  try {
    const v = localStorage.getItem(KEY)
    return v && /^#[0-9a-f]{6}$/i.test(v) ? v : DEFAULT_SOURCE
  } catch {
    return DEFAULT_SOURCE
  }
}

export function saveSource(hex: string) {
  try {
    localStorage.setItem(KEY, hex)
  } catch {
    /* 저장 실패해도 화면은 이미 적용돼 있다 */
  }
}

/** 생성한 토큰을 :root 에 꽂는다 */
export function applyTheme(sourceHex: string) {
  const tokens = buildTokens(sourceHex)
  const root = document.documentElement
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(`--md-${k}`, v)
  root.style.setProperty('--md-source', sourceHex)
}
