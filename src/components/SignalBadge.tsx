import { SIGNAL_EMOJI, SIGNAL_LABEL, type Signal } from '../lib/progress'

const BG: Record<Signal, string> = {
  green: 'bg-signal-green-c text-signal-green',
  yellow: 'bg-signal-yellow-c text-signal-yellow',
  red: 'bg-signal-red-c text-signal-red',
}

export default function SignalBadge({ signal, sv }: { signal: Signal; sv?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${BG[signal]}`}>
      {SIGNAL_EMOJI[signal]} {SIGNAL_LABEL[signal]}
      {sv !== undefined && <span className="opacity-60">{sv > 0 ? `+${sv}` : sv}%p</span>}
    </span>
  )
}

export function ProgressBar({ actual, plan }: { actual: number; plan: number }) {
  return (
    <div className="relative h-1.5 w-24 bg-surface-high rounded-full overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${actual}%` }} />
      <div className="absolute inset-y-0 w-px bg-slate-400" style={{ left: `${plan}%` }} title="계획" />
    </div>
  )
}
