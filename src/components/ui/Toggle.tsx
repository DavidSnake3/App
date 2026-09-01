interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  /** texto explicativo: cuando se pasa, el switch viene con su fila completa */
  hint?: string
}

export function Toggle({ checked, onChange, label, hint }: Props) {
  if (hint !== undefined) {
    return (
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-medium text-ink">{label}</p>
          <p className="text-[11.5px] text-muted mt-0.5 leading-snug">{hint}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} label={label} />
      </div>
    )
  }
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="pressable relative w-12 h-7 rounded-full transition-colors shrink-0"
      style={{ background: checked ? 'var(--app-accent)' : 'var(--c-border)' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  )
}
