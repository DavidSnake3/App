interface Option<T extends string> {
  value: T
  label: React.ReactNode
  ariaLabel?: string
}

interface Props<T extends string> {
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
  className?: string
}

export function Segmented<T extends string>({ value, onChange, options, className = '' }: Props<T>) {
  return (
    <div
      role="tablist"
      className={`flex rounded-2xl bg-elevated border border-edge p-1 gap-1 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`pressable flex-1 min-h-10 rounded-xl text-[13px] font-medium flex items-center justify-center gap-1.5 px-2 transition-colors ${
              active ? 'bg-card text-ink shadow-sm border border-edge' : 'text-muted'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
