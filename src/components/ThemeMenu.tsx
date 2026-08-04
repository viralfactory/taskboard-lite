import { useEffect, useState } from 'react'
import { applyTheme, loadSource, PRESETS, saveSource } from '../lib/theme'

/**
 * 색상 스타일 선택. 프리셋에서 고르거나 직접 색을 지정하면
 * Material 규칙대로 팔레트 전체가 그 색에서 다시 생성된다.
 * 개인 설정이라 브라우저(localStorage)에만 저장한다.
 */
export default function ThemeMenu({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState(loadSource())

  useEffect(() => {
    applyTheme(source)
  }, [source])

  function pick(hex: string) {
    setSource(hex)
    saveSource(hex)
  }

  return (
    <div className="fixed inset-0 bg-black/32 grid place-items-center p-4 z-50" onMouseDown={onClose}>
      <div
        className="bg-surface-lowest rounded-lg shadow-e3 p-6 w-full max-w-sm"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-title font-medium mb-1">색상 스타일</h2>
        <p className="text-body-sm text-on-surface-variant mb-5">
          고른 색 하나에서 Material 팔레트 전체가 만들어집니다. 이 브라우저에만 저장됩니다.
        </p>

        <div className="grid grid-cols-4 gap-3 mb-5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p.source)}
              title={p.label}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`w-10 h-10 rounded-full border-2 transition ${
                  source.toLowerCase() === p.source.toLowerCase()
                    ? 'border-on-surface scale-110'
                    : 'border-transparent'
                }`}
                style={{ background: p.source }}
              />
              <span className="text-label-sm text-on-surface-variant leading-tight text-center">
                {p.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-3 mb-5">
          <span className="text-body-sm text-on-surface-variant flex-1">직접 지정</span>
          <input
            type="color"
            value={source}
            onChange={(e) => pick(e.target.value)}
            className="w-10 h-8 rounded-xs border border-outline bg-transparent cursor-pointer"
          />
          <code className="text-body-sm text-on-surface-variant">{source.toUpperCase()}</code>
        </label>

        {/* 적용 결과 미리보기 */}
        <div className="rounded-md border border-outline-variant p-3 mb-5">
          <div className="flex flex-wrap gap-2">
            <span className="btn-filled">채운 버튼</span>
            <span className="btn-tonal">보조</span>
            <span className="chip-on">선택된 칩</span>
            <span className="chip">칩</span>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-filled">
            완료
          </button>
        </div>
      </div>
    </div>
  )
}
