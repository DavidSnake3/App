// Acciones que Snake puede ejecutar en la app. SIEMPRE se proponen con una
// tarjeta de confirmación: nada se guarda sin que el usuario toque "Confirmar".
import type { AccountType, ExpenseKind, MovementKind, Recurrence } from '../types/finance'
import { useFinanceStore } from '../store/useFinanceStore'
import { buildPayables, uid } from './finance'
import { countryPreset, presetExtraPays, presetStatutory } from './payroll'
import { activeAccounts, isCredit, mainAccount } from './accounts'
import { guessCategory } from './categories'
import { currentMonthId, todayLocalISO } from './dates'
import { FINANCIAL_PLANS } from './financialPlans'
import { formatMoney } from './format'
import { PERIOD_LABEL } from './payroll'

/**
 * Datos de una acción tal como los manda la IA. Es `unknown` a propósito: una
 * acción puede traer listas (los productos de una lista de compras) y cada
 * acción valida y convierte lo suyo con `num()`, `str()` y `lista()`.
 */
export type ActionData = Record<string, unknown>

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

/** Busca una cuenta por nombre (aproximado); si no, la principal */
function findAccount(nombre: unknown, soloCredito = false): string {
  const cuentas = activeAccounts(st().accounts).filter((a) => (soloCredito ? isCredit(a) : true))
  const q = str(nombre).toLowerCase()
  if (q) {
    const hit = cuentas.find((a) => a.name.toLowerCase() === q)
      ?? cuentas.find((a) => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()))
    if (hit) return hit.id
  }
  if (soloCredito) return cuentas[0]?.id ?? ''
  return mainAccount(st().accounts)?.id ?? cuentas[0]?.id ?? ''
}

function accountName(id: string): string {
  return st().accounts.find((a) => a.id === id)?.name ?? 'tu cuenta'
}

function movementKindOf(v: unknown): MovementKind {
  const k = str(v, 'gasto').toLowerCase()
  if (k.startsWith('ingr') || k.startsWith('entr')) return 'ingreso'
  if (k.startsWith('trans')) return 'transferencia'
  return 'gasto'
}

function accountTypeOf(v: unknown): AccountType {
  const t = str(v, 'efectivo').toLowerCase()
  if (t.startsWith('cred') || t.includes('tarjeta')) return 'credito'
  if (t.startsWith('corr') || t.includes('banco') || t.includes('debito') || t.includes('débito')) return 'corriente'
  if (t.startsWith('ahor')) return 'ahorros'
  if (t.startsWith('inv')) return 'inversion'
  return 'efectivo'
}

/** Fecha válida 'yyyy-MM-dd' o hoy */
function dateOf(v: unknown): string {
  const d = str(v)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayLocalISO()
}

function dayOf(v: unknown, fallback: number): number {
  const n = Math.round(num(v))
  return n >= 1 && n <= 31 ? n : fallback
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

/** Busca un préstamo por el nombre de la persona */
function findLoan(person: string) {
  const q = person.toLowerCase().trim()
  if (!q) return null
  const loans = st().loans.filter((l) => l.amount > l.payments.reduce((s, p) => s + p.amount, 0))
  return loans.find((l) => l.person.toLowerCase() === q)
    ?? loans.find((l) => l.person.toLowerCase().includes(q))
    ?? null
}

/** Busca un presupuesto por nombre */
function findBudget(name: string) {
  const q = name.toLowerCase().trim()
  if (!q) return null
  const list = st().budgets
  return list.find((b) => b.name.toLowerCase() === q)
    ?? list.find((b) => b.name.toLowerCase().includes(q))
    ?? null
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

  agregar_movimiento: {
    title: 'Registrar movimiento',
    cta: 'Registrarlo',
    done: 'Movimiento registrado',
    valid: (d) => num(d.amount ?? d.monto) > 0,
    summary: (d) => {
      const tipo = movementKindOf(d.tipo ?? d.kind)
      const cuenta = findAccount(d.cuenta ?? d.account)
      return `${tipo === 'ingreso' ? 'Entrada' : 'Salida'} · ${str(d.name, 'Movimiento')} · ` +
        `${money(d.amount ?? d.monto)} · ${accountName(cuenta)} · ${dateOf(d.fecha ?? d.date)}`
    },
    run: (d) => {
      const tipo = movementKindOf(d.tipo ?? d.kind)
      const name = str(d.name, tipo === 'ingreso' ? 'Ingreso' : 'Gasto').slice(0, 40)
      st().addMovement({
        name,
        amount: Math.round(num(d.amount ?? d.monto)),
        kind: tipo === 'transferencia' ? 'gasto' : tipo,
        categoryId: str(d.categoria ?? d.category) || guessCategory(name, tipo === 'ingreso' ? 'ingreso' : 'gasto'),
        accountId: findAccount(d.cuenta ?? d.account),
        dateISO: dateOf(d.fecha ?? d.date),
      })
    },
  },

  crear_cuenta: {
    title: 'Nueva cuenta',
    cta: 'Crearla',
    done: 'Cuenta creada',
    valid: (d) => str(d.name).length > 0,
    summary: (d) => {
      const tipo = accountTypeOf(d.tipo ?? d.type)
      if (tipo === 'credito') {
        return `Tarjeta ${str(d.name)} · corte día ${dayOf(d.corte ?? d.cutoffDay, 20)} · ` +
          `pago día ${dayOf(d.pago ?? d.dueDay, 5)} · interés ${num(d.interes ?? d.rate)}% ` +
          `${str(d.interesPeriodo, 'annual') === 'monthly' ? 'mensual' : 'anual'}`
      }
      return `${str(d.name)} (${tipo}) · saldo ${money(d.saldo ?? d.balance ?? 0)}`
    },
    run: (d) => {
      const tipo = accountTypeOf(d.tipo ?? d.type)
      const esCredito = tipo === 'credito'
      st().addAccount({
        name: str(d.name).slice(0, 30),
        type: tipo,
        openingBalance: esCredito ? 0 : Math.round(num(d.saldo ?? d.balance)),
        openingISO: todayLocalISO(),
        includeInTotal: !esCredito,
        credit: esCredito
          ? {
              limit: Math.round(num(d.limite ?? d.limit)),
              cutoffDay: dayOf(d.corte ?? d.cutoffDay, 20),
              dueDay: dayOf(d.pago ?? d.dueDay, 5),
              rate: num(d.interes ?? d.rate),
              ratePeriod: str(d.interesPeriodo, 'annual') === 'monthly' ? 'monthly' : 'annual',
              openingDebt: Math.round(num(d.deuda ?? d.openingDebt)),
            }
          : undefined,
      })
    },
  },

  pagar_tarjeta: {
    title: 'Pagar la tarjeta',
    cta: 'Registrar el pago',
    done: 'Pago registrado',
    valid: (d) => num(d.monto ?? d.amount) > 0 && Boolean(findAccount(d.tarjeta ?? d.card, true)),
    summary: (d) => {
      const tarjeta = findAccount(d.tarjeta ?? d.card, true)
      const origen = findAccount(d.cuenta ?? d.from)
      return `${money(d.monto ?? d.amount)} de ${accountName(origen)} a ${accountName(tarjeta)}`
    },
    run: (d) => {
      const tarjeta = findAccount(d.tarjeta ?? d.card, true)
      st().addMovement({
        name: `Pago ${accountName(tarjeta)}`,
        amount: Math.round(num(d.monto ?? d.amount)),
        kind: 'transferencia',
        categoryId: 'pago-tarjeta',
        accountId: findAccount(d.cuenta ?? d.from),
        toAccountId: tarjeta,
        dateISO: dateOf(d.fecha ?? d.date),
      })
    },
  },

  compra_cuotas: {
    title: 'Compra a cuotas',
    cta: 'Agregarla',
    done: 'Compra a cuotas agregada',
    valid: (d) => str(d.name).length > 0
      && Math.round(num(d.cuotas ?? d.count)) >= 1
      && (num(d.mensualidad ?? d.monthly) > 0 || num(d.total) > 0)
      && Boolean(findAccount(d.tarjeta ?? d.card, true)),
    summary: (d) => {
      const cuotas = Math.max(1, Math.round(num(d.cuotas ?? d.count)))
      const mensual = num(d.mensualidad ?? d.monthly) || Math.round(num(d.total) / cuotas)
      const tarjeta = findAccount(d.tarjeta ?? d.card, true)
      return `${str(d.name)} · ${cuotas} cuotas de ${money(mensual)} · ${accountName(tarjeta)}`
    },
    run: (d) => {
      const cuotas = Math.max(1, Math.round(num(d.cuotas ?? d.count)))
      const mensual = Math.round(num(d.mensualidad ?? d.monthly) || num(d.total) / cuotas)
      const tarjeta = findAccount(d.tarjeta ?? d.card, true)
      const dueDay = dayOf(d.dia ?? d.dueDay, st().accounts.find((a) => a.id === tarjeta)?.credit?.dueDay ?? 5)
      st().addInstallment({
        name: str(d.name).slice(0, 40),
        accountId: tarjeta,
        total: Math.round(num(d.total)) || mensual * cuotas,
        monthly: mensual,
        count: cuotas,
        dueDay,
        startMonthId: currentMonthId(),
      })
    },
  },

  fijar_saldo: {
    title: 'Tu saldo real en el banco',
    cta: 'Fijar mi saldo',
    done: 'Saldo real actualizado',
    valid: (d) => num(d.monto ?? d.amount) >= 0 && (num(d.monto ?? d.amount) > 0 || d.monto === 0),
    summary: (d) => `Hoy tienes ${money(d.monto ?? d.amount)} en el banco`,
    run: (d) => st().setFundNow(Math.round(num(d.monto ?? d.amount))),
  },

  prestar: {
    title: 'Le presté plata a alguien',
    cta: 'Registrar el préstamo',
    done: 'Préstamo registrado: lo ves en Deudas → Me deben',
    valid: (d) => str(d.persona ?? d.name).length > 0 && num(d.monto ?? d.amount) > 0,
    summary: (d) => `${str(d.persona ?? d.name)} · ${money(d.monto ?? d.amount)}`,
    run: (d) => st().addLoan({
      person: str(d.persona ?? d.name, 'Alguien').slice(0, 40),
      amount: Math.round(num(d.monto ?? d.amount)),
      dateISO: str(d.fecha) || new Date().toISOString().slice(0, 10),
      note: str(d.nota) || undefined,
    }),
  },

  abono_prestamo: {
    title: 'Me abonaron un préstamo',
    cta: 'Registrar el abono',
    done: 'Abono registrado',
    valid: (d) => {
      const l = findLoan(str(d.persona ?? d.name))
      return Boolean(l) && num(d.monto ?? d.amount) > 0
    },
    summary: (d) => {
      const l = findLoan(str(d.persona ?? d.name))
      return l
        ? `${l.person} te abonó ${money(d.monto ?? d.amount)}`
        : `No encontré a "${str(d.persona ?? d.name)}" en tus préstamos`
    },
    run: (d) => {
      const l = findLoan(str(d.persona ?? d.name))
      if (l) st().addLoanPayment(l.id, Math.round(num(d.monto ?? d.amount)), 'Abono')
    },
  },

  crear_presupuesto: {
    title: 'Nuevo presupuesto',
    cta: 'Crear el presupuesto',
    done: 'Presupuesto creado: lo ves en la pestaña Mes',
    valid: (d) => str(d.name).length > 0 && num(d.monto ?? d.amount) > 0,
    summary: (d) => `${str(d.name)} · ${money(d.monto ?? d.amount)} ${str(d.periodo) === 'weekly' ? 'por semana' : 'por mes'}`,
    run: (d) => st().addBudget({
      name: str(d.name, 'Presupuesto').slice(0, 40),
      amount: Math.round(num(d.monto ?? d.amount)),
      period: str(d.periodo) === 'weekly' ? 'weekly' : 'monthly',
    }),
  },

  gasto_presupuesto: {
    title: 'Gasto en un presupuesto',
    cta: 'Anotarlo',
    done: 'Gasto anotado en tu presupuesto',
    valid: (d) => Boolean(findBudget(str(d.presupuesto ?? d.name))) && num(d.monto ?? d.amount) > 0,
    summary: (d) => {
      const b = findBudget(str(d.presupuesto ?? d.name))
      return b
        ? `${money(d.monto ?? d.amount)} en ${b.name}`
        : `No encontré el presupuesto "${str(d.presupuesto ?? d.name)}"`
    },
    run: (d) => {
      const b = findBudget(str(d.presupuesto ?? d.name))
      if (b) st().addBudgetEntry(b.id, Math.round(num(d.monto ?? d.amount)), str(d.nota) || undefined)
    },
  },

  elegir_plan: {
    title: 'Plan financiero',
    cta: 'Usar este plan',
    done: 'Plan activado: lo ves en la pestaña Mes',
    valid: (d) => Boolean(FINANCIAL_PLANS.find((p) => p.id === str(d.plan ?? d.id))),
    summary: (d) => {
      const p = FINANCIAL_PLANS.find((x) => x.id === str(d.plan ?? d.id))
      return p ? `${p.name} — ${p.tagline}` : ''
    },
    run: (d) => st().setSettings({ financialPlanId: str(d.plan ?? d.id) }),
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
