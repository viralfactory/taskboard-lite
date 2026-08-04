import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addNextMonthPlan,
  deleteNextMonthPlan,
  getMonthlyReport,
  listIncidents,
  listIssues,
  listNextMonthPlans,
  saveMonthlyReport,
} from '../lib/api'
import { addMonths, addWeeks, isoWeek, monthRange, todayStr, yearMonth } from '../lib/dates'
import { buildMonthlyReport } from '../lib/monthly'
import { SEVERITY } from '../lib/constants'
import { useTasks } from '../hooks/useTasks'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'

const STATUS_CLASS: Record<string, string> = {
  완료: 'bg-signal-green-c text-signal-green',
  진행중: 'bg-primary text-on-primary',
  지연: 'bg-signal-red-c text-signal-red',
}

export default function Monthly() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const [ym, setYm] = useState(addMonths(yearMonth(), -1)) // 기본은 지난 달 (보고 대상)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const { data: tasks = [] } = useTasks()
  const { data: incidents = [] } = useQuery({ queryKey: ['incidents'], queryFn: listIncidents })
  const { data: issues = [] } = useQuery({ queryKey: ['issues'], queryFn: listIssues })
  const { data: report } = useQuery({ queryKey: ['monthly', ym], queryFn: () => getMonthlyReport(ym) })
  const nextYm = addMonths(ym, 1)
  const { data: plans = [] } = useQuery({
    queryKey: ['nextPlans', nextYm],
    queryFn: () => listNextMonthPlans(nextYm),
  })

  // 수동 입력 4개
  const [author, setAuthor] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [baseDate, setBaseDate] = useState('')
  const [highlight, setHighlight] = useState('')
  const [orgName, setOrgName] = useState('WEB / POVAS 운영·개발')
  const [newPlan, setNewPlan] = useState('')

  useEffect(() => {
    setAuthor(report?.author_name ?? profile?.name ?? '')
    setReportDate(report?.report_date ?? todayStr())
    setBaseDate(report?.base_date ?? '')
    setHighlight(report?.highlight ?? '')
    setOrgName(report?.org_name ?? 'WEB / POVAS 운영·개발')
  }, [report?.id, ym, profile?.name])

  // 화면에서 직접 집계하지 않는다. 전부 monthly.ts 를 거친다.
  const data = useMemo(
    () =>
      buildMonthlyReport(ym, {
        tasks,
        incidents,
        issues,
        plans,
        report: report
          ? { ...report, author_name: author, report_date: reportDate, base_date: baseDate, highlight, org_name: orgName }
          : {
              id: 0, year_month: ym, org_name: orgName, author_name: author,
              report_date: reportDate, highlight, footnote: null, base_date: baseDate, confirmed_at: null,
            },
      }),
    [ym, tasks, incidents, issues, plans, report, author, reportDate, baseDate, highlight, orgName],
  )

  const save = useMutation({
    mutationFn: (confirm: boolean) =>
      saveMonthlyReport({
        year_month: ym,
        org_name: orgName,
        author_name: author,
        report_date: reportDate,
        highlight,
        base_date: baseDate,
        confirm,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['monthly', ym] }),
    onError: (e: Error) => setErr(friendlyError(e)),
  })

  const addPlan = useMutation({
    mutationFn: (content: string) => addNextMonthPlan(nextYm, content, plans.length),
    onSuccess: () => {
      setNewPlan('')
      void qc.invalidateQueries({ queryKey: ['nextPlans', nextYm] })
    },
  })
  const delPlan = useMutation({
    mutationFn: (id: number) => deleteNextMonthPlan(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['nextPlans', nextYm] }),
  })

  async function download(kind: 'pptx' | 'xlsx') {
    setBusy(kind)
    setErr('')
    try {
      if (kind === 'pptx') {
        const { exportMonthlyPptx } = await import('../lib/exportPptx')
        await exportMonthlyPptx(data)
      } else {
        const { buildWorkbook, downloadBlob } = await import('../lib/excel')
        const { listProfiles, listAllWeeklyReports } = await import('../lib/api')
        const [profiles, reports] = await Promise.all([listProfiles(), listAllWeeklyReports()])
        const { start, end } = monthRange(ym)
        const blob = await buildWorkbook({
          tasks, issues, profiles, reports, incidents,
          weeks: weeksBetween(start, end),
          filter: { from: start, to: end, assigneeId: 'all', signal: 'all' },
        })
        downloadBlob(blob, `팀작업현황_${ym}.xlsx`)
      }
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-lg font-bold">월간보고</h1>
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setYm(addMonths(ym, -1))} className="btn text-on-surface-variant">‹</button>
          <span className="font-medium">{ym}</span>
          <button onClick={() => setYm(addMonths(ym, 1))} className="btn text-on-surface-variant">›</button>
          <span className="text-xs text-on-surface-variant ml-1">{data.periodText}</span>
        </div>
        <span className="flex-1" />
        <button onClick={() => void download('xlsx')} disabled={!!busy} className="btn-outlined">
          {busy === 'xlsx' ? '생성 중…' : '엑셀'}
        </button>
        <button onClick={() => void download('pptx')} disabled={!!busy} className="btn-filled">
          {busy === 'pptx' ? '생성 중…' : 'PPTX 다운로드'}
        </button>
      </div>

      {err && <p className="text-sm text-error mb-3">{err}</p>}

      {/* 수동 입력 4개 */}
      <div className="bg-surface-lowest border border-outline-variant rounded-md p-4 mb-5">
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="작성자"><input className="field" value={author} onChange={(e) => setAuthor(e.target.value)} /></Field>
          <Field label="보고일"><input type="date" className="field" value={reportDate} onChange={(e) => setReportDate(e.target.value)} /></Field>
          <Field label="진행현황 기준일"><input type="date" className="field" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} /></Field>
          <Field label="조직명"><input className="field" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></Field>
          <div className="md:col-span-4">
            <Field label="MONTHLY SUMMARY 중점 문구">
              <input className="field" value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder="예: 결제 안정화 및 회원가입 오류 해소 집중" />
            </Field>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => save.mutate(false)} className="btn-outlined">저장</button>
          <button onClick={() => save.mutate(true)} className="btn-filled">확정</button>
          {report?.confirmed_at && (
            <span className="text-xs text-signal-green">확정됨 · {report.confirmed_at.slice(0, 10)}</span>
          )}
        </div>
      </div>

      {/* SUMMARY */}
      <div className="rounded-md px-4 py-3 mb-5 text-sm" style={{ background: '#EAF1FA' }}>
        <span className="text-xs font-bold mr-3" style={{ color: '#1F3864' }}>MONTHLY SUMMARY</span>
        <span className="text-on-surface-variant">개발 안건 </span>
        <b>{data.summary.agendaText}</b>
        <span className="text-on-surface-variant ml-4">장애 </span>
        <b>{data.summary.incidentText}</b>
        {data.highlight && (
          <>
            <span className="text-on-surface-variant ml-4">중점 </span>
            <b>{data.highlight}</b>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_20rem] gap-5">
        {/* 1. 개발 안건 */}
        <div>
          <h2 className="text-sm font-bold mb-2" style={{ color: '#1F3864' }}>1. 개발 안건별 진행 현황</h2>
          <div className="bg-surface-lowest border border-outline-variant rounded-md overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ background: '#1F3864' }} className="text-on-primary">
                <tr>
                  {['안건', '주요 진행 내용', '상태', '진척율', '일정'].map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.agendas.map((a) => (
                  <tr key={a.id} className="border-t border-outline-variant">
                    <td className="px-2 py-2 font-semibold max-w-[12rem]">{a.name}</td>
                    <td className="px-2 py-2 text-on-surface-variant max-w-[16rem]">
                      {a.progressNote || <span className="text-on-surface-variant/60">미작성 — 주간보고에서 입력</span>}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] ${STATUS_CLASS[a.status]}`}>{a.status}</span>
                    </td>
                    <td className="px-2 py-2 w-20">
                      <div className="font-bold">{a.pct}%</div>
                      <div className="h-1 bg-surface-high rounded-full mt-0.5">
                        <div className="h-1 rounded-full" style={{ width: `${a.pct}%`, background: '#2E7D5B' }} />
                      </div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-center">{a.schedule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.agendas.length === 0 && <p className="text-sm text-on-surface-variant p-8 text-center">해당 월 안건이 없습니다.</p>}
            {data.agendaOverflow > 0 && (
              <p className="text-xs text-on-surface-variant px-3 py-2">진척율 상위 15건만 표기 · 외 {data.agendaOverflow}건</p>
            )}
          </div>

          {/* 3. 의사결정 */}
          <h2 className="text-sm font-bold mt-5 mb-2" style={{ color: '#1F3864' }}>3. 주요 이슈 및 의사결정 필요 사항</h2>
          <div className="bg-surface-low border border-outline-variant rounded-md p-4 text-sm">
            {data.decisions.length ? (
              <ul className="space-y-1.5">
                {data.decisions.map((x, i) => (
                  <li key={i}>
                    <b>{x.title}</b> <span className="text-on-surface-variant">{x.content}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-on-surface-variant text-xs">
                해당 없음 — 이슈 등록 시 &apos;의사결정 필요&apos;를 체크하면 여기에 올라옵니다.
              </p>
            )}
          </div>
        </div>

        {/* 2. 장애 + 4. 차월 계획 */}
        <div>
          <h2 className="text-sm font-bold mb-2" style={{ color: '#1F3864' }}>2. 장애 발생 추이</h2>
          <div className="bg-surface-lowest border border-outline-variant rounded-md p-3">
            <div className="flex items-end gap-1.5 h-24 mb-3">
              {data.incidents.trend.map((t) => {
                const max = Math.max(1, ...data.incidents.trend.map((x) => x.count))
                return (
                  <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-on-surface-variant">{t.count}</span>
                    <div
                      className="w-full rounded-sm"
                      style={{ height: `${Math.max(3, (t.count / max) * 60)}px`, background: t.month === ym ? '#1F3864' : '#B9C6DC' }}
                    />
                    <span className="text-[10px] text-on-surface-variant">{t.label}</span>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {data.incidents.bySeverity.map((sv) => {
                const c = SEVERITY[sv.severity]
                return (
                  <div key={sv.severity} className="rounded border text-center py-1.5" style={{ background: `#${c.bg}`, borderColor: `#${c.color}` }}>
                    <div className="text-[10px] font-bold" style={{ color: `#${c.color}` }}>{sv.label}</div>
                    <div className="text-base font-bold" style={{ color: `#${c.color}` }}>{sv.count}건</div>
                  </div>
                )
              })}
            </div>

            <div className="text-xs space-y-0.5">
              {data.incidents.criticalList.length ? (
                data.incidents.criticalList.map((t, i) => <div key={i}>· {t}</div>)
              ) : (
                <div className="text-on-surface-variant">· 매우심각 장애 없음</div>
              )}
              {data.incidents.criticalOverflow > 0 && (
                <div className="text-on-surface-variant">· 외 {data.incidents.criticalOverflow}건</div>
              )}
            </div>
          </div>

          <h2 className="text-sm font-bold mt-5 mb-2" style={{ color: '#1F3864' }}>
            4. 차월({Number(nextYm.slice(5, 7))}월) 계획
          </h2>
          <div className="bg-surface-low border border-outline-variant rounded-md p-3 text-sm">
            <ul className="space-y-1 mb-2">
              {data.nextPlans.map((p, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span>·</span>
                  <span className="flex-1">{p}</span>
                  {plans.find((x) => x.content === p) && (
                    <button
                      onClick={() => delPlan.mutate(plans.find((x) => x.content === p)!.id)}
                      className="text-on-surface-variant/60 hover:text-error text-xs"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
              {data.nextPlans.length === 0 && <li className="text-on-surface-variant text-xs">· 등록된 계획 없음</li>}
            </ul>
            <input
              className="field py-1 text-sm"
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPlan.trim()) addPlan.mutate(newPlan.trim())
              }}
              placeholder="계획 추가 후 Enter"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-on-surface-variant mt-5">
        {data.footnote}
        {data.baseDate && ` · 기준일 ${data.baseDate}`}
      </p>
    </div>
  )
}

/** 기간에 걸친 ISO 주차 목록 (엑셀 시트 2용) */
function weeksBetween(start: string, end: string): string[] {
  const out: string[] = []
  let w = isoWeek(start)
  const last = isoWeek(end)
  for (let i = 0; i < 60; i++) {
    out.push(w)
    if (w === last) break
    w = addWeeks(w, 1)
  }
  return out
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-on-surface-variant mb-1">{label}</div>
      {children}
    </div>
  )
}
