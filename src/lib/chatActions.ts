// Acciones que Snake puede ejecutar en la app. SIEMPRE se proponen con una
// tarjeta de confirmación: nada se guarda sin que el usuario toque "Confirmar".
import type { AccountType, ExpenseKind, MovementKind, Recurrence, TabId } from '../types/finance'
import type { GeminiFunctionDecl } from './ai'
import { APP_MAP, buscarLugar, rutaDe } from './appMap'
import { loanKind, loanRemaining } from './loans'
import { remainingAmount } from './finance'
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

/**
 * Cuánto pesa una acción. `lectura` y `navegacion` se ejecutan solas; las
 * demás SIEMPRE piden confirmación, y `borra` avisa que no se puede deshacer.
 */
export type Riesgo = 'lectura' | 'navegacion' | 'crea' | 'modifica' | 'mueve_plata' | 'borra'

/** Esquema de parámetros en el subconjunto OpenAPI que entiende Gemini */
export type ParamSchema = Record<string, unknown>

export interface ActionSpec {
  /** qué hace, para que la IA sepa cuándo usarla (va a Gemini) */
  desc: string
  /** parámetros que acepta (function calling) */
  params: ParamSchema
  riesgo: Riesgo
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

/** Lista de objetos, tolerante: acepta array o un solo objeto */
function lista(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]
  if (v && typeof v === 'object') return [v as Record<string, unknown>]
  return []
}

/** Atajos para escribir esquemas de Gemini sin repetir */
const S = {
  str: (description: string, extra: Record<string, unknown> = {}) => ({ type: 'STRING', description, ...extra }),
  num: (description: string) => ({ type: 'NUMBER', description }),
  int: (description: string) => ({ type: 'INTEGER', description }),
  bool: (description: string) => ({ type: 'BOOLEAN', description }),
  enum: (description: string, values: string[]) => ({ type: 'STRING', description, enum: values }),
  obj: (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'OBJECT', properties, required }),
  arr: (description: string, items: Record<string, unknown>) => ({ type: 'ARRAY', description, items }),
}

/** Busca un gasto del mes activo por nombre; devuelve el Expense real */
function findExpense(name: string) {
  const s = st()
  const month = s.months[s.activeMonthId]
  if (!month) return null
  const q = name.toLowerCase().trim()
  if (!q) return null
  return month.expenses.find((e) => e.name.toLowerCase() === q)
    ?? month.expenses.find((e) => e.name.toLowerCase().includes(q))
    ?? month.expenses.find((e) => q.includes(e.name.toLowerCase()))
    ?? null
}

/** Busca una lista de compras del mes activo por nombre (o la única abierta) */
function findShoppingList(name: string) {
  const s = st()
  const month = s.months[s.activeMonthId]
  if (!month) return null
  const listas = month.expenses.filter((e) => e.shopping)
  const q = name.toLowerCase().trim()
  if (q) {
    const hit = listas.find((e) => e.name.toLowerCase() === q)
      ?? listas.find((e) => e.name.toLowerCase().includes(q))
    if (hit) return hit
  }
  const abiertas = listas.filter((e) => !e.shopping!.done)
  return abiertas.length === 1 ? abiertas[0] : (listas.length === 1 ? listas[0] : null)
}

/** Busca un movimiento reciente por nombre (mes activo y anterior) */
function findMovement(name: string, amount?: number) {
  const s = st()
  const q = name.toLowerCase().trim()
  const meses = Object.values(s.months).sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 3)
  for (const m of meses) {
    const movs = [...(m.movements ?? [])].reverse()
    const hit = movs.find((mv) => (!q || mv.name.toLowerCase().includes(q)) && (!amount || Math.round(mv.amount) === Math.round(amount)))
    if (hit) return hit
  }
  return null
}

/** Busca una deuda formal por nombre */
function findDebt(name: string) {
  const q = name.toLowerCase().trim()
  if (!q) return null
  return st().debts.find((d) => d.name.toLowerCase() === q)
    ?? st().debts.find((d) => d.name.toLowerCase().includes(q))
    ?? null
}

/** Busca una cuenta por nombre y devuelve el objeto (o null) */
function findAccountObj(nombre: unknown) {
  const id = findAccount(nombre)
  const q = str(nombre).toLowerCase()
  const a = st().accounts.find((x) => x.id === id)
  // si dio un nombre y no coincide con nada, no adivinar la principal
  if (q && a && !a.name.toLowerCase().includes(q) && !q.includes(a.name.toLowerCase())) return null
  return a ?? null
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
function findLoan(person: string, kind?: 'lent' | 'borrowed') {
  const q = person.toLowerCase().trim()
  if (!q) return null
  const loans = st().loans
    .filter((l) => loanRemaining(l) > 0)
    .filter((l) => !kind || loanKind(l) === kind)
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
    desc: 'Registrar una DEUDA formal con cuota mensual (préstamo del banco, carro, casa, electrodoméstico a plazos).',
    params: S.obj({ name: S.str('nombre de la deuda'), total: S.num('monto total'), monthlyPayment: S.num('cuota mensual'), installments: S.int('número de cuotas'), dueDay: S.int('día del mes en que vence la cuota'), account: S.str('banco o entidad') }, ['name', 'total']),
    riesgo: 'crea',
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
    desc: 'Agregar un PAGO del mes (servicio, gasto o personal) con fecha límite. Si el usuario dice que ya lo gastó, usa agregar_movimiento.',
    params: S.obj({ name: S.str('nombre del pago'), amount: S.num('monto'), kind: S.enum('tipo', ['gasto', 'servicio', 'personal']), dueDay: S.int('día del mes en que vence'), recurrencia: S.enum('cada cuánto se repite', ['once', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual']), cuenta: S.str('cuenta con la que se paga'), categoria: S.str('id de categoría') }, ['name', 'amount']),
    riesgo: 'crea',
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
    desc: 'Marcar un pago del mes como PAGADO (crea su movimiento y sale de la cuenta).',
    params: S.obj({ nombre: S.str('nombre del pago tal como aparece en el mes') }, ['nombre']),
    riesgo: 'mueve_plata',
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
    desc: 'Configurar el salario y la planilla del usuario.',
    params: S.obj({ bruto: S.num('salario bruto'), periodo: S.enum('cada cuánto le pagan', ['daily', 'weekly', 'fortnightly', 'biweekly', 'monthly']), paisId: S.str('código de país: cr, mx, co…'), deduccionNombre: S.str('nombre de la deducción de ley'), deduccionPct: S.num('% de la deducción de ley') }, ['bruto']),
    riesgo: 'modifica',
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
    desc: 'Agregar una deducción al salario (crédito, embargo, adelanto).',
    params: S.obj({ name: S.str('nombre'), amount: S.num('monto'), esAdelanto: S.bool('true si es un adelanto de salario') }, ['name', 'amount']),
    riesgo: 'modifica',
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
    desc: 'Crear un sobre de ahorro con meta.',
    params: S.obj({ name: S.str('nombre del sobre'), meta: S.num('meta'), actual: S.num('lo que ya tiene guardado') }, ['name']),
    riesgo: 'crea',
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
    desc: 'Aportar plata a un sobre de ahorro.',
    params: S.obj({ monto: S.num('monto'), sobre: S.str('nombre del sobre') }, ['monto']),
    riesgo: 'mueve_plata',
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
    desc: 'Registrar un MOVIMIENTO: plata que YA salió (gasto) o entró (ingreso), con categoría, cuenta y fecha.',
    params: S.obj({ name: S.str('descripción'), amount: S.num('monto'), tipo: S.enum('tipo', ['gasto', 'ingreso']), categoria: S.str('id de categoría: comida, super, cafe, transporte, gasolina, casa, servicios, salud, educacion, ropa, entretenimiento, tecnologia, mascotas, regalos, belleza, deudas, otros, salario, extra, venta, reembolso'), cuenta: S.str('nombre de la cuenta'), fecha: S.str('yyyy-MM-dd') }, ['amount']),
    riesgo: 'mueve_plata',
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
    desc: 'Crear una cuenta (efectivo, corriente, ahorros, inversión) o una TARJETA de crédito.',
    params: S.obj({ name: S.str('nombre'), tipo: S.enum('tipo', ['efectivo', 'corriente', 'ahorros', 'credito', 'inversion']), saldo: S.num('saldo actual (no para tarjetas)'), limite: S.num('límite de la tarjeta'), corte: S.int('día de corte'), pago: S.int('día de pago'), interes: S.num('% de interés'), interesPeriodo: S.enum('el interés es', ['annual', 'monthly']), deuda: S.num('deuda actual de la tarjeta') }, ['name']),
    riesgo: 'crea',
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
    desc: 'Pagar la tarjeta de crédito desde una cuenta (baja la deuda y el efectivo).',
    params: S.obj({ tarjeta: S.str('nombre de la tarjeta'), monto: S.num('monto'), cuenta: S.str('cuenta de la que sale'), fecha: S.str('yyyy-MM-dd') }, ['tarjeta', 'monto']),
    riesgo: 'mueve_plata',
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
    desc: 'Registrar una compra a cuotas con tarjeta de crédito.',
    params: S.obj({ name: S.str('qué compró'), tarjeta: S.str('nombre de la tarjeta'), total: S.num('monto total'), mensualidad: S.num('cuota mensual'), cuotas: S.int('número de cuotas'), dia: S.int('día de pago') }, ['name', 'cuotas']),
    riesgo: 'crea',
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


  prestar: {
    desc: 'Registrar que el usuario LE PRESTÓ plata a alguien (le deben).',
    params: S.obj({ persona: S.str('a quién'), monto: S.num('monto'), fecha: S.str('yyyy-MM-dd'), cuenta: S.str('cuenta de la que salió'), nota: S.str('nota') }, ['persona', 'monto']),
    riesgo: 'mueve_plata',
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
    desc: 'Registrar un ABONO de un préstamo informal: si el usuario prestó, le abonaron; si a él le prestaron, él abonó.',
    params: S.obj({ persona: S.str('nombre de la persona'), monto: S.num('monto'), fecha: S.str('yyyy-MM-dd'), cuenta: S.str('cuenta') }, ['persona', 'monto']),
    riesgo: 'mueve_plata',
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
    desc: 'Crear un presupuesto con límite mensual o semanal.',
    params: S.obj({ name: S.str('nombre'), monto: S.num('límite'), periodo: S.enum('periodo', ['monthly', 'weekly']) }, ['name', 'monto']),
    riesgo: 'crea',
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
    desc: 'Anotar un gasto dentro de un presupuesto.',
    params: S.obj({ presupuesto: S.str('nombre del presupuesto'), monto: S.num('monto'), nota: S.str('nota') }, ['presupuesto', 'monto']),
    riesgo: 'modifica',
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
    desc: 'Elegir la regla de reparto del ingreso (50/30/20, etc.).',
    params: S.obj({ plan: S.enum('plan', ['50-30-20', '40-30-20-10', '60-20-20', '70-20-10', '80-20']) }, ['plan']),
    riesgo: 'modifica',
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
    desc: 'Agregar un ingreso adicional al mes (aparte del salario).',
    params: S.obj({ monto: S.num('monto') }, ['monto']),
    riesgo: 'modifica',
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

  /* ─── Listas de compras ──────────────────────────────────────────────── */

  crear_lista_compras: {
    desc: 'Crear una LISTA DE COMPRAS del mes con varios productos de una vez (nombre, precio y cantidad). Úsala cuando el usuario quiera armar la lista del súper, incluso a partir de una factura o de compras anteriores que veas en sus datos.',
    params: S.obj({
      name: S.str('nombre de la lista, ej. "Diario de la quincena"'),
      tienda: S.str('dónde va a comprar (opcional)'),
      cuenta: S.str('cuenta con la que pagará (opcional)'),
      dia: S.int('día del mes en que hará la compra (opcional)'),
      productos: S.arr('productos de la lista', S.obj({ name: S.str('producto'), price: S.num('precio unitario'), qty: S.int('cantidad, 1 si no se indica') }, ['name', 'price'])),
    }, ['name', 'productos']),
    riesgo: 'crea',
    title: 'Nueva lista de compras',
    cta: 'Crear la lista',
    done: 'Lista creada: la ves en Mes → Lista de compras y en Pagos del mes',
    valid: (d) => str(d.name).length > 0 && lista(d.productos).some((p) => str(p.name) && num(p.price) > 0),
    summary: (d) => {
      const ps = lista(d.productos).filter((p) => str(p.name) && num(p.price) > 0)
      const total = ps.reduce((t, p) => t + num(p.price) * Math.max(1, Math.round(num(p.qty) || 1)), 0)
      const primeros = ps.slice(0, 4).map((p) => str(p.name)).join(', ')
      return `${str(d.name)} · ${ps.length} producto${ps.length === 1 ? '' : 's'} (${primeros}${ps.length > 4 ? '…' : ''}) · ${money(total)} planeados`
        + (str(d.tienda) ? ` · ${str(d.tienda)}` : '')
    },
    run: (d) => {
      const id = st().createShoppingList(activeMonth(), {
        name: str(d.name, 'Lista de compras').slice(0, 40),
        store: str(d.tienda) || undefined,
        dueDay: num(d.dia) >= 1 && num(d.dia) <= 31 ? Math.round(num(d.dia)) : undefined,
        accountId: str(d.cuenta) ? findAccount(d.cuenta) : undefined,
        icon: 'super',
      })
      for (const p of lista(d.productos)) {
        if (!str(p.name) || num(p.price) <= 0) continue
        st().addShoppingProduct(activeMonth(), id, {
          name: str(p.name).slice(0, 40),
          price: Math.round(num(p.price)),
          qty: Math.max(1, Math.round(num(p.qty) || 1)),
        })
      }
    },
  },

  agregar_producto_lista: {
    desc: 'Agregar uno o varios productos a una lista de compras que ya existe.',
    params: S.obj({
      lista: S.str('nombre de la lista (si hay una sola abierta puede omitirse)'),
      productos: S.arr('productos', S.obj({ name: S.str('producto'), price: S.num('precio'), qty: S.int('cantidad') }, ['name', 'price'])),
    }, ['productos']),
    riesgo: 'modifica',
    title: 'Agregar a la lista',
    cta: 'Agregarlos',
    done: 'Productos agregados a la lista',
    valid: (d) => Boolean(findShoppingList(str(d.lista))) && lista(d.productos).some((p) => str(p.name) && num(p.price) > 0),
    summary: (d) => {
      const l = findShoppingList(str(d.lista))
      const ps = lista(d.productos)
      return l ? `${ps.map((p) => str(p.name)).join(', ')} → ${l.name}` : `No encontré la lista "${str(d.lista)}"`
    },
    run: (d) => {
      const l = findShoppingList(str(d.lista))
      if (!l) return
      for (const p of lista(d.productos)) {
        if (!str(p.name) || num(p.price) <= 0) continue
        st().addShoppingProduct(activeMonth(), l.id, { name: str(p.name).slice(0, 40), price: Math.round(num(p.price)), qty: Math.max(1, Math.round(num(p.qty) || 1)) })
      }
    },
  },

  marcar_producto: {
    desc: 'Marcar (o desmarcar) productos de una lista de compras como ya echados al carrito. NO mueve plata.',
    params: S.obj({ lista: S.str('nombre de la lista'), productos: S.arr('nombres de los productos', S.str('producto')) }, ['productos']),
    riesgo: 'modifica',
    title: 'Marcar en la lista',
    cta: 'Marcarlos',
    done: 'Listo, marcados en el carrito',
    valid: (d) => Boolean(findShoppingList(str(d.lista))) && (Array.isArray(d.productos) ? d.productos.length > 0 : Boolean(str(d.productos))),
    summary: (d) => {
      const l = findShoppingList(str(d.lista))
      const nombres = (Array.isArray(d.productos) ? d.productos : [d.productos]).map((x) => str(x)).filter(Boolean)
      return l ? `${nombres.join(', ')} en ${l.name}` : `No encontré la lista "${str(d.lista)}"`
    },
    run: (d) => {
      const l = findShoppingList(str(d.lista))
      if (!l?.shopping) return
      const nombres = (Array.isArray(d.productos) ? d.productos : [d.productos]).map((x) => str(x).toLowerCase()).filter(Boolean)
      for (const prod of l.shopping.items) {
        if (nombres.some((n) => prod.name.toLowerCase().includes(n) || n.includes(prod.name.toLowerCase()))) {
          st().toggleShoppingProduct(activeMonth(), l.id, prod.id)
        }
      }
    },
  },

  cerrar_lista: {
    desc: 'FINALIZAR una lista de compras: ahí sí sale de la cuenta lo marcado. Solo si el usuario ya terminó de comprar.',
    params: S.obj({ lista: S.str('nombre de la lista') }, []),
    riesgo: 'mueve_plata',
    title: 'Finalizar la compra',
    cta: 'Finalizar y cobrar lo marcado',
    done: 'Compra cerrada: salió de tu cuenta lo que marcaste',
    valid: (d) => { const l = findShoppingList(str(d.lista)); return Boolean(l?.shopping && !l.shopping.done && l.shopping.items.some((p) => p.checked)) },
    summary: (d) => {
      const l = findShoppingList(str(d.lista))
      if (!l?.shopping) return `No encontré la lista "${str(d.lista)}"`
      const marcado = l.shopping.items.filter((p) => p.checked).reduce((t, p) => t + p.price * Math.max(1, p.qty), 0)
      return `${l.name} · ${money(marcado)} marcados de ${money(l.amount)} planeados`
    },
    run: (d) => { const l = findShoppingList(str(d.lista)); if (l) st().toggleShoppingDone(activeMonth(), l.id) },
  },

  eliminar_lista: {
    desc: 'Eliminar una lista de compras del mes.',
    params: S.obj({ lista: S.str('nombre de la lista') }, ['lista']),
    riesgo: 'borra',
    title: 'Eliminar lista de compras',
    cta: 'Eliminarla',
    done: 'Lista eliminada',
    valid: (d) => Boolean(findShoppingList(str(d.lista))),
    summary: (d) => { const l = findShoppingList(str(d.lista)); return l ? `${l.name} · ${l.shopping?.items.length ?? 0} productos` : `No encontré la lista "${str(d.lista)}"` },
    run: (d) => { const l = findShoppingList(str(d.lista)); if (l) st().deleteExpense(activeMonth(), l.id, 'mes') },
  },

  /* ─── Pagos del mes: adelantos, editar, eliminar ─────────────────────── */

  adelantar_pago: {
    desc: 'ADELANTAR una parte de un pago del mes antes de pagarlo del todo (ej. abonar 15 000 al recibo de 30 000). Sale plata real y baja lo pendiente.',
    params: S.obj({ nombre: S.str('nombre del pago'), monto: S.num('cuánto adelanta'), fecha: S.str('yyyy-MM-dd'), cuenta: S.str('cuenta de la que sale') }, ['nombre', 'monto']),
    riesgo: 'mueve_plata',
    title: 'Adelantar parte de un pago',
    cta: 'Registrar el adelanto',
    done: 'Adelanto registrado: bajó lo pendiente de ese pago',
    valid: (d) => { const e = findExpense(str(d.nombre)); return Boolean(e && !e.paid && !e.shopping) && num(d.monto) > 0 },
    summary: (d) => {
      const e = findExpense(str(d.nombre))
      if (!e) return `No encontré "${str(d.nombre)}" en tu mes`
      const falta = remainingAmount(e)
      const monto = Math.min(num(d.monto), falta)
      return `${money(monto)} a ${e.name} · quedarían ${money(falta - monto)} pendientes`
    },
    run: (d) => {
      const e = findExpense(str(d.nombre))
      if (!e) return
      st().addExpenseAdvance(activeMonth(), e.id, { amount: Math.round(num(d.monto)), dateISO: str(d.fecha) ? dateOf(d.fecha) : undefined, accountId: str(d.cuenta) ? findAccount(d.cuenta) : undefined })
    },
  },

  editar_gasto: {
    desc: 'Cambiar un pago del mes: nombre, monto, día de vencimiento o cuenta. Si es recurrente, se aplica también a los meses siguientes.',
    params: S.obj({ nombre: S.str('nombre actual del pago'), nuevoNombre: S.str('nuevo nombre'), monto: S.num('nuevo monto'), dia: S.int('nuevo día de vencimiento'), cuenta: S.str('nueva cuenta') }, ['nombre']),
    riesgo: 'modifica',
    title: 'Editar pago',
    cta: 'Guardar el cambio',
    done: 'Pago actualizado',
    valid: (d) => Boolean(findExpense(str(d.nombre))) && (Boolean(str(d.nuevoNombre)) || num(d.monto) > 0 || num(d.dia) > 0 || Boolean(str(d.cuenta))),
    summary: (d) => {
      const e = findExpense(str(d.nombre))
      if (!e) return `No encontré "${str(d.nombre)}" en tu mes`
      const cambios = [str(d.nuevoNombre) && `nombre → ${str(d.nuevoNombre)}`, num(d.monto) > 0 && `monto → ${money(d.monto)}`, num(d.dia) > 0 && `vence → día ${Math.round(num(d.dia))}`, str(d.cuenta) && `cuenta → ${accountName(findAccount(d.cuenta))}`].filter(Boolean)
      return `${e.name}: ${cambios.join(' · ')}`
    },
    run: (d) => {
      const e = findExpense(str(d.nombre))
      if (!e) return
      const patch: Record<string, unknown> = {}
      if (str(d.nuevoNombre)) patch.name = str(d.nuevoNombre).slice(0, 60)
      if (num(d.monto) > 0) patch.amount = Math.round(num(d.monto))
      if (num(d.dia) >= 1 && num(d.dia) <= 31) { patch.dueDay = Math.round(num(d.dia)); patch.period = num(d.dia) <= 15 ? 'q1' : 'q2' }
      if (str(d.cuenta)) patch.accountId = findAccount(d.cuenta)
      st().updateExpense(activeMonth(), e.id, patch, e.templateId ? 'siempre' : 'mes')
    },
  },

  eliminar_gasto: {
    desc: 'Eliminar un pago del mes. Si es recurrente, puede quitarse solo de este mes o dejar de repetirse.',
    params: S.obj({ nombre: S.str('nombre del pago'), alcance: S.enum('solo este mes o dejar de repetirlo', ['mes', 'siempre']) }, ['nombre']),
    riesgo: 'borra',
    title: 'Eliminar pago',
    cta: 'Eliminarlo',
    done: 'Pago eliminado',
    valid: (d) => Boolean(findExpense(str(d.nombre))),
    summary: (d) => {
      const e = findExpense(str(d.nombre))
      if (!e) return `No encontré "${str(d.nombre)}" en tu mes`
      return `${e.name} · ${money(e.amount)}` + (e.templateId ? (str(d.alcance) === 'siempre' ? ' · deja de repetirse' : ' · solo este mes') : '')
    },
    run: (d) => { const e = findExpense(str(d.nombre)); if (e) st().deleteExpense(activeMonth(), e.id, str(d.alcance) === 'siempre' ? 'siempre' : 'mes') },
  },

  /* ─── Movimientos: editar y eliminar ────────────────────────────────── */

  editar_movimiento: {
    desc: 'Corregir un movimiento ya registrado: monto, nombre, categoría, cuenta o fecha.',
    params: S.obj({ nombre: S.str('nombre del movimiento'), montoActual: S.num('monto actual, para ubicarlo si hay varios'), nuevoNombre: S.str('nuevo nombre'), monto: S.num('nuevo monto'), categoria: S.str('nueva categoría (id)'), cuenta: S.str('nueva cuenta'), fecha: S.str('nueva fecha yyyy-MM-dd') }, ['nombre']),
    riesgo: 'modifica',
    title: 'Editar movimiento',
    cta: 'Guardar el cambio',
    done: 'Movimiento actualizado',
    valid: (d) => Boolean(findMovement(str(d.nombre), num(d.montoActual) || undefined)),
    summary: (d) => {
      const mv = findMovement(str(d.nombre), num(d.montoActual) || undefined)
      if (!mv) return `No encontré el movimiento "${str(d.nombre)}"`
      const cambios = [str(d.nuevoNombre) && `nombre → ${str(d.nuevoNombre)}`, num(d.monto) > 0 && `monto → ${money(d.monto)}`, str(d.categoria) && `categoría → ${str(d.categoria)}`, str(d.cuenta) && `cuenta → ${accountName(findAccount(d.cuenta))}`, str(d.fecha) && `fecha → ${dateOf(d.fecha)}`].filter(Boolean)
      return `${mv.name} (${money(mv.amount)}): ${cambios.join(' · ') || 'sin cambios'}`
    },
    run: (d) => {
      const mv = findMovement(str(d.nombre), num(d.montoActual) || undefined)
      if (!mv) return
      const patch: Record<string, unknown> = {}
      if (str(d.nuevoNombre)) patch.name = str(d.nuevoNombre).slice(0, 40)
      if (num(d.monto) > 0) patch.amount = Math.round(num(d.monto))
      if (str(d.categoria)) patch.categoryId = str(d.categoria)
      if (str(d.cuenta)) patch.accountId = findAccount(d.cuenta)
      if (str(d.fecha)) patch.dateISO = dateOf(d.fecha)
      st().updateMovement(mv.id, patch)
    },
  },

  eliminar_movimiento: {
    desc: 'Eliminar un movimiento registrado por error (la plata vuelve a la cuenta).',
    params: S.obj({ nombre: S.str('nombre del movimiento'), monto: S.num('monto, para ubicarlo si hay varios') }, ['nombre']),
    riesgo: 'borra',
    title: 'Eliminar movimiento',
    cta: 'Eliminarlo',
    done: 'Movimiento eliminado',
    valid: (d) => Boolean(findMovement(str(d.nombre), num(d.monto) || undefined)),
    summary: (d) => { const mv = findMovement(str(d.nombre), num(d.monto) || undefined); return mv ? `${mv.name} · ${money(mv.amount)} · ${mv.dateISO}` : `No encontré el movimiento "${str(d.nombre)}"` },
    run: (d) => { const mv = findMovement(str(d.nombre), num(d.monto) || undefined); if (mv) st().deleteMovement(mv.id) },
  },

  /* ─── Cuentas: transferir, retiro con tarjeta, editar, eliminar ──────── */

  transferir: {
    desc: 'Mover plata entre dos cuentas del usuario (traslado). No es un gasto.',
    params: S.obj({ monto: S.num('monto'), desde: S.str('cuenta de origen'), hacia: S.str('cuenta de destino'), fecha: S.str('yyyy-MM-dd'), nota: S.str('nota') }, ['monto', 'desde', 'hacia']),
    riesgo: 'mueve_plata',
    title: 'Mover plata entre cuentas',
    cta: 'Hacer el traslado',
    done: 'Traslado registrado',
    valid: (d) => num(d.monto) > 0 && Boolean(findAccountObj(d.desde)) && Boolean(findAccountObj(d.hacia)) && findAccount(d.desde) !== findAccount(d.hacia),
    summary: (d) => `${money(d.monto)} de ${accountName(findAccount(d.desde))} a ${accountName(findAccount(d.hacia))}`,
    run: (d) => st().addMovement({
      name: str(d.nota, 'Traslado').slice(0, 40), amount: Math.round(num(d.monto)), kind: 'transferencia',
      categoryId: 'transferencia', accountId: findAccount(d.desde), toAccountId: findAccount(d.hacia), dateISO: dateOf(d.fecha),
    }),
  },

  retiro_tarjeta: {
    desc: 'Retiro de efectivo con TARJETA de crédito: sube la deuda de la tarjeta y sube el efectivo.',
    params: S.obj({ monto: S.num('monto'), tarjeta: S.str('nombre de la tarjeta'), hacia: S.str('cuenta donde entra el efectivo'), fecha: S.str('yyyy-MM-dd') }, ['monto', 'tarjeta']),
    riesgo: 'mueve_plata',
    title: 'Retiro de efectivo con tarjeta',
    cta: 'Registrar el retiro',
    done: 'Retiro registrado: subió la deuda de la tarjeta',
    valid: (d) => num(d.monto) > 0 && Boolean(findAccount(d.tarjeta, true)),
    summary: (d) => `${money(d.monto)} de ${accountName(findAccount(d.tarjeta, true))} a ${accountName(findAccount(d.hacia))} · ojo: genera intereses desde hoy`,
    run: (d) => st().addMovement({
      name: 'Retiro con tarjeta', amount: Math.round(num(d.monto)), kind: 'transferencia', categoryId: 'transferencia',
      accountId: findAccount(d.tarjeta, true), toAccountId: findAccount(d.hacia), dateISO: dateOf(d.fecha),
    }),
  },

  editar_cuenta: {
    desc: 'Cambiar el nombre o el color de una cuenta, o marcarla como principal.',
    params: S.obj({ cuenta: S.str('nombre actual'), nuevoNombre: S.str('nuevo nombre'), principal: S.bool('marcarla como principal') }, ['cuenta']),
    riesgo: 'modifica',
    title: 'Editar cuenta',
    cta: 'Guardar',
    done: 'Cuenta actualizada',
    valid: (d) => Boolean(findAccountObj(d.cuenta)) && (Boolean(str(d.nuevoNombre)) || d.principal === true),
    summary: (d) => `${accountName(findAccount(d.cuenta))}${str(d.nuevoNombre) ? ` → ${str(d.nuevoNombre)}` : ''}${d.principal === true ? ' · pasa a ser la principal' : ''}`,
    run: (d) => {
      const id = findAccount(d.cuenta)
      if (str(d.nuevoNombre)) st().updateAccount(id, { name: str(d.nuevoNombre).slice(0, 30) })
      if (d.principal === true) st().setMainAccount(id)
    },
  },

  eliminar_cuenta: {
    desc: 'Eliminar una cuenta del usuario.',
    params: S.obj({ cuenta: S.str('nombre de la cuenta') }, ['cuenta']),
    riesgo: 'borra',
    title: 'Eliminar cuenta',
    cta: 'Eliminarla',
    done: 'Cuenta eliminada',
    valid: (d) => Boolean(findAccountObj(d.cuenta)),
    summary: (d) => `${accountName(findAccount(d.cuenta))} · sus movimientos quedan sin cuenta`,
    run: (d) => st().deleteAccount(findAccount(d.cuenta)),
  },

  /* ─── Préstamos informales ───────────────────────────────────────────── */

  me_prestaron: {
    desc: 'Registrar que ALGUIEN LE PRESTÓ plata al usuario (él debe). Entra a la cuenta.',
    params: S.obj({ persona: S.str('quién le prestó'), monto: S.num('monto'), fecha: S.str('yyyy-MM-dd'), cuenta: S.str('cuenta donde entró'), nota: S.str('nota') }, ['persona', 'monto']),
    riesgo: 'mueve_plata',
    title: 'Me prestaron plata',
    cta: 'Registrarlo',
    done: 'Registrado: lo ves en Dinero → Me prestaron',
    valid: (d) => str(d.persona).length > 0 && num(d.monto) > 0,
    summary: (d) => `${str(d.persona)} te prestó ${money(d.monto)}${str(d.cuenta) ? ` → ${accountName(findAccount(d.cuenta))}` : ''}`,
    run: (d) => st().addLoan({
      kind: 'borrowed', person: str(d.persona, 'Alguien').slice(0, 40), amount: Math.round(num(d.monto)),
      dateISO: str(d.fecha) ? dateOf(d.fecha) : todayLocalISO(), accountId: str(d.cuenta) ? findAccount(d.cuenta) : undefined, note: str(d.nota) || undefined,
    }),
  },

  prestar_mas: {
    desc: 'Prestarle MÁS plata a alguien que ya te debe (se suma a su préstamo).',
    params: S.obj({ persona: S.str('nombre'), monto: S.num('monto'), fecha: S.str('yyyy-MM-dd'), cuenta: S.str('cuenta de la que sale') }, ['persona', 'monto']),
    riesgo: 'mueve_plata',
    title: 'Prestarle más',
    cta: 'Registrarlo',
    done: 'Sumado a lo que te debe',
    valid: (d) => Boolean(findLoan(str(d.persona), 'lent')) && num(d.monto) > 0,
    summary: (d) => { const l = findLoan(str(d.persona), 'lent'); return l ? `${money(d.monto)} más a ${l.person} · te debería ${money(loanRemaining(l) + num(d.monto))}` : `No encontré a "${str(d.persona)}" en Le presté` },
    run: (d) => { const l = findLoan(str(d.persona), 'lent'); if (l) st().addLoanAdvance(l.id, Math.round(num(d.monto)), 'Le presté más', str(d.fecha) ? dateOf(d.fecha) : undefined, str(d.cuenta) ? findAccount(d.cuenta) : undefined) },
  },

  /* ─── Deudas y presupuestos: eliminar ────────────────────────────────── */

  eliminar_deuda: {
    desc: 'Eliminar una deuda formal.',
    params: S.obj({ nombre: S.str('nombre de la deuda') }, ['nombre']),
    riesgo: 'borra',
    title: 'Eliminar deuda',
    cta: 'Eliminarla',
    done: 'Deuda eliminada',
    valid: (d) => Boolean(findDebt(str(d.nombre))),
    summary: (d) => { const x = findDebt(str(d.nombre)); return x ? `${x.name} · ${money(x.total)}` : `No encontré la deuda "${str(d.nombre)}"` },
    run: (d) => { const x = findDebt(str(d.nombre)); if (x) st().deleteDebt(x.id) },
  },

  eliminar_presupuesto: {
    desc: 'Eliminar un presupuesto.',
    params: S.obj({ nombre: S.str('nombre del presupuesto') }, ['nombre']),
    riesgo: 'borra',
    title: 'Eliminar presupuesto',
    cta: 'Eliminarlo',
    done: 'Presupuesto eliminado',
    valid: (d) => Boolean(findBudget(str(d.nombre))),
    summary: (d) => { const b = findBudget(str(d.nombre)); return b ? `${b.name} · ${money(b.amount)}` : `No encontré el presupuesto "${str(d.nombre)}"` },
    run: (d) => { const b = findBudget(str(d.nombre)); if (b) st().deleteBudget(b.id) },
  },

  /* ─── Categorías y tema ──────────────────────────────────────────────── */

  crear_categoria: {
    desc: 'Crear una categoría propia con ícono y color (ej. "Gimnasio", "Universidad").',
    params: S.obj({ name: S.str('nombre'), icono: S.str('id de ícono del catálogo: casa, luz, agua, wifi, celular, super, comida, cafe, carro, gasolina, bus, salud, gym, ropa, cine, juegos, regalo, bebe, mascota, educacion, banco, tarjeta, belleza, farmacia, libros, trabajo, seguro, deporte, ahorro…'), color: S.str('color hex, ej. #7c5cff'), tipo: S.enum('para qué sirve', ['gasto', 'ingreso', 'ambos']) }, ['name']),
    riesgo: 'crea',
    title: 'Nueva categoría',
    cta: 'Crearla',
    done: 'Categoría creada: la ves en Ajustes → Categorías',
    valid: (d) => str(d.name).length > 0,
    summary: (d) => `${str(d.name)}${str(d.icono) ? ` · ícono ${str(d.icono)}` : ''}${str(d.color) ? ` · color ${str(d.color)}` : ''}`,
    run: (d) => st().addCategory({
      name: str(d.name).slice(0, 30), icon: str(d.icono, 'efectivo'), color: /^#[0-9a-f]{6}$/i.test(str(d.color)) ? str(d.color) : undefined,
      kind: (['gasto', 'ingreso', 'ambos'] as const).find((k) => k === str(d.tipo)) ?? 'gasto', builtin: false,
    }),
  },

  cambiar_tema: {
    desc: 'Cambiar el tema de la app a claro u oscuro.',
    params: S.obj({ modo: S.enum('modo', ['light', 'dark']) }, ['modo']),
    riesgo: 'modifica',
    title: 'Cambiar tema',
    cta: 'Cambiarlo',
    done: 'Tema cambiado',
    valid: (d) => str(d.modo) === 'light' || str(d.modo) === 'dark',
    summary: (d) => `Modo ${str(d.modo) === 'dark' ? 'oscuro' : 'claro'}`,
    run: (d) => st().setTheme({ mode: str(d.modo) === 'dark' ? 'dark' : 'light' }),
  },

  /* ─── Navegación y búsqueda (se ejecutan solas, sin confirmar) ────────── */

  ir_a: {
    desc: 'LLEVAR al usuario a una pantalla de la app. Úsala cuando pregunte dónde está algo o pida ir a un módulo. El destino es el id del MAPA DE LA APP (ej. compras, tarjetas, medebo, ingresos).',
    params: S.obj({ destino: S.str('id del lugar del mapa de la app') }, ['destino']),
    riesgo: 'navegacion',
    title: 'Ir a',
    cta: 'Llevame',
    done: 'Listo, ahí lo tenés',
    valid: (d) => Boolean(APP_MAP.find((p) => p.id === str(d.destino)) ?? buscarLugar(str(d.destino), 1)[0]),
    summary: (d) => { const p = APP_MAP.find((x) => x.id === str(d.destino)) ?? buscarLugar(str(d.destino), 1)[0]; return p ? rutaDe(p) : str(d.destino) },
    run: (d) => {
      const p = APP_MAP.find((x) => x.id === str(d.destino)) ?? buscarLugar(str(d.destino), 1)[0]
      if (!p) return
      const s = st()
      if (s.subs[s.activeTab]) s.setSub(s.activeTab as TabId, '')
      s.setSub(p.tab, p.sub ?? '')
      s.setActiveTab(p.tab)
    },
  },

  buscar_en_la_app: {
    desc: 'Buscar en qué módulo de la app está una funcionalidad (por palabras). Devuelve la ruta para explicársela al usuario.',
    params: S.obj({ texto: S.str('qué busca el usuario') }, ['texto']),
    riesgo: 'lectura',
    title: 'Buscar en la app',
    cta: 'Buscar',
    done: 'Encontrado',
    valid: (d) => str(d.texto).length > 0,
    summary: (d) => buscarLugar(str(d.texto), 3).map(rutaDe).join(' · ') || 'No encontré ese módulo',
    run: () => { /* solo lectura: el resumen ya trae la ruta */ },
  },
}

export function actionSpec(tipo: string): ActionSpec | undefined {
  return ACTIONS[tipo]
}

/** ¿Se ejecuta sola, sin tarjeta de confirmación? */
export function isAutoAction(tipo: string): boolean {
  const r = ACTIONS[tipo]?.riesgo
  return r === 'lectura' || r === 'navegacion'
}

/** Declaraciones de función para Gemini: salen del catálogo, nunca a mano */
export function toolDeclarations(allowed?: (tipo: string) => boolean): GeminiFunctionDecl[] {
  return Object.entries(ACTIONS)
    .filter(([tipo]) => !allowed || allowed(tipo))
    .map(([tipo, spec]) => ({ name: tipo, description: spec.desc, parameters: spec.params }))
}

/** El catálogo en texto, para el prompt (respaldo si el modelo no llama funciones) */
export function catalogPrompt(): string {
  return Object.entries(ACTIONS)
    .map(([tipo, spec]) => {
      const props = (spec.params as { properties?: Record<string, { description?: string }> }).properties ?? {}
      const campos = Object.entries(props).map(([k, v]) => `${k}${v.description ? ` (${v.description})` : ''}`).join(', ')
      return `- ${tipo}: ${spec.desc} Datos: {${campos}}`
    })
    .join('\n')
}
