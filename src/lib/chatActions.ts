// Acciones que Snake puede ejecutar en la app. SIEMPRE se proponen con una
// tarjeta de confirmación: nada se guarda sin que el usuario toque "Confirmar".
import type { ExpenseKind, Recurrence } from '../types/finance'
import { useFinanceStore } from '../store/useFinanceStore'
import { buildPayables, uid } from './finance'
import { countryPreset, presetExtraPays, presetStatutory } from './payroll'
import { formatMoney } from './format'
import { PERIOD_LABEL } from './payroll'

export type ActionData = Record<string, string | number | boolean | undefined>

export interface ActionSpec {
  /** título de la tarjeta de confirmación */
  title: string
  /** resumen legible de lo que se va a hacer */
  summary(d: ActionData): string
  /** texto del botón */
  cta: string
  /** mensaje cuando ya se ejecutó */
  done: string
  /** ¿los datos alcanzan para ejecutarla? */
  valid(d: ActionData): boolean
  run(d: ActionData): void
}

/* ─── helpers ──────────────────────────────────────────────────────────── */

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function money(v: unknown): string {
  return formatMoney(Math.round(num(v)))
}

function st() {
  return useFinanceStore.getState()
}

function activeMonth(): string {
  return st().activeMonthId
}

function kindOf(v: unknown): ExpenseKind {
  const k = str(v, 'gasto').toLowerCase()
  if (k.startsWith('serv')) return 'servicio'
  if (k.startsWith('pers')) return 'personal'
  return 'gasto'
}

function recurrenceOf(v: unknown): Recurrence {
  const r = str(v, 'once').toLowerCase()
  const map: Record<string, Recurrence> = {
    once: 'once', unico: 'once', contado: 'once',
    weekly: 'weekly', semanal: 'weekly',
    biweekly: 'biweekly', quincenal: 'biweekly',
    monthly: 'monthly', mensual: 'monthly',
    bimonthly: 'bimonthly', trimestral: 'quarterly', quarterly: 'quarterly',
    semiannual: 'semiannual', semestral: 'semiannual',
    annual: 'annual', anual: 'annual',
  }
  return map[r] ?? 'once'
}

/** Busca un pago del mes por nombre (tolerante a mayúsculas y parciales) */
function findPayable(name: string) {
  const s = st()
  const month = s.months[s.activeMonthId]
  if (!month) return null
  const items = buildPayables(month, s.debts)
  const q = name.toLowerCase().trim()
  return items.find((i) => i.name.toLowerCase() === q)
    ?? items.find((i) => i.name.toLowerCase().includes(q))
    ?? items.find((i) => q.includes(i.name.toLowerCase()))
    ?? null
}

/* ─── catálogo de acciones ─────────────────────────────────────────────── */

export const ACTIONS: Record<string, ActionSpec> = {
  agregar_deuda: {
    title: 'Nueva deuda',
    cta: 'Agregar esta deuda',
    done: 'Deuda agregada: la ves en la pestaña Deudas',
    valid: (d) => str(d.name).length > 0 && num(d.total) > 0,
    summary: (d) => {
      const cuotas = Math.max(1, Math.round(num(d.installments) || 12))
      const cuota = num(d.monthlyPayment) || num(d.total) / cuotas
      return `${str(d.name)} · total ${money(d.total)} · cuota ${money(cuota)} · ${cuotas} cuotas`
        + (num(d.dueDay) ? ` · vence día ${Math.round(num(d.dueDay))}` : '')
    },
    run: (d) => {
      const total = Math.max(1, Math.round(num(d.total)))
      const rawPago = num(d.monthlyPayment)
      const installments = Math.max(1, Math.round(num(d.installments) || (rawPago > 0 ? Math.ceil(total / rawPago) : 12)))
      st().addDebt({
        name: str(d.name, 'Deuda').slice(0, 60),
        total,
        monthlyPayment: Math.max(1, Math.round(rawPago || total / installments)),
        installments,
        startMonthId: activeMonth(),
        dueDay: Math.max(1, Math.min(31, Math.round(num(d.dueDay) || 15))),
        account: str(d.account) || undefined,
      })
    },
  },

  agregar_gasto: {
    title: 'Nuevo pago del mes',
    cta: 'Agregarlo a mi mes',
    done: 'Pago agregado a tu mes',
    valid: (d) => str(d.name).length > 0 && num(d.amount) > 0,
    summary: (d) => {
      const k = kindOf(d.kind)
      const label = k === 'servicio' ? 'servicio' : k === 'personal' ? 'personal' : 'gasto'
      return `${str(d.name)} · ${money(d.amount)} · ${label}`
        + (num(d.dueDay) ? ` · vence día ${Math.round(num(d.dueDay))}` : '')
        + (recurrenceOf(d.recurrencia ?? d.recurrence) !== 'once' ? ' · recurrente' : '')
    },
    run: (d) => {
      const dueDay = Math.max(1, Math.min(31, Math.round(num(d.dueDay) || 15)))
      st().addExpense(activeMonth(), {
        name: str(d.name, 'Pago').slice(0, 60),
        amount: Math.round(num(d.amount)),
        paid: false,
        dueDay,
        period: dueDay <= 15 ? 'q1' : 'q2',
        kind: kindOf(d.kind),
        recurrence: recurrenceOf(d.recurrencia ?? d.recurrence),
        children: [],
      })
    },
  },

  marcar_pagado: {
    title: 'Marcar como pagado',
    cta: 'Marcarlo pagado',
    done: 'Pago marcado como hecho',
    valid: (d) => Boolean(findPayable(str(d.nombre ?? d.name))),
    summary: (d) => {
      const it = findPayable(str(d.nombre ?? d.name))
      return it ? `${it.name} · ${money(it.amount)}` : `No encontré "${str(d.nombre ?? d.name)}" en tu mes`
    },
    run: (d) => {
      const it = findPayable(str(d.nombre ?? d.name))
      if (!it) return
      if (it.source === 'debt') st().toggleDebtPaid(it.refId, activeMonth())
      else st().togglePaid(activeMonth(), it.refId)
    },
  },

  configurar_planilla: {
    title: 'Configurar tus ingresos',
    cta: 'Guardar mi planilla',
    done: 'Planilla guardada: tu salario ya se aplica al mes',
    valid: (d) => num(d.bruto ?? d.gross) > 0,
    summary: (d) => {
      const per = str(d.periodo ?? d.period, 'monthly')
      const label = PERIOD_LABEL[per as keyof typeof PERIOD_LABEL] ?? 'Mensual'
      const pct = num(d.deduccionPct)
      return `Bruto ${money(d.bruto ?? d.gross)} · ${label}`
        + (pct > 0 ? ` · ${str(d.deduccionNombre, 'deducción de ley')} ${pct}%` : '')
        + (str(d.pais) ? ` · ${str(d.pais)}` : '')
    },
    run: (d) => {
      const per = str(d.periodo ?? d.period, 'monthly')
      const period = (['daily', 'weekly', 'fortnightly', 'biweekly', 'monthly'] as const)
        .find((x) => x === per) ?? 'monthly'
      const preset = countryPreset(str(d.paisId)) ?? undefined
      const pct = num(d.deduccionPct)
      const nombre = str(d.deduccionNombre)
      st().setPayroll({
        inputPeriod: period,
        gross: Math.round(num(d.bruto ?? d.gross)),
        ...(preset
          ? {
              countryId: preset.id,
              statutory: presetStatutory(preset),
              taxEnabled: preset.taxBrackets.some((b) => b.pct > 0),
              taxBrackets: preset.taxBrackets,
              extraPays: presetExtraPays(preset),
            }
          : {}),
        ...(pct > 0 || nombre
          ? { statutory: [{ id: uid(), name: nombre || 'Deducción de ley', pct, cap: 0 }], ccssPct: pct }
          : {}),
      })
    },
  },

  agregar_deduccion: {
    title: 'Nueva deducción de tu salario',
    cta: 'Agregar la deducción',
    done: 'Deducción agregada a tu planilla',
    valid: (d) => str(d.name).length > 0 && num(d.amount) > 0,
    summary: (d) => `${str(d.name)} · ${money(d.amount)}`
      + (d.esAdelanto ? ' · es un adelanto de mi salario' : ''),
    run: (d) => {
      const p = st().settings.payroll
      st().setPayroll({
        deductions: [...p.deductions, {
          id: uid(),
          name: str(d.name, 'Deducción').slice(0, 40),
          amount: Math.round(num(d.amount)),
          isAdvance: Boolean(d.esAdelanto),
        }],
      })
    },
  },

  crear_sobre: {
    title: 'Nuevo sobre de ahorro',
    cta: 'Crear el sobre',
    done: 'Sobre creado: lo ves en Ajustes → Ahorros',
    valid: (d) => str(d.name).length > 0,
    summary: (d) => `${str(d.name)}`
      + (num(d.meta) > 0 ? ` · meta ${money(d.meta)}` : '')
      + (num(d.actual) > 0 ? ` · ya tienes ${money(d.actual)}` : ''),
    run: (d) => st().addEnvelope({
      name: str(d.name, 'Ahorro').slice(0, 40),
      goal: Math.round(num(d.meta)),
      initial: Math.round(num(d.actual)),
    }),
  },

  aportar_ahorro: {
    title: 'Aportar a tu ahorro',
    cta: 'Confirmar el aporte',
    done: 'Aporte registrado en tu ahorro',
    valid: (d) => num(d.monto ?? d.amount) > 0,
    summary: (d) => {
      const envs = st().settings.savings.envelopes ?? []
      const target = str(d.sobre) && envs.find((e) => e.name.toLowerCase().includes(str(d.sobre).toLowerCase()))
      return `${money(d.monto ?? d.amount)} → ${target ? target.name : envs[0]?.name ?? 'Mi ahorro'}`
    },
    run: (d) => {
      const envs = st().settings.savings.envelopes ?? []
      const target = str(d.sobre) && envs.find((e) => e.name.toLowerCase().includes(str(d.sobre).toLowerCase()))
      const amount = Math.round(num(d.monto ?? d.amount))
      if (target) st().addEnvelopeDeposit(target.id, amount, 'Aporte con Snake')
      else st().addSavingsDeposit(amount, 'Aporte con Snake')
    },
  },

  agregar_hormiga: {
    title: 'Gasto hormiga',
    cta: 'Anotarlo',
    done: 'Gasto hormiga anotado',
    valid: (d) => num(d.amount ?? d.monto) > 0,
    summary: (d) => `${str(d.name, 'Hormiga')} · ${money(d.amount ?? d.monto)}`,
    run: (d) => st().addHormiga(activeMonth(), {
      name: str(d.name, 'Hormiga').slice(0, 40),
      amount: Math.round(num(d.amount ?? d.monto)),
    }),
  },

  fijar_saldo: {
    title: 'Tu saldo real en el banco',
    cta: 'Fijar mi saldo',
    done: 'Saldo real actualizado',
    valid: (d) => num(d.monto ?? d.amount) >= 0 && (num(d.monto ?? d.amount) > 0 || d.monto === 0),
    summary: (d) => `Hoy tienes ${money(d.monto ?? d.amount)} en el banco`,
    run: (d) => st().setFundNow(Math.round(num(d.monto ?? d.amount))),
  },

  ingreso_extra: {
    title: 'Ingreso adicional del mes',
    cta: 'Agregarlo al mes',
    done: 'Ingreso adicional guardado',
    valid: (d) => num(d.monto ?? d.amount) > 0,
    summary: (d) => `${money(d.monto ?? d.amount)} extra este mes`,
    run: (d) => {
      const s = st()
      const m = s.months[s.activeMonthId]
      const actual = m?.income.additional ?? 0
      s.updateIncome(s.activeMonthId, { additional: actual + Math.round(num(d.monto ?? d.amount)) })
    },
  },
}

export function actionSpec(tipo: string): ActionSpec | undefined {
  return ACTIONS[tipo]
}
