import { currencySymbol } from '../../lib/format'

interface Props {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

/**
 * Input de moneda: confirma el valor en cada tecla (sin depender del blur)
 * y formatea con separador de miles en vivo.
 */
export function CurrencyInput({ value, onChange, placeholder = '0', className = '', autoFocus }: Props) {
  const display = value === 0 ? '' : new Intl.NumberFormat('es-CR').format(value)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
    const parsed = parseInt(digits, 10)
    onChange(isNaN(parsed) ? 0 : parsed)
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <span className="absolute left-3.5 text-accent-soft font-semibold text-[15px] select-none num">
        {currencySymbol()}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoFocus={autoFocus}
        className="input-base pl-9 text-right num text-[17px]"
        value={display}
        placeholder={placeholder}
        onChange={handleChange}
      />
    </div>
  )
}
