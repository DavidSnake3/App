import { useState, useRef } from 'react'

interface Props {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  className?: string
}

function formatDisplay(n: number): string {
  if (n === 0) return ''
  return new Intl.NumberFormat('es-CR').format(n)
}

export function CurrencyInput({ value, onChange, placeholder = '0', className = '' }: Props) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFocus() {
    setEditing(true)
    setRaw(value === 0 ? '' : String(value))
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function handleBlur() {
    setEditing(false)
    const parsed = parseInt(raw.replace(/\D/g, ''), 10)
    onChange(isNaN(parsed) ? 0 : parsed)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = e.target.value.replace(/\D/g, '')
    setRaw(cleaned)
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <span className="absolute left-3 text-brand-400 font-mono text-sm select-none">₡</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="w-full pl-7 pr-3 py-2 bg-surface-border/40 rounded-xl text-right font-mono text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={editing ? raw : formatDisplay(value)}
        placeholder={placeholder}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
      />
    </div>
  )
}
