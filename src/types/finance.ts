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

export type ExpenseKind = 'gasto' | 'servicio' | 'personal'

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
  icon?: string          // ícono elegido por el usuario (punto: iconos)
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
  /** ya se preguntó si copiar los recurrentes del mes anterior */
  carryAsked?: boolean
}

/** Pago de una cuota de deuda en un mes concreto (recibo estilo abono) */
export interface DebtPayment {
  paid: boolean
  paidAt?: string
  amount: number
  /** desglose opcional del abono, como en el recibo: capital + intereses */
  capital?: number
  interest?: number
  receiptNo?: string
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
  icon?: string
  /** cuenta o referencia (ej. "CUENTA: 90301-0") para el estado de cuenta */
  account?: string
  /** método de pago habitual (ej. "Ventanilla GOLLO", "SINPE", "Débito") */
  payMethod?: string
  /** la cuota se deduce automáticamente de la planilla (no aparece en el mes) */
  viaPlanilla?: boolean
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
  icon?: string
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
  photoUrl: string               // foto de la cuenta (Google)
  currency: string               // 'CRC' | 'USD' | 'EUR' | 'MXN' | …
  payday: number                 // día de pago principal
  payFrequency: 'monthly' | 'biweekly'
  planMode: 'monthly' | 'annual' // elección del onboarding (punto 24)
  onboarded: boolean
}

// ─── Widgets del inicio (personalizables) ────────────────────────────────────

export type WidgetId =
  | 'estado'      // progreso y balance del mes
  | 'resumen'     // tu día en pagos
  | 'consejo'     // consejo IA del día
  | 'acciones'    // accesos rápidos
  | 'pendientes'  // próximos pagos
  | 'proyeccion'  // gráfica de proyección anual
  | 'flujo'       // flujo del mes (línea P/G)
  | 'deudas'      // resumen de deudas
  | 'calendario'  // mini calendario del mes
  | 'comprobante' // comprobante salarial (planilla)
  | 'ahorro'      // panel de ahorro

export type WidgetSize = 'sm' | 'lg' | 'xl'

export interface WidgetConf {
  id: WidgetId
  /** sm = media pantalla, lg = ancho completo, xl = ancho completo expandido */
  size: WidgetSize
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

export type PaySoundId = 'ding' | 'caja' | 'monedas'
export type AlarmSoundId = 'clasica' | 'digital' | 'suave'

/** Qué animaciones prefiere el usuario (punto 25) */
export interface AnimationPrefs {
  confetti: boolean
  cash: boolean
  sounds: boolean
  haptics: boolean
  transitions: boolean
  celebration: boolean
  paySound: PaySoundId
  alarmSound: AlarmSoundId
}

// ─── Planilla / comprobante salarial ─────────────────────────────────────────

export interface PayrollDeduction {
  id: string
  name: string
  amount: number
  /** deuda vinculada: se paga por planilla y no aparece en el mes */
  debtId?: string
  /**
   * Es un ADELANTO de salario (ej. pago de la 1ª quincena): la planilla lo
   * resta en la liquidación, pero NO es plata perdida — es parte de tu pago.
   */
  isAdvance?: boolean
}

export interface PayrollConfig {
  /** salario base bruto mensual */
  gross: number
  /** % de CCSS del empleado (Costa Rica: 10.83 por defecto) */
  ccssPct: number
  deductions: PayrollDeduction[]
  /** cómo prefiere ver el comprobante */
  viewPeriod: 'weekly' | 'biweekly' | 'monthly'
}

/** Plan de pago del salario: cuándo y cuánto te llega */
export interface PaySchedule {
  frequency: 'weekly' | 'biweekly' | 'monthly'
  /** días del mes de pago (mensual: [30]; quincenal: [15, 30]) */
  paydays: number[]
  /** día de la semana para pago semanal (0=Lun … 6=Dom) */
  weekday: number
  /** si cae en fin de semana: pagar antes, después o dejar exacto */
  adjustWeekend: 'before' | 'after' | 'none'
}

// ─── Ahorro (dashboard) ──────────────────────────────────────────────────────

export interface SavingsConfig {
  enabled: boolean
  mode: 'percent' | 'fixed'
  /** % del neto o monto fijo por mes */
  value: number
  /** meta total opcional */
  goal: number
  goalName: string
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
  /** al entrar a un mes nuevo se PREGUNTA si copiar (nunca se copia solo) */
  autoRollover: boolean
  planChoice: string     // plan de pago elegido ('propio' por defecto, punto 14)
  homeWidgets: WidgetConf[] // widgets del inicio: orden, tamaño y visibilidad
  payroll: PayrollConfig
  paySchedule: PaySchedule
  savings: SavingsConfig
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
