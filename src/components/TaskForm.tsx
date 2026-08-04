import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTask, listProfiles } from '../lib/api'
import {
  checkpointsOf,
  CUSTOM_L1,
  DEFAULT_ACTIVITY_CHECKPOINTS,
  deliverableOf,
  L1_LIST,
  TEMPLATES,
} from '../lib/categories'
import { STAGES } from '../lib/constants'
import { endOfMonth, nextFriday, thisFriday, todayStr } from '../lib/dates'
import { pushRecentCat, recentCats, type CatPair } from '../lib/recent'
import { useAuth } from '../hooks/useAuth'
import { optionErrorText, useCustomOptions } from '../hooks/useCustomOptions'
import type { CustomOption } from '../lib/types'

// ─────────────────────────────────────────────────────────────
// SPEC 7장 — 업무 1건 등록 30초.
// 보이는 입력은 업무명 / 카테고리 / 마감일 / 단계 4개.
// 담당자·시작일·산출물·월간보고 포함은 접힌 영역, 상태는 미노출, 중요도 필드는 없다.
// 팝업이 아니라 목록 위에 펼쳐지는 섹션으로 띄운다 (화면을 가리지 않기 위해).
// ─────────────────────────────────────────────────────────────

export interface TaskFormSeed {
  name?: string
  l1?: string
  l2?: string
  dueDate?: string
  startDate?: string
  checkpoints?: string[]
  deliverable?: string
  assigneeId?: string
  stage?: string
  isAgenda?: boolean
}

type DueMode = 'fri' | 'nextfri' | 'eom' | 'custom'

const DUE_CHIPS: { mode: DueMode; label: (d: string) => string; value: () => string }[] = [
  { mode: 'fri', label: (d) => `이번주 금(${md(d)})`, value: () => thisFriday() },
  { mode: 'nextfri', label: (d) => `다음주 금(${md(d)})`, value: () => nextFriday() },
  { mode: 'eom', label: (d) => `이달 말(${md(d)})`, value: () => endOfMonth() },
]

function md(d: string) {
  const [, m, day] = d.split('-')
  return `${Number(m)}/${Number(day)}`
}

export default function TaskForm({ seed, onClose }: { seed?: TaskFormSeed; onClose: () => void }) {
  const { userId, profile, refresh } = useAuth()
  const qc = useQueryClient()
  const nameRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLElement>(null)

  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const { items: activities, add: addAct, remove: delAct } = useCustomOptions('activity')

  const recents = useMemo<CatPair[]>(() => {
    const r = recentCats(profile)
    return r.length ? r : [{ l1: '개발', l2: '신규개발' }]
  }, [profile])

  /** 사용자가 추가한 활동의 체크포인트를 우선 쓰고, 없으면 코드 템플릿 */
  function cpsOf(l1: string, l2: string): string[] {
    if (l1 === CUSTOM_L1) {
      const custom = activities.find((a) => a.name === l2)
      if (custom) return custom.checkpoints?.length ? custom.checkpoints : [...DEFAULT_ACTIVITY_CHECKPOINTS]
    }
    return checkpointsOf(l1, l2)
  }

  const [name, setName] = useState(seed?.name ?? '')
  const [cat, setCat] = useState<CatPair>({
    l1: seed?.l1 ?? recents[0].l1,
    l2: seed?.l2 ?? recents[0].l2,
  })
  const [dueMode, setDueMode] = useState<DueMode>(seed?.dueDate ? 'custom' : 'fri')
  const [dueDate, setDueDate] = useState(seed?.dueDate ?? thisFriday())
  const [checkpoints, setCheckpoints] = useState<string[]>(
    seed?.checkpoints ?? checkpointsOf(cat.l1, cat.l2),
  )
  const [startDate, setStartDate] = useState(seed?.startDate ?? todayStr())
  const [deliverable, setDeliverable] = useState(seed?.deliverable ?? deliverableOf(cat.l1, cat.l2))
  const [assigneeId, setAssigneeId] = useState(seed?.assigneeId ?? userId ?? '')
  const [stage, setStage] = useState<string>(seed?.stage ?? 'dev')
  const [isAgenda, setIsAgenda] = useState(seed?.isAgenda ?? true)
  const [moreOpen, setMoreOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [newActivity, setNewActivity] = useState('')
  const [err, setErr] = useState('')
  const [flash, setFlash] = useState('')

  useEffect(() => {
    nameRef.current?.focus()
    rootRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  /** 중분류를 고르는 순간 체크포인트와 산출물이 자동으로 채워진다. */
  function pickCat(p: CatPair) {
    const cps = cpsOf(p.l1, p.l2)
    setCat(p)
    setCheckpoints(cps)
    setDeliverable(cps.length ? cps[cps.length - 1] : '')
    setPickerOpen(false)
  }

  function pickDue(mode: DueMode, value: string) {
    setDueMode(mode)
    setDueDate(value)
  }

  function submitActivity() {
    const n = newActivity.trim()
    if (!n) return
    setErr('')
    addAct.mutate(
      { name: n, checkpoints: [...DEFAULT_ACTIVITY_CHECKPOINTS] },
      {
        onSuccess: (a: CustomOption) => {
          // 방금 만든 활동을 바로 선택 상태로
          setNewActivity('')
          const cps = a.checkpoints?.length ? a.checkpoints : [...DEFAULT_ACTIVITY_CHECKPOINTS]
          setCat({ l1: CUSTOM_L1, l2: a.name })
          setCheckpoints(cps)
          setDeliverable(cps[cps.length - 1] ?? '')
          setPickerOpen(false)
        },
        onError: (e) => setErr(optionErrorText(e)),
      },
    )
  }

  const save = useMutation({
    mutationFn: async (keepOpen: boolean) => {
      if (!userId) throw new Error('로그인이 필요합니다.')
      const cps = checkpoints.map((c) => c.trim()).filter(Boolean)
      // 저장 차단 규칙 2개
      if (!dueDate) throw new Error('마감일 없이 저장할 수 없습니다.')
      if (cps.length < 2) throw new Error('체크포인트가 2개 이상이어야 합니다.')
      if (!name.trim()) throw new Error('업무명을 입력하세요.')

      await createTask(
        {
          name: name.trim(),
          cat_l1: cat.l1,
          cat_l2: cat.l2,
          assignee_id: assigneeId || userId,
          start_date: startDate,
          due_date: dueDate,
          deliverable: deliverable || cps[cps.length - 1],
          checkpoints: cps,
          stage,
          is_agenda: isAgenda,
        },
        userId,
      )
      pushRecentCat(cat)
      return keepOpen
    },
    onSuccess: (keepOpen) => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void refresh()
      if (keepOpen) {
        // 연속 등록: 카테고리·마감일은 유지하고 업무명만 비운다
        setName('')
        setCheckpoints(cpsOf(cat.l1, cat.l2))
        setErr('')
        setFlash('저장했습니다. 이어서 등록하세요.')
        setTimeout(() => setFlash(''), 1800)
        nameRef.current?.focus()
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
      // 버튼·텍스트영역·활동명 입력에 포커스가 있으면 그쪽 동작을 우선한다
      const el = e.target as HTMLElement
      if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return
      if (el.dataset.noSubmit === 'true') return
      e.preventDefault()
      save.mutate(e.ctrlKey || e.metaKey) // Ctrl+Enter → 저장 후 계속
    }
  }

  /** 1~4 키: 포커스가 놓인 칩 그룹의 n번째를 고른다 */
  function chipGroupKeys(e: React.KeyboardEvent, pick: (i: number) => void, count: number) {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return // 날짜 직접입력 중이면 무시
    const n = Number(e.key)
    if (n >= 1 && n <= Math.min(4, count)) {
      e.preventDefault()
      pick(n - 1)
    }
  }

  const dueOptions = DUE_CHIPS.map((c) => ({ ...c, resolved: c.value() }))
  const l2sOf = (l1: string) => [
    ...Object.keys(TEMPLATES[l1] ?? {}),
    ...(l1 === CUSTOM_L1 ? activities.map((a) => a.name) : []),
  ]

  return (
    <section
      ref={rootRef}
      className="bg-white border border-slate-300 rounded-xl p-5 mb-4 shadow-sm"
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-sm">새 업무</h2>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-700">
          닫기 <span className="opacity-60">Esc</span>
        </button>
      </div>

      {/* 넓은 화면에서는 2단으로 나눠 스크롤 없이 한눈에 들어오게 한다 */}
      <div className="grid lg:grid-cols-2 lg:gap-x-8">
        <div>
          {/* 1. 업무명 */}
          <input
            ref={nameRef}
            className="field text-base mb-5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="업무명"
          />

          {/* 2. 카테고리 */}
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-1.5">카테고리</div>
            <div
              className="flex flex-wrap gap-1.5"
              tabIndex={-1}
              onKeyDown={(e) => chipGroupKeys(e, (i) => pickCat(recents[i]), recents.length)}
            >
              {recents.map((p, i) => {
                const on = p.l1 === cat.l1 && p.l2 === cat.l2
                return (
                  <button
                    key={`${p.l1}>${p.l2}`}
                    type="button"
                    onClick={() => pickCat(p)}
                    className={`chip ${on ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 hover:bg-slate-50'}`}
                  >
                    <span className="opacity-50 mr-1 text-[11px]">{i + 1}</span>
                    {p.l1}&gt;{p.l2}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className={`chip ${pickerOpen ? 'border-slate-900' : 'border-slate-300'} hover:bg-slate-50`}
              >
                전체 {pickerOpen ? '▴' : '▾'}
              </button>
            </div>

            {!recents.some((p) => p.l1 === cat.l1 && p.l2 === cat.l2) && (
              <div className="text-xs text-slate-500 mt-1.5">
                선택됨 · <b>{cat.l1}&gt;{cat.l2}</b>
              </div>
            )}

            {/* 최근 3개에 없는 조합은 여기서 고른다 */}
            {pickerOpen && (
              <div className="mt-2 border border-slate-200 rounded-lg p-3 max-h-72 overflow-y-auto">
                {L1_LIST.map((l1) => (
                  <div key={l1} className="mb-3 last:mb-0">
                    <div className="text-[11px] text-slate-400 mb-1">{l1}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {l2sOf(l1).map((l2) => {
                        const custom = l1 === CUSTOM_L1 ? activities.find((a) => a.name === l2) : undefined
                        return (
                          <span key={l2} className="inline-flex items-center group">
                            <button
                              type="button"
                              onClick={() => pickCat({ l1, l2 })}
                              className={`chip text-xs ${
                                cat.l1 === l1 && cat.l2 === l2
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {l2}
                            </button>
                            {custom && (
                              <button
                                type="button"
                                title="활동 삭제"
                                onClick={() => delAct.mutate(custom.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 text-xs px-1"
                              >
                                ✕
                              </button>
                            )}
                          </span>
                        )
                      })}
                    </div>

                    {/* 이 대분류에서만 활동명을 팀이 직접 늘린다 */}
                    {l1 === CUSTOM_L1 && (
                      <div className="flex gap-1.5 mt-2">
                        <input
                          data-no-submit="true"
                          className="field py-1 text-xs"
                          value={newActivity}
                          onChange={(e) => setNewActivity(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              submitActivity()
                            }
                          }}
                          placeholder="활동명 추가 (예: 사내 세미나) 후 Enter"
                        />
                        <button
                          type="button"
                          onClick={submitActivity}
                          disabled={!newActivity.trim() || addAct.isPending}
                          className="btn border border-slate-300 text-xs shrink-0"
                        >
                          추가
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. 마감일 */}
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-1.5">마감일</div>
            <div
              className="flex flex-wrap gap-1.5 items-center"
              tabIndex={-1}
              onKeyDown={(e) =>
                chipGroupKeys(e, (i) => pickDue(dueOptions[i].mode, dueOptions[i].resolved), 3)
              }
            >
              {dueOptions.map((c, i) => (
                <button
                  key={c.mode}
                  type="button"
                  onClick={() => pickDue(c.mode, c.resolved)}
                  className={`chip ${
                    dueMode === c.mode
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="opacity-50 mr-1 text-[11px]">{i + 1}</span>
                  {c.label(c.resolved)}
                </button>
              ))}
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueMode('custom')
                  setDueDate(e.target.value)
                }}
                className={`chip ${dueMode === 'custom' ? 'border-slate-900' : 'border-slate-300'} text-xs`}
              />
            </div>
          </div>

          {/* 4. 단계 */}
          <div className="mb-4 lg:mb-0">
            <div className="text-xs text-slate-500 mb-1.5">단계</div>
            <div
              className="flex flex-wrap gap-1.5"
              tabIndex={-1}
              onKeyDown={(e) => chipGroupKeys(e, (i) => setStage(STAGES[i]), STAGES.length)}
            >
              {STAGES.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStage(s)}
                  className={`chip ${
                    stage === s ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="opacity-50 mr-1 text-[11px]">{i + 1}</span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 오른쪽 단 */}
        <div className="lg:border-l lg:border-slate-100 lg:pl-8">
          {/* 5. 체크포인트 (템플릿 자동 생성) */}
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-1.5">
              체크포인트 (자동) <span className="text-slate-300">· 2개 이상</span>
            </div>
            <div className="space-y-1.5">
              {checkpoints.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-slate-300">☐</span>
                  <input
                    className="field py-1 text-sm"
                    value={c}
                    onChange={(e) =>
                      setCheckpoints((cs) => cs.map((v, j) => (j === i ? e.target.value : v)))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setCheckpoints((cs) => cs.filter((_, j) => j !== i))}
                    className="text-slate-300 hover:text-red-500 px-1"
                    tabIndex={-1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCheckpoints((cs) => [...cs, ''])}
              className="btn text-slate-400 mt-1 px-0"
              tabIndex={-1}
            >
              + 추가
            </button>
          </div>

          {/* 접힌 영역 — 펼치지 않아도 저장 가능 */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="text-xs text-slate-400 mb-3"
            tabIndex={-1}
          >
            {moreOpen ? '▾' : '▸'} 담당자·시작일·산출물·월간보고 포함 변경
          </button>

          {moreOpen && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">담당자</div>
                <select className="field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">시작일</div>
                <input
                  type="date"
                  className="field"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <div className="text-xs text-slate-500 mb-1">산출물</div>
                <input className="field" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAgenda}
                  onChange={(e) => setIsAgenda(e.target.checked)}
                  className="accent-slate-900"
                />
                월간보고 &apos;개발 안건&apos;에 포함
                <span className="text-xs text-slate-400">(상시 반복 업무면 해제)</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
      {flash && <p className="text-sm text-emerald-600 mt-3">{flash}</p>}

      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => save.mutate(true)}
          disabled={save.isPending}
          className="btn border border-slate-300"
        >
          저장 후 계속 <span className="text-slate-400 text-xs">⌃⏎</span>
        </button>
        <button
          type="button"
          onClick={() => save.mutate(false)}
          disabled={save.isPending}
          className="btn bg-slate-900 text-white"
        >
          저장 <span className="opacity-60 text-xs">⏎</span>
        </button>
      </div>
    </section>
  )
}
