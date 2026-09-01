// Ajustes → Categorías: crear las tuyas con su ícono y su color, y cambiarle
// el color a las que trae la app.
import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Plus, Shapes, Trash2 } from 'lucide-react'
import type { Category } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { DEFAULT_CATEGORIES, categoryColor, mergeCategories } from '../../lib/categories'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { IconPicker } from '../ui/IconPicker'
import { ColorPicker } from '../ui/ColorPicker'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export function CategoriesSection() {
  const guardadas = useFinanceStore((s) => s.settings.categories)
  const updateCategory = useFinanceStore((s) => s.updateCategory)
  const deleteCategory = useFinanceStore((s) => s.deleteCategory)

  const lista = mergeCategories(guardadas)
  const [sheet, setSheet] = useState<{ open: boolean; editing: Category | null }>({
    open: false, editing: null,
  })
  const [porBorrar, setPorBorrar] = useState<Category | null>(null)
  const [verOcultas, setVerOcultas] = useState(false)

  const visibles = lista.filter((c) => verOcultas || !c.hidden)
  const gastos = visibles.filter((c) => c.kind === 'gasto' || c.kind === 'ambos')
  const ingresos = visibles.filter((c) => c.kind === 'ingreso')

  const grupo = (titulo: string, icono: React.ReactNode, items: Category[]) => (
    items.length > 0 && (
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-2">
          {icono} {titulo}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {items.map((c, i) => {
            const color = c.color || categoryColor(c.id)
            return (
              <button
                key={c.id}
                onClick={() => setSheet({ open: true, editing: c })}
                className="pressable tile px-3 py-2.5 flex items-center gap-2.5 text-left anim-rise"
                style={{
                  animationDelay: `${Math.min(i * 25, 300)}ms`,
                  background: `linear-gradient(155deg, color-mix(in oklab, ${color} 12%, var(--c-card)) 0%, var(--c-card) 62%)`,
                  borderColor: `color-mix(in oklab, ${color} 22%, var(--c-border))`,
                  opacity: c.hidden ? 0.45 : 1,
                }}
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(145deg, ${color}, color-mix(in oklab, ${color} 55%, #000))`,
                    color: '#fff',
                    boxShadow: `0 5px 14px -8px ${color}`,
                  }}
                >
                  <ItemIcon icon={c.icon} name={c.name} size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink truncate">{c.name}</span>
                  <span className="block text-[10px] text-muted">
                    {c.hidden ? 'oculta' : c.builtin ? 'de la app' : 'tuya'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-muted flex items-center gap-1.5">
          <Shapes size={13} /> Cada categoría con su ícono y su color
        </p>
        <button
          onClick={() => setVerOcultas((v) => !v)}
          className="pressable text-[11px] font-semibold flex items-center gap-1"
          style={{ color: 'var(--app-accent-soft)' }}
        >
          {verOcultas ? <EyeOff size={12} /> : <Eye size={12} />}
          {verOcultas ? 'Ocultar' : 'Ver ocultas'}
        </button>
      </div>

      {grupo('Salidas', <ArrowUpRight size={11} />, gastos)}
      {grupo('Entradas', <ArrowDownLeft size={11} />, ingresos)}

      <button
        onClick={() => setSheet({ open: true, editing: null })}
        className="pressable rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 py-3 text-[13px] font-semibold"
        style={{
          borderColor: 'color-mix(in oklab, var(--app-accent) 50%, var(--c-border))',
          color: 'var(--app-accent-soft)',
        }}
      >
        <Plus size={16} /> Crear categoría
      </button>

      <p className="text-[11px] text-muted leading-snug">
        El color de la categoría se usa en la lista de movimientos, en la dona y en las
        barras de los reportes.
      </p>

      <CategorySheet
        open={sheet.open}
        editing={sheet.editing}
        onClose={() => setSheet({ open: false, editing: null })}
        onDelete={(c) => { setSheet({ open: false, editing: null }); setPorBorrar(c) }}
      />

      <ConfirmDialog
        open={Boolean(porBorrar)}
        title={porBorrar?.builtin ? `¿Ocultar "${porBorrar?.name}"?` : `¿Eliminar "${porBorrar?.name}"?`}
        message={porBorrar?.builtin
          ? 'Las categorías de la app no se borran: se ocultan para que no aparezcan al registrar. Puedes volver a mostrarla cuando quieras.'
          : 'Los movimientos que la usaban pasan a mostrarse como "Otros".'}
        confirmLabel={porBorrar?.builtin ? 'Ocultar' : 'Eliminar'}
        danger
        onCancel={() => setPorBorrar(null)}
        onConfirm={() => {
          if (porBorrar) deleteCategory(porBorrar.id)
          setPorBorrar(null)
        }}
      />

      {/* volver a mostrar una oculta */}
      {verOcultas && lista.some((c) => c.hidden) && (
        <div className="flex flex-wrap gap-1.5">
          {lista.filter((c) => c.hidden).map((c) => (
            <button
              key={c.id}
              onClick={() => updateCategory(c.id, { hidden: false })}
              className="pressable chip"
            >
              <ItemIcon icon={c.icon} size={11} /> Mostrar {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Alta y edición ────────────────────────────────────────────────────── */

function CategorySheet({ open, editing, onClose, onDelete }: {
  open: boolean
  editing: Category | null
  onClose: () => void
  onDelete: (c: Category) => void
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar categoría' : 'Nueva categoría'}
      subtitle="Elige su ícono y su color"
    >
      {open && (
        <CategoryForm
          key={editing?.id ?? 'nueva'}
          editing={editing}
          onDone={onClose}
          onDelete={onDelete}
        />
      )}
    </BottomSheet>
  )
}

function CategoryForm({ editing, onDone, onDelete }: {
  editing: Category | null
  onDone: () => void
  onDelete: (c: Category) => void
}) {
  const addCategory = useFinanceStore((s) => s.addCategory)
  const updateCategory = useFinanceStore((s) => s.updateCategory)

  const [name, setName] = useState(editing?.name ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? 'efectivo')
  const [color, setColor] = useState(editing?.color ?? '')
  const [kind, setKind] = useState<Category['kind']>(editing?.kind ?? 'gasto')

  const colorFinal = color || (editing ? categoryColor(editing.id) : 'var(--app-accent)')
  const puedeGuardar = name.trim().length > 0

  const guardar = () => {
    if (!puedeGuardar) return
    const datos = { name: name.trim(), icon, color: color || undefined, kind }
    if (editing) updateCategory(editing.id, datos)
    else addCategory({ ...datos, builtin: false })
    onDone()
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* vista previa */}
      <div className="flex items-center gap-3">
        <span
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(145deg, ${colorFinal}, color-mix(in oklab, ${colorFinal} 55%, #000))`,
            color: '#fff',
            boxShadow: `0 10px 24px -12px ${colorFinal}`,
          }}
        >
          <ItemIcon icon={icon} name={name} size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-ink truncate">{name || 'Sin nombre'}</p>
          <p className="text-[11.5px] text-muted">
            Así se va a ver en tus movimientos y reportes
          </p>
        </div>
      </div>

      <div>
        <label className="text-[12px] font-semibold text-muted">Nombre</label>
        <input
          className="input-base mt-1.5"
          placeholder="Ej. Gimnasio, Universidad, Mascota…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!editing}
        />
      </div>

      {!editing?.builtin && (
        <div>
          <label className="text-[12px] font-semibold text-muted">¿Para qué la usas?</label>
          <div className="flex rounded-2xl bg-elevated border border-edge p-1 gap-1 mt-1.5">
            {([
              { id: 'gasto' as const, label: 'Salidas', icon: <ArrowUpRight size={13} /> },
              { id: 'ingreso' as const, label: 'Entradas', icon: <ArrowDownLeft size={13} /> },
              { id: 'ambos' as const, label: 'Ambas', icon: null },
            ]).map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`pressable flex-1 min-h-9 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1 ${
                  kind === k.id ? 'bg-card text-ink border border-edge' : 'text-muted'
                }`}
              >
                {k.icon} {k.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <IconPicker value={icon} onChange={setIcon} name={name} kind="gasto" />

      <ColorPicker
        value={color}
        onChange={setColor}
        fallback={editing ? categoryColor(editing.id) : undefined}
        hint="Con AUTO usa el color que la app le asignó."
      />

      <button
        onClick={guardar}
        disabled={!puedeGuardar}
        className="pressable btn-primary w-full disabled:opacity-50"
      >
        {editing ? 'Guardar cambios' : 'Crear categoría'}
      </button>

      {editing && (
        <button
          onClick={() => onDelete(editing)}
          className="pressable w-full rounded-2xl py-2.5 text-[13px] font-semibold flex items-center justify-center gap-2"
          style={{ background: 'color-mix(in oklab, var(--c-danger) 12%, transparent)', color: 'var(--c-danger)' }}
        >
          <Trash2 size={14} /> {editing.builtin ? 'Ocultar categoría' : 'Eliminar categoría'}
        </button>
      )}

      {editing?.builtin && DEFAULT_CATEGORIES.some((c) => c.id === editing.id) && (
        <p className="text-[11px] text-muted text-center">
          Es una categoría de la app: puedes cambiarle el nombre, el ícono y el color.
        </p>
      )}
    </div>
  )
}
