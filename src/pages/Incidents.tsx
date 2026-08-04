import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listIncidents, updateIncident } from '../lib/api'
import {
  CAUSE_TYPES,
  CRITICAL_ACTION_HOURS,
  INCIDENT_STATUS,
  SEVERITY,
  SEVERITY_ORDER,
  STALE_INCIDENT_DAYS,
  SYSTEMS,
  type Severity,
} from '../lib/constants'
import { addMonths, diffDays, monthRange, recentMonths, todayStr, yearMonth } from '../lib/dates'
import { diffText } from '../lib/monthly'
import IncidentForm from '../components/IncidentForm'
import { useCustomOptions } from '../hooks/useCustomOptions'
import { friendlyError } from '../lib/errors'
import type { Incident } from '../lib/types'

export default function Incidents() {
  const qc = useQueryClient()
  const { data: incidents = [], isLoading, error: loadError } = useQuery({
    queryKey: ['incidents'],
    queryFn: listIncidents,
    retry: false,
  })

  const [ym, setYm] = useState(yearMonth())
  const [system, setSystem] = useState('all')
  const [sev, setSev] = useState<'all' | Severity>('all')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const { items: customSystems } = useCustomOptions('system')
  const allSystems = [...SYSTEMS, ...customSystems.map((o) => o.name)]

  // I 키로 장애 등록 (업무 등록의 N 과 같은 방식)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (formOpen) return
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'i' || e.key === 'I' || e.key === 'ㅑ') {
        e.preventDefault()
        setFormOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formOpen])

  const ofMonth = (m: string) => {
    const r = monthRange(m)
    return incidents.filter((i) => i.occurred_at >= r.start && i.occurred_at <= r.end)
  }

  const cur = useMemo(() => ofMonth(ym), [incidents, ym])
  const prevCount = useMemo(() => ofMonth(addMonths(ym, -1)).length, [incidents, ym])
  const trend = useMemo(
    () => recentMonths(ym, 7).map((m) => ({ m, label: `${Number(m.slice(5, 7))}월`, count: ofMonth(m).length })),
    [incidents, ym],
  )
  const maxTrend = Math.max(1, ...trend.map((t) => t.count))

  const rows = useMemo(() => {
    const list = cur.filter((i) => {
      if (system !== 'all' && i.system !== system) return false
      if (sev !== 'all' && i.severity !== sev) return false
      if (status !== 'all' && i.status !== status) return false
      return true
    })
    // 미조치 건 상단 고정, 그다음 발생일 내림차순
    return list.sort((a, b) => {
      const ua = a.status === 'resolved' ? 1 : 0
      const ub = b.status === 'resolved' ? 1 : 0
      return ua - ub || b.occurred_at.localeCompare(a.occurred_at)
    })
  }, [cur, system, sev, status])

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">장애 관리</h1>
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => setYm(addMonths(ym, -1))} className="btn text-on-surface-variant">
              ‹
            </button>
            <span className="font-medium">{ym}</span>
            <button onClick={() => setYm(addMonths(ym, 1))} className="btn text-on-surface-variant">
              ›
            </button>
          </div>
        </div>
        <button onClick={() => setFormOpen((v) => !v)} className="btn-filled">
          {formOpen ? '등록 폼 닫기' : '+ 장애 등록'} <span className="opacity-50 text-xs">I</span>
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-md bg-error-container text-on-error-container px-4 py-3 text-body">
          {friendlyError(loadError)}
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_20rem] gap-4 mb-5">
        {/* 등급별 카드 */}
        <div className="grid grid-cols-3 gap-3">
          {SEVERITY_ORDER.map((s) => {
            const n = cur.filter((i) => i.severity === s).length
            return (
              <div
                key={s}
                className="rounded-md border p-3"
                style={{ background: `#${SEVERITY[s].bg}`, borderColor: `#${SEVERITY[s].color}33` }}
              >
                <div className="text-xs font-semibold" style={{ color: `#${SEVERITY[s].color}` }}>
                  {SEVERITY[s].label}
                </div>
                <div className="text-2xl font-bold mt-1" style={{ color: `#${SEVERITY[s].color}` }}>
                  {n}
                  <span className="text-sm font-normal ml-0.5">건</span>
                </div>
              </div>
            )
          })}
          <div className="col-span-3 text-xs text-on-surface-variant">
            당월 <b>{cur.length}건</b> · 전월 {prevCount}건 대비 {diffText(cur.length - prevCount)}
          </div>
        </div>

        {/* 최근 7개월 추이 */}
        <div className="border border-outline-variant rounded-md bg-surface-lowest p-3">
          <div className="text-xs text-on-surface-variant mb-2">최근 7개월 추이</div>
          <div className="flex items-end gap-1.5 h-20">
            {trend.map((t) => (
              <div key={t.m} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-on-surface-variant">{t.count}</span>
                <div
                  className={`w-full rounded-sm ${t.m === ym ? 'bg-primary' : 'bg-slate-200'}`}
                  style={{ height: `${Math.max(3, (t.count / maxTrend) * 52)}px` }}
                />
                <span className="text-[10px] text-on-surface-variant">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select className="chip border-outline text-xs" value={system} onChange={(e) => setSystem(e.target.value)}>
          <option value="all">시스템 전체</option>
          {allSystems.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {(['all', ...SEVERITY_ORDER] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSev(s as 'all' | Severity)}
            className={`chip text-xs ${sev === s ? 'chip-on' : 'border-outline'}`}
          >
            {s === 'all' ? '등급 전체' : SEVERITY[s as Severity].label}
          </button>
        ))}
        <select className="chip border-outline text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">상태 전체</option>
          <option value="responding">조치중</option>
          <option value="resolved">해결</option>
        </select>
      </div>

      {formOpen && <IncidentForm onClose={() => setFormOpen(false)} />}

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <div className="text-sm text-on-surface-variant border border-dashed border-outline-variant rounded-md p-10 text-center">
          이 달 등록된 장애가 없습니다. <b>I</b> 키를 눌러 등록하세요.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((i) => (
            <IncidentRow key={i.id} incident={i} onChanged={() => qc.invalidateQueries({ queryKey: ['incidents'] })} />
          ))}
        </div>
      )}
    </div>
  )
}

/** 매우심각인데 24시간 내 조치가 안 들어온 건 */
export function isCriticalOverdue(i: Incident, now = new Date()): boolean {
  if (i.severity !== 'critical' || i.status === 'resolved') return false
  if (i.action?.trim()) return false
  const hours = (now.getTime() - new Date(i.created_at).getTime()) / 3600000
  return hours > CRITICAL_ACTION_HOURS
}

function IncidentRow({ incident: i, onChanged }: { incident: Incident; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const patch = useMutation({
    mutationFn: (v: Partial<Incident>) => updateIncident(i.id, v),
    onSuccess: onChanged,
  })

  const sev = SEVERITY[i.severity]
  const overdue = isCriticalOverdue(i)
  const elapsed = diffDays(i.occurred_at, i.resolved_at ? i.resolved_at.slice(0, 10) : todayStr())
  const stale = i.status !== 'resolved' && elapsed >= STALE_INCIDENT_DAYS

  return (
    <div
      className={`bg-surface-lowest border rounded-md ${overdue ? 'border-error ring-1 ring-error/30' : 'border-outline-variant'}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button onClick={() => setOpen((v) => !v)} className="text-on-surface-variant/60 w-4 shrink-0">
          {open ? '▾' : '▸'}
        </button>

        <span
          className="text-[11px] px-2 py-0.5 rounded-full shrink-0 font-medium"
          style={{ background: `#${sev.bg}`, color: `#${sev.color}` }}
        >
          {sev.label}
        </span>

        <div className="min-w-0 flex-1">
          <div className={`text-sm truncate ${i.status === 'resolved' ? 'text-on-surface-variant' : ''}`}>{i.title}</div>
          <div className="text-[11px] text-on-surface-variant mt-0.5 truncate">
            {i.system} · {i.occurred_at} · 경과 {elapsed}일
            {i.cause_type && ` · ${i.cause_type}`}
            {overdue && <span className="text-error font-medium"> · 24시간 내 조치 미입력</span>}
            {!overdue && stale && <span className="text-signal-yellow"> · {elapsed}일 미조치</span>}
          </div>
        </div>

        <select
          className="chip border-outline text-xs shrink-0"
          value={i.status}
          onChange={(e) => patch.mutate({ status: e.target.value as Incident['status'] })}
        >
          {Object.entries(INCIDENT_STATUS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {open && (
        <div className="border-t border-outline-variant px-3 py-3 space-y-3">
          <div>
            <div className="text-xs text-on-surface-variant mb-1">원인유형</div>
            <div className="flex flex-wrap gap-1.5">
              {CAUSE_TYPES.map((c) => (
                <button
                  key={c}
                  onClick={() => patch.mutate({ cause_type: i.cause_type === c ? null : c })}
                  className={`chip text-xs ${i.cause_type === c ? 'chip-on' : 'border-outline'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-on-surface-variant mb-1">조치 내용</div>
              <textarea
                className="field h-16 resize-none text-sm"
                defaultValue={i.action ?? ''}
                onBlur={(e) => e.target.value !== (i.action ?? '') && patch.mutate({ action: e.target.value })}
              />
            </div>
            <div>
              <div className="text-xs text-on-surface-variant mb-1">
                재발방지 대책
                {i.severity === 'critical' && <span className="text-error ml-1">필수</span>}
              </div>
              <textarea
                className="field h-16 resize-none text-sm"
                defaultValue={i.recurrence_action ?? ''}
                onBlur={(e) =>
                  e.target.value !== (i.recurrence_action ?? '') &&
                  patch.mutate({ recurrence_action: e.target.value })
                }
              />
            </div>
          </div>

          {i.severity === 'critical' && !i.recurrence_action?.trim() && (
            <p className="text-xs text-error">
              매우심각 장애는 재발방지 대책이 필수입니다 (SPEC-V2 2.2).
            </p>
          )}
        </div>
      )}
    </div>
  )
}
