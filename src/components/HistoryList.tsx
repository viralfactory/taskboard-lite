import { useQuery } from '@tanstack/react-query'
import { listHistory } from '../lib/api'
import { useProfiles } from '../hooks/useTasks'

const LABEL: Record<string, string> = {
  name: '업무명',
  start_date: '시작일',
  due_date: '마감일',
  status: '상태',
  stage: '단계',
  assignee_id: '담당자',
  checkpoint: '체크포인트',
  issue_note: '이슈',
  comment: '특이사항',
  is_leave: '휴가',
}

/** 업무·지난 일지의 변경 이력. 이력은 고치거나 지울 수 없다. */
export default function HistoryList({ entity, id }: { entity: 'task' | 'daily'; id: number }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['history', entity, id],
    queryFn: () => listHistory(entity, id),
  })
  const { data: profiles = [] } = useProfiles()
  const nameOf = (uid: string | null) => profiles.find((p) => p.id === uid)?.name ?? '—'
  const valueOf = (field: string, v: string | null) => {
    if (!v) return '(없음)'
    if (field === 'assignee_id') return nameOf(v)
    if (field === 'status') return { doing: '진행', done: '완료', hold: '보류' }[v] ?? v
    if (field === 'is_leave') return v === 'true' ? '휴가' : '해제'
    return v
  }

  if (isLoading) return <p className="text-xs text-slate-400">불러오는 중…</p>
  if (!data.length) return <p className="text-xs text-slate-400">변경 이력이 없습니다.</p>

  return (
    <ul className="text-xs space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
      {data.map((h) => (
        <li key={h.id} className="flex flex-wrap gap-2">
          <span className="text-slate-400 shrink-0">{h.changed_at.slice(0, 16).replace('T', ' ')}</span>
          <span className="text-slate-400 shrink-0">{nameOf(h.changed_by)}</span>
          <span className="shrink-0 font-medium">{LABEL[h.field] ?? h.field}</span>
          <span className="text-slate-600">
            {valueOf(h.field, h.old_value)} → {valueOf(h.field, h.new_value)}
            {h.reason && <span className="text-slate-400"> · {h.reason}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
