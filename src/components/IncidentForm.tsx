import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createIncident } from '../lib/api'
import { CAUSE_TYPES, SEVERITY, SEVERITY_CRITERIA, SEVERITY_ORDER, SYSTEMS, type Severity } from '../lib/constants'
import { addDays, todayStr } from '../lib/dates'
import { useAuth } from '../hooks/useAuth'

// ─────────────────────────────────────────────────────────────
// SPEC-V2 4.1 — 장애 등록 20초.
// 보이는 입력은 제목·시스템·등급·발생일 4개뿐.
// 원인유형·조치·재발방지는 접힌 영역이고 미입력 상태로 저장 가능하다.
// 장애는 발생 직후 경황이 없을 때 기록하므로 업무 등록보다 짧아야 한다.
// ─────────────────────────────────────────────────────────────

export default function IncidentForm({ onClose }: { onClose: () => void }) {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const titleRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [system, setSystem] = useState<string>(SYSTEMS[0])
  const [severity, setSeverity] = useState<Severity>('critical')
  const [occurredAt, setOccurredAt] = useState(todayStr())
  const [causeType, setCauseType] = useState('')
  const [action, setAction] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [err, setErr] = useState('')
  const [flash, setFlash] = useState('')

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const dateChips = [
    { label: `오늘(${md(todayStr())})`, value: todayStr() },
    { label: `어제(${md(addDays(todayStr(), -1))})`, value: addDays(todayStr(), -1) },
  ]

  const save = useMutation({
    mutationFn: async (keepOpen: boolean) => {
      if (!userId) throw new Error('로그인이 필요합니다.')
      if (!title.trim()) throw new Error('제목을 입력하세요.')
      if (!occurredAt) throw new Error('발생일이 필요합니다.')
      await createIncident({
        occurred_at: occurredAt,
        title: title.trim(),
        system,
        severity,
        cause_type: causeType || null,
        action: action.trim() || null,
        recurrence_action: recurrence.trim() || null,
        reporter_id: userId,
      })
      return keepOpen
    },
    onSuccess: (keepOpen) => {
      void qc.invalidateQueries({ queryKey: ['incidents'] })
      if (keepOpen) {
        setTitle('')
        setAction('')
        setRecurrence('')
        setErr('')
        setFlash('저장했습니다. 이어서 등록하세요.')
        setTimeout(() => setFlash(''), 1800)
        titleRef.current?.focus()
      } else {
        onClose()
      }
    },
    onError: (e: Error) => setErr(e.message),
  })

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'Enter') {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'BUTTON') return
      e.preventDefault()
      save.mutate(e.ctrlKey || e.metaKey)
    }
  }

  function chipKeys(e: React.KeyboardEvent, pick: (i: number) => void, count: number) {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
    const n = Number(e.key)
    if (n >= 1 && n <= Math.min(4, count)) {
      e.preventDefault()
      pick(n - 1)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-lg mt-8 md:mt-16 p-6"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold">장애 등록</h2>
          <button onClick={onClose} className="text-xs text-slate-400">
            Esc
          </button>
        </div>

        <input
          ref={titleRef}
          className="field text-base mb-5"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 외국인 온라인 회원가입 500 오류"
        />

        <ChipRow label="시스템">
          <div className="flex flex-wrap gap-1.5" tabIndex={-1} onKeyDown={(e) => chipKeys(e, (i) => setSystem(SYSTEMS[i]), SYSTEMS.length)}>
            {SYSTEMS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setSystem(s)}
                className={`chip ${system === s ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 hover:bg-slate-50'}`}
              >
                <span className="opacity-50 mr-1 text-[11px]">{i + 1}</span>
                {s}
              </button>
            ))}
          </div>
        </ChipRow>

        <ChipRow label="등급">
          <div className="flex flex-wrap gap-1.5" tabIndex={-1} onKeyDown={(e) => chipKeys(e, (i) => setSeverity(SEVERITY_ORDER[i]), 3)}>
            {SEVERITY_ORDER.map((s, i) => {
              const on = severity === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  title={SEVERITY_CRITERIA[s]}
                  className="chip border"
                  style={
                    on
                      ? { background: `#${SEVERITY[s].bg}`, borderColor: `#${SEVERITY[s].color}`, color: `#${SEVERITY[s].color}`, fontWeight: 600 }
                      : { borderColor: '#cbd5e1' }
                  }
                >
                  <span className="opacity-50 mr-1 text-[11px]">{i + 1}</span>
                  {SEVERITY[s].label}
                </button>
              )
            })}
          </div>
          {/* 등급 기준을 화면에 띄워 판단이 사람마다 갈리지 않게 한다 */}
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{SEVERITY_CRITERIA[severity]}</p>
        </ChipRow>

        <ChipRow label="발생일">
          <div className="flex flex-wrap gap-1.5 items-center" tabIndex={-1} onKeyDown={(e) => chipKeys(e, (i) => setOccurredAt(dateChips[i].value), 2)}>
            {dateChips.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setOccurredAt(c.value)}
                className={`chip ${occurredAt === c.value ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 hover:bg-slate-50'}`}
              >
                <span className="opacity-50 mr-1 text-[11px]">{i + 1}</span>
                {c.label}
              </button>
            ))}
            <input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="chip border-slate-300 text-xs"
            />
          </div>
        </ChipRow>

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="text-xs text-slate-400 mb-3"
          tabIndex={-1}
        >
          {moreOpen ? '▾' : '▸'} 원인유형·조치내용·재발방지 (나중에 입력 가능)
        </button>

        {moreOpen && (
          <div className="space-y-3 mb-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">원인유형</div>
              <div className="flex flex-wrap gap-1.5">
                {CAUSE_TYPES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCauseType(causeType === c ? '' : c)}
                    className={`chip text-xs ${causeType === c ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">조치 내용</div>
              <textarea className="field h-16 resize-none" value={action} onChange={(e) => setAction(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">재발방지 대책</div>
              <textarea
                className="field h-16 resize-none"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                placeholder={severity === 'critical' ? '매우심각 등급은 필수 입력 대상입니다 (나중에 입력 가능)' : ''}
              />
            </div>
          </div>
        )}

        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        {flash && <p className="text-sm text-emerald-600 mb-3">{flash}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => save.mutate(true)} disabled={save.isPending} className="btn border border-slate-300">
            저장 후 계속 <span className="text-slate-400 text-xs">⌃⏎</span>
          </button>
          <button type="button" onClick={() => save.mutate(false)} disabled={save.isPending} className="btn bg-slate-900 text-white">
            저장 <span className="opacity-60 text-xs">⏎</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-slate-500 mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function md(d: string) {
  const [, m, day] = d.split('-')
  return `${Number(m)}/${Number(day)}`
}
