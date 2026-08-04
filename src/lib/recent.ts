// 최근 사용 카테고리 3개. profiles.last_cat_* 이 정본이고, 나머지 2개는 브라우저에 둔다.
// (등록 속도만을 위한 값이라 서버 테이블을 늘리지 않는다)
import { L1_LIST, normalizeL1 } from './categories'
import type { Profile } from './types'

export interface CatPair {
  l1: string
  l2: string
}

const KEY = 'tbl.recentCats'
const MAX = 3

function read(): CatPair[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    // 통합으로 사라진 대분류가 남아 있을 수 있으므로 보정 후 걸러낸다
    return raw
      .filter((p) => p?.l1 && p?.l2)
      .map((p) => ({ l1: normalizeL1(p.l1), l2: p.l2 }))
      .filter((p, i, arr) => L1_LIST.includes(p.l1) && arr.findIndex((q) => q.l1 === p.l1 && q.l2 === p.l2) === i)
      .slice(0, MAX)
  } catch {
    return []
  }
}

export function recentCats(profile: Profile | null): CatPair[] {
  const list = read()
  if (profile?.last_cat_l1 && profile.last_cat_l2) {
    const head = { l1: normalizeL1(profile.last_cat_l1), l2: profile.last_cat_l2 }
    return [head, ...list.filter((p) => p.l1 !== head.l1 || p.l2 !== head.l2)].slice(0, MAX)
  }
  return list
}

export function pushRecentCat(pair: CatPair) {
  const next = [pair, ...read().filter((p) => p.l1 !== pair.l1 || p.l2 !== pair.l2)].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
}
