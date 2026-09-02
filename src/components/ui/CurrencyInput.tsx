import { useState } from 'react'
import { currencySymbol, decimalSeparator, formatNumber, hasCents, money2, parseMoney } from '../../lib/format'

interface Props {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

/**
 * Input de moneda CON DECIMALES.
 *
 * Acepta el separador de la región (coma en Costa Rica, punto en EE. UU.) y
 * también el otro, porque los teclados numéricos de Android suelen traer punto.
 * Confirma el valor en cada tecla (sin depender del blur) y pone separador de
 * miles en vivo, pero respeta lo que se está escribiendo: mientras el texto
 * termina en el separador o en "50," no se reformatea, o sería imposible
 * escribir los céntimos.
 */
export function CurrencyInput({ value, onChange, placeholder = '0', className = '', autoFocus }: Props) {
  const dec = decimalSeparator()
  const bonito = (v: number) => (v === 0 ? '' : formatNumber(v, hasCents(v) ? 2 : 0))

  // El texto que se ve. Mientras se teclea manda el texto; si el valor cambia
  // desde fuera (otra pantalla lo fijó), se vuelve a formatear.
  const [texto, setTexto] = useState(() => bonito(value))
  const [visto, setVisto] = useState(value)
  if (visto !== value && parseMoney(texto) !== value) {
    setVisto(value)
    setTexto(bonito(value))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bruto = e.target.value
    // se acepta cualquiera de los dos separadores y se normaliza al de la región
    let limpio = bruto.replace(/[^\d.,]/g, '').replace(/[.,]/g, dec)
    // un solo separador decimal, y máximo 2 céntimos
    const partes = limpio.split(dec)
    if (partes.length > 1) limpio = `${partes[0]}${dec}${partes.slice(1).join('').slice(0, 2)}`
    if (partes[0].length > 12) limpio = `${partes[0].slice(0, 12)}${partes.length > 1 ? dec + partes.slice(1).join('').slice(0, 2) : ''}`

    const n = parseMoney(limpio)
    const valor = Number.isNaN(n) ? 0 : money2(n)
    setTexto(limpio)
    setVisto(valor)
    onChange(valor)
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <span className="absolute left-3.5 text-accent-soft font-semibold text-[15px] select-none num">
        {currencySymbol()}
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        className="input-base pl-9 text-right num text-[17px]"
        value={texto}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={() => setTexto(bonito(value))}
      />
    </div>
  )
}
