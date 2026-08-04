import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAllWeeklyReports, listIncidents, listIssues } from '../lib/api'
import { buildWorkbook, downloadBlob, filterTasks, type ReportFilter } from '../lib/excel'
import { addWeeks, isoWeek, weekRange, todayStr, parseDate, fmt } from '../lib/dates'
import { progressOf, SIGNAL_EMOJI } from '../lib/progress'
import { useProfiles, useTasks, nameMap } from '../hooks/useTasks'

type Period = 'week' | 'month' | 'custom'

function monthRange(base = todayStr()) {
  const d = parseDate(base)
  return {
    from: fmt(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  }
}

export default function Report() {
  const { data: tasks = [] } = useTasks()
  const { data: profiles = [] } = useProfiles()
  const { data: issues = [] } = useQuery({ queryKey: ['issues'], queryFn: listIssues })
  const { data: reports = [] } = useQuery({ queryKey: ['weeklyAll'], queryFn: listAllWeeklyReports })
  const { data: incidents = [] } = useQuery({ queryKey: ['incidents'], queryFn: listIncidents })
  const names = nameMap(profiles)

  const [period, setPeriod] = useState<Period>('week')
  const [range, setRange] = useState(weekRange(isoWeek()))
  const [assigneeId, setAssigneeId] = useState<string>('all')
  const [signal, setSignal] = useState<'all' | 'red'>('all')
  const [busy, setBusy] = useState(false)

  function pickPeriod(p: Period) {
    setPeriod(p)
    if (p === 'week') setRange(weekRange(isoWeek()))
    if (p === 'month') {
      const m = monthRange()
      setRange({ start: m.from, end: m.to })
    }
  }

  const filter: ReportFilter = { from: range.start, to: range.end, assigneeId, signal }
  const preview = useMemo(() => filterTasks(tasks, filter), [tasks, range.start, range.end, assigneeId, signal])

  /** 기간에 걸친 ISO 주차 목록 (시트 2용) */
  const weeks = useMemo(() => {
    const out: string[] = []
    let w = isoWeek(range.start)
    const last = isoWeek(range.end)
    for (let i = 0; i < 60; i++) {
      out.push(w)
      if (w === last) break
      w = addWeeks(w, 1)
    }
    return out
  }, [range.start, range.end])

  const filename =
    period === 'month'
      ? `팀작업현황_${range.start.slice(0, 7)}.xlsx`
      : `팀작업현황_${isoWeek(range.start)}.xlsx`

  async function download() {
    setBusy(true)
    try {
      const blob = await buildWorkbook({ tasks, issues, profiles, reports, incidents, weeks, filter })
      downloadBlob(blob, filename)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-bold mb-5">리포트</h1>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 w-14">기간</span>
          {(['week', 'month', 'custom'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => pickPeriod(p)}
              className={`chip text-xs ${
                period === p ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'
              }`}
            >
              {{ week: '이번 주', month: '이번 달', custom: '직접' }[p]}
            </button>
          ))}
          <input
            type="date"
            className="chip border-slate-300 text-xs"
            value={range.start}
            onChange={(e) => {
              setPeriod('custom')
              setRange((r) => ({ ...r, start: e.target.value }))
            }}
          />
          <span className="text-slate-300">~</span>
          <input
            type="date"
            className="chip border-slate-300 text-xs"
            value={range.end}
            onChange={(e) => {
              setPeriod('custom')
              setRange((r) => ({ ...r, end: e.target.value }))
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 w-14">담당자</span>
          <select
            className="chip border-slate-300 text-xs"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="all">전체</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 w-14 ml-3">신호</span>
          {(['all', 'red'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSignal(s)}
              className={`chip text-xs ${
                signal === s ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'
              }`}
            >
              {s === 'all' ? '전체' : '🔴 만'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">
          미리보기 <b>{preview.length}</b>건 · 시트 5개 (업무현황 / 주간보고 / 이슈 / 요약 / 장애)
        </p>
        <button
          onClick={() => void download()}
          disabled={busy || preview.length === 0}
          className="btn bg-slate-900 text-white"
        >
          {busy ? '생성 중…' : `엑셀 다운로드 · ${filename}`}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {['대분류', '중분류', '업무명', '담당자', '시작일', '마감일', '실적%', '계획%', '편차', '신호'].map(
                (h) => (
                  <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {preview.slice(0, 50).map((t) => {
              const p = progressOf(t)
              return (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 whitespace-nowrap">{t.cat_l1}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{t.cat_l2}</td>
                  <td className="px-2 py-1.5 max-w-[16rem] truncate">{t.name}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{names[t.assignee_id]}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{t.start_date}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{t.due_date}</td>
                  <td className="px-2 py-1.5">{p.actualPct}</td>
                  <td className="px-2 py-1.5">{p.planPct}</td>
                  <td className="px-2 py-1.5">{p.sv}</td>
                  <td className="px-2 py-1.5">{SIGNAL_EMOJI[p.signal]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {preview.length === 0 && (
          <p className="text-sm text-slate-400 p-8 text-center">조건에 맞는 업무가 없습니다.</p>
        )}
        {preview.length > 50 && (
          <p className="text-xs text-slate-400 px-3 py-2">
            화면에는 50건만 표시합니다. 엑셀에는 {preview.length}건이 모두 들어갑니다.
          </p>
        )}
      </div>
    </div>
  )
}
