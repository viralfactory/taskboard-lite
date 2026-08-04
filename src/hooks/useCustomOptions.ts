import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCustomOption, deleteCustomOption, listCustomOptions } from '../lib/api'
import { useAuth } from './useAuth'
import { friendlyError } from '../lib/errors'
import type { CustomOption } from '../lib/types'

/**
 * 팀이 직접 늘리는 목록(활동명·시스템명)을 다룬다.
 * 기본 목록은 코드 상수가 정본이고, 여기 담기는 건 덧붙인 항목뿐이다.
 */
export function useCustomOptions(kind: CustomOption['kind']) {
  const qc = useQueryClient()
  const { userId } = useAuth()
  const { data = [] } = useQuery({
    queryKey: ['customOptions'],
    queryFn: listCustomOptions,
    retry: false, // 테이블이 없어도 기본 목록으로 계속 쓸 수 있어야 한다
  })
  const items = data.filter((o) => o.kind === kind)

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['customOptions'] })

  const add = useMutation({
    mutationFn: (v: { name: string; checkpoints?: string[] }) =>
      createCustomOption({ kind, name: v.name, checkpoints: v.checkpoints, created_by: userId! }),
    onSuccess: invalidate,
  })

  const remove = useMutation({ mutationFn: (id: number) => deleteCustomOption(id), onSuccess: invalidate })

  return { items, add, remove }
}

/** 중복 등록 오류를 사람이 읽을 수 있는 문구로 */
export function optionErrorText(e: unknown): string {
  return friendlyError(e)
}
