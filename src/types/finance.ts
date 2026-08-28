// ─────────────────────────────────────────────────────────────────────────────
// Modelo de datos — SNBusiness
// ─────────────────────────────────────────────────────────────────────────────

export type TabId = 'home' | 'month' | 'debts' | 'year' | 'settings'

/** Vistas configurables para el mes (punto 10) */
export type ViewMode = 'cards' | 'list' | 'table' | 'calendar' | 'gantt'

/** Recurrencia de un gasto (punto 8) */
export type Recurrence =
  | 'once'        // pago único / contado
  | 'weekly'      // semanal
  | 'biweekly'    // quincenal
  | 'monthly'     // mensual
  | 'bimonthly'   // cada 2 meses
  | 'quarterly'   // trimestral
  | 'semiannual'  // semestral
  | 'annual'      // anual

export type ExpenseKind = 'gasto' | 'servicio'

/** Quincena a la que pertenece el pago */
export type Period = 'q1' | 'q2'

/** Sub-hijos de un gasto, ej. "Diario" → tomate, arroz… (punto 3) */
export interface SubItem {
  id: string
  name: string
  amount: number
}

/** Preferencia de recordatorio por elemento (puntos 9 y 12) */
export interface ReminderPref {
  enabled: boolean
  daysBefore: number[]  // ej. [3, 1, 0]
  time: string          // "09:00"
  alarm: boolean        // modo alarma intrusiva
}

export interface Expense {
  id: string
  name: string
  amount: number
  paid: boolean
  paidAt?: string        // ISO fecha de pago
  dueDay?: number        // día del mes en que vence
  period: Period
  kind: ExpenseKind      // 'servicio' = servicio obligatorio (punto 7)
  recurrence: Recurrence
  children: SubItem[]    // sub-hijos (punto 3)
  note?: string
  reminder?: ReminderPref
  anchorMonthId?: string // mes donde se creó (para recurrencias > 1 mes)
  createdAt: string
}

export interface MonthlyIncome {
  salary: number
  additional: number
  additionalLabel: string
}

export interface MonthData {
  id: string   // 'yyyy-MM'
  year: number
  month: number // 1-12
  income: MonthlyIncome
  expenses: Expense[]
  celebrated: boolean // ya se mostró la felicitación de mes completado (punto 22)
}

/** Pago de una cuota de deuda en un mes concreto */
export interface DebtPayment {
  paid: boolean
  paidAt?: string
  amount: number
}

/** Deuda con cuotas o fecha de finalización (punto 4) */
export interface Debt {
  id: string
  name: string
  total: number            // monto total de la deuda
  monthlyPayment: number   // cuota mensual
  installments: number     // número de cuotas
  startMonthId: string     // 'yyyy-MM' primera cuota
  dueDay: number           // día del mes en que vence la cuota
  payments: Record<string, DebtPayment> // por monthId
  note?: string
  reminder?: ReminderPref
  createdAt: string
}

/** Elemento unificado que renderizan todas las vistas del mes */
export interface PayableItem {
  id: string
  source: 'expense' | 'debt'
  refId: string
  name: string
  amount: number
  paid: boolean
  paidAt?: string
  dueDay?: number
  period: Period
  kind: ExpenseKind | 'deuda'
  recurrence: Recurrence
  children: SubItem[]
  /** progreso de la deuda: cuota n de m */
  debtProgress?: { current: number; total: number; remaining: number }
}

export type UrgencyLevel = 'paid' | 'ok' | 'soon' | 'urgent' | 'overdue'

export interface Urgency {
  level: UrgencyLevel
  /** 0 = lejos del vencimiento, 1 = vence hoy / vencido */
  t: number
  daysLeft: number | null
}

// ─── Perfil y configuración ──────────────────────────────────────────────────

export interface UserProfile {
  name: string
  email: string
  phone: string
  currency: string               // 'CRC' | 'USD' | 'EUR' | 'MXN' | …
  payday: number                 // día de pago principal
  payFrequency: 'monthly' | 'biweekly'
  planMode: 'monthly' | 'annual' // elección del onboarding (punto 24)
  onboarded: boolean
}

export interface ThemeSettings {
  mode: 'dark' | 'light'
  paletteId: string
  accent?: string // color de acento personalizado (hex)
  background: {
    type: 'default' | 'color' | 'gradient' | 'image'
    value: string
  }
}

/** Qué animaciones prefiere el usuario (punto 25) */
export interface AnimationPrefs {
  confetti: boolean
  cash: boolean
  sounds: boolean
  haptics: boolean
  transitions: boolean
  celebration: boolean
}

export interface NotificationPrefs {
  enabled: boolean
  daysBefore: number[]
  time: string       // "09:00"
  alarmMode: boolean // alarmas intrusivas por defecto (punto 12)
}

export interface AppSettings {
  defaultSalary: number
  viewMode: ViewMode
  theme: ThemeSettings
  animations: AnimationPrefs
  notifications: NotificationPrefs
  aiEnabled: boolean
  geminiKey: string      // clave en runtime (si vacía usa la de compilación)
  autoRollover: boolean  // generar mes automáticamente (punto 1)
  planChoice: string     // plan de pago elegido ('propio' por defecto, punto 14)
}

// ─── Proyecciones (punto 13) ─────────────────────────────────────────────────

export interface ProjectedMonth {
  monthId: string
  month: number
  label: string
  income: number
  expenses: number
  savings: number
  isActual: boolean
}

export interface AnnualProjection {
  months: ProjectedMonth[]
  totalIncome: number
  totalExpenses: number
  totalSavings: number
}

// ─── Planes de pago (puntos 6 y 14) ─────────────────────────────────────────

export interface PlanStep {
  name: string
  amount: number
  day: number
  detail?: string
}

export interface PaymentPlan {
  id: string
  nombre: string
  descripcion: string
  pasos: PlanStep[]
  ventajas: string[]
  duracionMeses?: number
  esIA?: boolean
}

// ─── Alarmas en la app (punto 12) ────────────────────────────────────────────

export interface PendingAlarm {
  id: string
  title: string
  body: string
  fireAt: number
  itemName: string
  amount: number
}
