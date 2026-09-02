// ─────────────────────────────────────────────────────────────────────────────
// Modelo de datos — SNFinance
// ─────────────────────────────────────────────────────────────────────────────

export type TabId = 'home' | 'money' | 'month' | 'reports' | 'settings'

/** Submenú activo dentro de cada hub (navegación de 2 niveles) */
export type MoneySub = 'cuentas' | 'movimientos' | 'tarjetas' | 'ahorros' | 'prestamos' | 'medebo'
export type MonthSub = 'pagos' | 'deudas' | 'compras' | 'presupuestos' | 'plan'
export type ReportsSub = 'ano' | 'categorias' | 'reporte'

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


/** Preferencia de recordatorio por elemento (puntos 9 y 12) */
export interface ReminderPref {
  enabled: boolean
  daysBefore: number[]  // ej. [3, 1, 0]
  time: string          // "09:00"
  alarm: boolean        // modo alarma intrusiva
}

/**
 * ADELANTO de un pago del mes: plata que ya abonaste ANTES de marcarlo pagado.
 * Ej. el recibo es de 30.000 y vence el 15, pero el 10 adelantás 15.000.
 * Cada adelanto es plata real: siempre nace con su propio movimiento.
 */
export interface ExpenseAdvance {
  id: string
  /** siempre positivo */
  amount: number
  /** 'yyyy-MM-dd': define en qué mes cae el movimiento */
  dateISO: string
  /** cuenta de la que sale (si es tarjeta, sube su deuda) */
  accountId?: string
  /** movimiento que generó, para poder revertirlo */
  movementId?: string
  note?: string
  createdAt: string
}

/** Un producto dentro de una lista de compras */
export interface ShoppingProduct {
  id: string
  name: string
  /** precio unitario */
  price: number
  qty: number
  /** ya lo eché al carrito */
  checked: boolean
  checkedAt?: string
  note?: string
}

/**
 * Contenido de una lista de compras. El gasto que la contiene es el que sale
 * en "Pagos del mes". Mientras `done` es false el gasto vale la suma de TODOS
 * los productos (lo planeado); al cerrarla vale solo lo marcado, y ese es el
 * monto del movimiento real.
 */
export interface ShoppingList {
  items: ShoppingProduct[]
  done: boolean
  doneAt?: string
  /** dónde se compra: Automercado, Palí… (informativo) */
  store?: string
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
  /** abonos parciales hechos antes de pagarlo del todo */
  advances?: ExpenseAdvance[]
  /** si el gasto es una lista de compras, aquí van sus productos */
  shopping?: ShoppingList
  note?: string
  icon?: string          // ícono elegido por el usuario (punto: iconos)
  /** color propio del pago (si no, usa el de su tipo o su categoría) */
  color?: string
  /** presupuesto al que se carga este pago (opcional) */
  budgetId?: string
  /** cuenta con la que se paga (si es tarjeta de crédito, se vuelve deuda) */
  accountId?: string
  /** categoría del movimiento (para los reportes por tipo) */
  categoryId?: string
  reminder?: ReminderPref
  anchorMonthId?: string // mes donde se creó (para recurrencias > 1 mes)
  /** plantilla de pago fijo que lo generó (si viene de una) */
  templateId?: string
  /** movimiento que se creó al marcarlo pagado (historial y saldo de cuenta) */
  movementId?: string
  createdAt: string
}

/**
 * Pago FIJO: lo que sale sí o sí cada mes (alquiler, luz, internet, cuotas…).
 * De aquí nacen solos los pagos de cada mes nuevo; se administran en
 * Ajustes → Ingresos y planilla → Pagos fijos.
 */
export interface RecurringTemplate {
  id: string
  name: string
  amount: number
  kind: ExpenseKind
  /** día del mes en que vence */
  dueDay?: number
  /** cada cuánto se repite */
  recurrence: Recurrence
  /** desde qué mes aplica ('yyyy-MM') */
  anchorMonthId: string
  /** hasta qué mes (opcional: para los que terminan) */
  endMonthId?: string
  icon?: string
  note?: string
  /** cuenta con la que se paga */
  accountId?: string
  categoryId?: string
  budgetId?: string
  reminder?: ReminderPref
  /** pausado = no se crea en los meses nuevos, pero no se pierde */
  active: boolean
  createdAt: string
}

export interface MonthlyIncome {
  salary: number
  additional: number
  additionalLabel: string
}

/** Gasto hormiga: salida pequeña anotada al instante (café, uber, snack…) */
export interface AntExpense {
  id: string
  name: string
  amount: number
  dateISO: string // 'yyyy-MM-dd'
  /** presupuesto al que se carga (opcional) */
  budgetId?: string
}

// ─── Cuentas contables (bancos, efectivo, tarjetas) ──────────────────────────

/**
 * Tipo de cuenta. Las de crédito NO son efectivo: lo que se gasta con ellas
 * se convierte en deuda con fecha de corte, fecha de pago e interés.
 */
export type AccountType = 'efectivo' | 'corriente' | 'ahorros' | 'credito' | 'inversion'

/** Condiciones de una tarjeta de crédito */
export interface CreditInfo {
  /** límite de la tarjeta (0 = sin límite definido) */
  limit: number
  /** día del mes en que cierra el estado de cuenta */
  cutoffDay: number
  /** día del mes en que hay que pagar */
  dueDay: number
  /** interés que cobran */
  rate: number
  /** el interés está expresado por año o por mes */
  ratePeriod: 'annual' | 'monthly'
  /** saldo que ya tenía la tarjeta al registrarla (deuda arrastrada) */
  openingDebt?: number

  // ── Pago mínimo y mora (lo que cobra el banco si no pagas de contado) ──
  /**
   * Cómo calcula tu banco el pago mínimo:
   *  · 'plazo' (Costa Rica, Decreto 35867-MEIC): saldo del principal ÷ plazo
   *    de financiamiento + los intereses del período. El plazo típico es 60 meses.
   *  · 'porcentaje' (México, Chile, Perú y otros): un % del saldo + intereses.
   */
  minMode?: 'plazo' | 'porcentaje'
  /** meses del plazo de financiamiento (modo 'plazo'; típico 60) */
  financingMonths?: number
  /** % del saldo que pide como mínimo (modo 'porcentaje'; típico 5%) */
  minPaymentPct?: number
  /** monto mínimo absoluto del pago mínimo (si el % da menos que esto) */
  minPaymentFloor?: number
  /** puntos porcentuales que se suman al interés corriente por mora (CR: 2) */
  moratoryExtra?: number
  /** % del monto en mora que cobran por gestión de cobranza */
  lateFeePct?: number
  /** tope de ese cargo por cobranza (0 = sin tope) */
  lateFeeCap?: number
  /** desde qué día de atraso se cobra el cargo por cobranza (CR: 5) */
  lateFeeAfterDays?: number
  /** comisión por retirar efectivo con la tarjeta, en % */
  cashAdvanceFeePct?: number
  /**
   * Día límite para el PAGO MÍNIMO, si tu banco te da más días que para el
   * pago de contado (BCR: contado a 15 días del corte, mínimo a 29).
   */
  minDueDay?: number
}

export interface Account {
  id: string
  name: string
  type: AccountType
  icon?: string
  /** cómo se ve: tarjeta azul, monedero, efectivo… (ver lib/accountLooks) */
  look?: string
  /** red de la tarjeta, solo el nombre: Visa, Mastercard… */
  network?: string
  /** color del acento de la tarjeta/cuenta */
  color?: string
  /** moneda de la cuenta (por defecto, la del perfil) */
  currency?: string
  /** cuánto tenía la cuenta al empezar a llevarla en la app */
  openingBalance: number
  /** fecha de ese saldo inicial ('yyyy-MM-dd') */
  openingISO: string
  /** cuenta para el total de efectivo real */
  includeInTotal: boolean
  /**
   * Cuenta principal: es donde cae el salario y de donde salen los pagos que
   * no tienen cuenta asignada. Solo una cuenta puede ser la principal.
   */
  isMain?: boolean
  /** flujo ya contado al fijar el saldo (evita contar dos veces el mismo mes) */
  flowSnapshot?: number
  /** condiciones si es tarjeta de crédito */
  credit?: CreditInfo
  archived?: boolean
  note?: string
  createdAt: string
}

// ─── Movimientos del mes (antes "gastos hormiga") ────────────────────────────

/** Qué hace el movimiento con el dinero */
export type MovementKind = 'gasto' | 'ingreso' | 'transferencia'

/**
 * Movimiento del mes: cada entrada o salida real de dinero, con su categoría,
 * su ícono, la cuenta que usó y la fecha en que ocurrió.
 */
export interface Movement {
  id: string
  name: string
  /** siempre positivo: el signo lo define `kind` */
  amount: number
  kind: MovementKind
  /** categoría del catálogo (define ícono y color por defecto) */
  categoryId: string
  /** ícono propio, si el usuario eligió uno distinto al de la categoría */
  icon?: string
  /** cuenta de origen (de dónde salió / a dónde entró) */
  accountId: string
  /** cuenta de destino en transferencias (ej. pagar la tarjeta) */
  toAccountId?: string
  /** 'yyyy-MM-dd' del día en que se hizo */
  dateISO: string
  note?: string
  /** presupuesto al que se carga */
  budgetId?: string
  /** cuota de una compra a plazos */
  installmentId?: string
  createdAt: string
}

/** Categoría de movimiento, con ícono elegible */
export interface Category {
  id: string
  name: string
  /** id del catálogo de íconos (lib/icons) */
  icon: string
  /** sirve para gastos, para ingresos o para ambos */
  kind: 'gasto' | 'ingreso' | 'ambos'
  color?: string
  /** viene con la app (no se puede borrar, solo ocultar) */
  builtin?: boolean
  hidden?: boolean
}

// ─── Compras a cuotas con tarjeta de crédito ─────────────────────────────────

/** Cuota pagada de una compra a plazos */
export interface InstallmentPayment {
  paid: boolean
  paidAt?: string
  amount: number
}

/**
 * Compra a cuotas con tarjeta: un nombre para identificarla, la mensualidad,
 * cuántas cuotas y desde cuándo se paga. Cada cuota es deuda de la tarjeta.
 */
export interface Installment {
  id: string
  /** nombre para identificarla (ej. "Refrigeradora Gollo") */
  name: string
  /** tarjeta con la que se compró */
  accountId: string
  /** monto total de la compra (0 si solo se conoce la mensualidad) */
  total: number
  /** mensualidad de cada cuota */
  monthly: number
  /** cuántas cuotas son */
  count: number
  /** día del mes en que se paga la cuota */
  dueDay: number
  /** mes de la primera cuota ('yyyy-MM') */
  startMonthId: string
  /** cuotas pagadas, por mes */
  payments: Record<string, InstallmentPayment>
  icon?: string
  categoryId?: string
  note?: string
  createdAt: string
}

export interface MonthData {
  id: string   // 'yyyy-MM'
  year: number
  month: number // 1-12
  income: MonthlyIncome
  expenses: Expense[]
  /** LEGADO: gastos hormiga (migrados a `movements` en la v9) */
  hormigas?: AntExpense[]
  /** movimientos del mes: todo lo que entra y sale, con categoría y cuenta */
  movements?: Movement[]
  celebrated: boolean // ya se mostró la felicitación de mes completado (punto 22)
  /** ya se preguntó si copiar los recurrentes del mes anterior */
  carryAsked?: boolean
  /** pagos fijos que el usuario quitó SOLO en este mes (ids de plantilla) */
  skipTemplates?: string[]
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
  /** cuenta con la que se pagó la cuota */
  accountId?: string
  /** movimiento que se creó al marcarla pagada */
  movementId?: string
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
  /** color propio de la deuda */
  color?: string
  /** categoría con la que entra a los reportes */
  categoryId?: string
  /** cuenta o referencia (ej. "CUENTA: 90301-0") para el estado de cuenta */
  account?: string
  /** método de pago habitual (ej. "Ventanilla GOLLO", "SINPE", "Débito") */
  payMethod?: string
  /** la cuota se deduce automáticamente de la planilla (no aparece en el mes) */
  viaPlanilla?: boolean
  reminder?: ReminderPref
  createdAt: string
}

/** Abono que me hizo la persona a la que le presté */
export interface LoanPayment {
  id: string
  amount: number
  dateISO: string
  note?: string
  /** movimiento que generó este abono (para no contarlo dos veces) */
  movementId?: string
  /** cuenta a la que entró la plata */
  accountId?: string
}

/** Plata que le presté DE NUEVO a la misma persona (aumenta lo que me debe) */
export interface LoanAdvance {
  id: string
  amount: number
  dateISO: string
  note?: string
  /** movimiento que generó este préstamo extra */
  movementId?: string
  /** cuenta de la que salió la plata */
  accountId?: string
}

/**
 * Préstamo PROPIO: plata que le presté a alguien. Es una cuenta por cobrar:
 * cuánto le presté, desde cuándo y qué me ha ido abonando.
 */
/**
 * Dirección del préstamo informal:
 * - `lent`: yo le presté a alguien (me deben)
 * - `borrowed`: alguien me prestó a mí (yo debo)
 */
export type LoanKind = 'lent' | 'borrowed'

export interface Loan {
  id: string
  /** hacia dónde va el préstamo (si falta, es de los viejos: le presté) */
  kind?: LoanKind
  /** a quién le presté / quién me prestó */
  person: string
  phone?: string
  /** cuánto le presté en total */
  amount: number
  /** desde cuándo me debe */
  dateISO: string
  /** fecha en que quedó de pagar (opcional) */
  dueDateISO?: string
  note?: string
  payments: LoanPayment[]
  /** veces que le volví a prestar (cada una con su fecha) */
  advances?: LoanAdvance[]
  /** movimiento del préstamo inicial */
  movementId?: string
  /** cuenta de la que salió el préstamo inicial */
  accountId?: string
  createdAt: string
}

/** Movimiento anotado dentro de un presupuesto */
export interface BudgetEntry {
  id: string
  amount: number
  note?: string
  dateISO: string
}

/**
 * Presupuesto propio: un límite de gasto que el usuario define (ej. "Comida
 * de la U: 30 000 al mes") y va anotando lo que gasta ahí.
 */
export interface Budget {
  id: string
  name: string
  /** límite del período */
  amount: number
  period: 'weekly' | 'monthly'
  icon?: string
  entries: BudgetEntry[]
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
  icon?: string
  /** cuenta con la que se paga (tarjeta = se vuelve deuda) */
  accountId?: string
  /** color propio del pago */
  color?: string
  /** pago fijo del que viene (sale en todos los meses) */
  templateId?: string
  /** ya adelantado (abonos parciales); 0 en cuotas de deuda */
  advanced: number
  /** lo que falta por pagar; 0 si ya está pagado */
  remaining: number
  /** resumen en vivo si el pago es una lista de compras */
  shopping?: {
    count: number
    checkedCount: number
    /** suma de todos los productos (lo planeado) */
    total: number
    /** suma de lo marcado (lo que llevo) */
    checkedTotal: number
    done: boolean
  }
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

/**
 * Cómo recibe su dinero el usuario. Define si la app calcula deducciones de
 * planilla o si es un control simple de lo que entra.
 */
export type WorkerType = 'asalariado' | 'independiente' | 'ambos' | 'pensionado' | 'sinIngreso'

export interface UserProfile {
  name: string
  /** asalariado, independiente, ambos, pensionado o sin ingreso fijo */
  workerType?: WorkerType
  /** apellido (se muestra junto al nombre bajo la foto) */
  lastName?: string
  email: string
  phone: string
  photoUrl: string               // foto de la cuenta (Google)
  currency: string               // 'CRC' | 'USD' | 'EUR' | 'MXN' | …
  /** región para formato de números y fechas (ej. 'es-CR', 'en-US') */
  locale?: string
  /** segunda moneda opcional para ver equivalentes */
  secondCurrency?: string
  /** cuántas unidades de la segunda moneda equivalen a 1 de la principal */
  exchangeRate?: number
  payday: number                 // día de pago principal
  payFrequency: 'monthly' | 'biweekly'
  planMode: 'monthly' | 'annual' // elección del onboarding (punto 24)
  onboarded: boolean
  /** ya vio (o rechazó) el recorrido de bienvenida */
  tourDone: boolean
  /**
   * Bienvenida de Snake al terminar el onboarding:
   * 'plan' / 'comprobante' = pendiente de abrirse con esa intención,
   * 'done' = ya se mostró, 'skipped' = el usuario prefirió configurarlo después.
   */
  snakeIntro: 'plan' | 'comprobante' | 'done' | 'skipped'
  /** ya vio el aviso de que el inicio se personaliza con widgets */
  widgetsTip?: boolean
  /** plan de Snake: 'gratis' | 'plus' | 'premium' */
  snakePlan?: string
}

/**
 * Consumo de Snake. Los tokens son los REALES que reporta Gemini
 * (usageMetadata), no estimaciones.
 */
export interface UsageState {
  /** 'yyyy-MM-dd' del día que se está contando */
  dayKey: string
  msgs: number
  tokens: number
  attachments: number
  /** 'yyyy-MM' del mes que se está contando */
  monthKey: string
  monthMsgs: number
  monthTokens: number
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
  | 'dona'        // dona: distribución de gastos por tipo
  | 'pilares'     // pilares: ingresos vs gastos por mes
  | 'saldo'       // saldo real: lo que tienes en el banco ahora
  | 'cuentas'     // efectivo real por cuenta (efectivo, banco, ahorros)
  | 'tarjetas'    // tarjetas de crédito: deuda y próxima fecha de pago
  | 'movimientos' // últimos movimientos del mes (lo que entró y salió)
  | 'divisas'     // tipo de cambio del dólar, euro y otras monedas

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
/** Cómo se celebra el mes completado */
export type CelebrationStyle = 'estallido' | 'trofeo' | 'aurora' | 'fuegos' | 'racha'

/** Cómo entra cada pantalla al cambiar de pestaña */
export type TransitionStyle =
  | 'deslizar' | 'desvanecer' | 'zoom' | 'subir' | 'voltear' | 'ninguna'

export interface AnimationPrefs {
  confetti: boolean
  cash: boolean
  sounds: boolean
  haptics: boolean
  transitions: boolean
  celebration: boolean
  paySound: PaySoundId
  alarmSound: AlarmSoundId
  /** estilo de la transición entre pestañas */
  transitionStyle?: TransitionStyle
  /** cuánto confeti: discreto, normal o fiesta */
  celebrationLevel?: 'suave' | 'normal' | 'fiesta'
  /** estilo de la pantalla de "mes completado" */
  celebrationStyle?: CelebrationStyle
}

// ─── Planilla / comprobante salarial ─────────────────────────────────────────

export interface PayrollDeduction {
  id: string
  name: string
  /** monto fijo del período (cuando `mode` es 'fixed') */
  amount: number
  /** cómo se calcula: un monto fijo o un porcentaje */
  mode?: 'fixed' | 'percent'
  /** porcentaje (cuando `mode` es 'percent'), ej. 45.11 */
  pct?: number
  /** sobre qué se calcula el porcentaje: el bruto o el neto */
  base?: 'gross' | 'net'
  /** deuda vinculada: se paga por planilla y no aparece en el mes */
  debtId?: string
  /**
   * Es un ADELANTO de salario (ej. pago de la 1ª quincena): la planilla lo
   * resta en la liquidación, pero NO es plata perdida — es parte de tu pago.
   */
  isAdvance?: boolean
  /** día del mes en que te depositan el adelanto */
  advanceDay?: number
  /** si ese día cae fin de semana: pagan antes, después o el día exacto */
  advanceAdjust?: 'before' | 'after' | 'none'
}

/**
 * Períodos de pago. `fortnightly` = cada 14 días (26 pagos al año, común en
 * EE. UU.), distinto de `biweekly` = quincenal (2 pagos al mes).
 */
export type PayPeriod = 'daily' | 'weekly' | 'fortnightly' | 'biweekly' | 'monthly'

/** Deducción de ley del empleado: seguro social, pensión, salud… (universal) */
export interface StatutoryDeduction {
  id: string
  name: string
  pct: number
  /** techo de cotización: solo se cobra sobre esta parte del bruto MENSUAL */
  cap?: number
  /** algunas deducciones de ley son un monto fijo, no un porcentaje */
  mode?: 'percent' | 'fixed'
  /** monto fijo MENSUAL (cuando `mode` es 'fixed') */
  amount?: number
}

/** Tramo del impuesto sobre la renta (sobre el ingreso MENSUAL gravable) */
export interface TaxBracket {
  /** hasta este ingreso mensual gravable; null = sin límite (último tramo) */
  upTo: number | null
  pct: number
}

/** Pago extraordinario: aguinaldo, 13.º, 14.º, prima, bono… */
export interface ExtraPay {
  id: string
  name: string
  /** mes en que se recibe (1-12) */
  month: number
  /** 'salary' = fracción de un salario mensual neto; 'fixed' = monto fijo */
  mode: 'salary' | 'fixed'
  /** fracción del salario (1 = un salario completo, 0.5 = 15 días) */
  factor: number
  amount: number
}

export interface PayrollConfig {
  /** país elegido (define el nombre y % de la deducción de ley por defecto) */
  countryId?: string
  /** nombre de la deducción de ley principal (legado; ver `statutory`) */
  statutoryName?: string
  /** deducciones de ley del país (una o varias, con techo opcional) */
  statutory?: StatutoryDeduction[]
  /** impuesto sobre la renta por tramos */
  taxEnabled?: boolean
  taxBrackets?: TaxBracket[]
  /** pagos extraordinarios del país (aguinaldo, 13.º, 14.º…) */
  extraPays?: ExtraPay[]
  /**
   * Período del comprobante REAL del usuario (mejora 9): los montos de
   * `gross` y `deductions` están expresados en este período.
   */
  inputPeriod: PayPeriod
  /** salario base bruto (por inputPeriod) */
  gross: number
  /** % de la deducción de ley del empleado (Costa Rica CCSS: 10.83) */
  ccssPct: number
  /** deducciones por inputPeriod */
  deductions: PayrollDeduction[]
  /** cómo prefiere ver el comprobante */
  viewPeriod: PayPeriod
}

/** Plan de pago del salario: cuándo y cuánto te llega */
export interface PaySchedule {
  frequency: PayPeriod
  /** fecha de referencia para pagos cada 14 días ('yyyy-MM-dd') */
  anchorISO?: string
  /** días del mes de pago (mensual: [30]; quincenal: [15, 30]) */
  paydays: number[]
  /** día de la semana para pago semanal (0=Lun … 6=Dom) */
  weekday: number
  /** si cae en fin de semana: pagar antes, después o dejar exacto */
  adjustWeekend: 'before' | 'after' | 'none'
}

// ─── Ahorro (dashboard) ──────────────────────────────────────────────────────

/** Aporte REAL al ahorro: mueve dinero del saldo real al fondo de ahorro */
export interface SavingsDeposit {
  id: string
  amount: number // negativo = retiro del ahorro
  dateISO: string
  note?: string
}

/** Sobre de ahorro: una meta con su propio dinero y sus aportes */
export interface SavingsEnvelope {
  id: string
  name: string
  /** meta del sobre (0 = sin meta) */
  goal: number
  /** dinero que YA tenía guardado antes de usar la app */
  initial: number
  /** aportes y retiros hechos desde la app */
  deposits: SavingsDeposit[]
  createdAt: string
}

export interface SavingsConfig {
  enabled: boolean
  mode: 'percent' | 'fixed'
  /** % del neto o monto fijo por mes */
  value: number
  /** meta total opcional */
  goal: number
  goalName: string
  /** aportes reales con fecha (legado: sobre único) */
  deposits: SavingsDeposit[]
  /** sobres de ahorro (cada uno con su meta y su dinero) */
  envelopes: SavingsEnvelope[]
}

// ─── Saldo real (control total del dinero, mejora del usuario) ───────────────

/**
 * El saldo real refleja lo que el usuario tiene EN EL BANCO ahora mismo:
 * parte de un monto base que él escribe y desde entonces la app suma lo que
 * le llega (quincenas) y resta lo que paga, los gastos hormiga y los aportes
 * al ahorro. El sobrante de cada mes se arrastra solo a los siguientes.
 */
export interface FundConfig {
  enabled: boolean
  /** cuánto tenía al activar/ajustar el control */
  baseAmount: number
  /** mes desde el que se cuenta el flujo */
  anchorMonthId: string
  /** flujo acumulado en el momento de fijar el saldo (para no contar doble) */
  snapshot: number
  setAtISO: string
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
  /** saldo real: control total del dinero en el banco */
  fund: FundConfig
  /** catálogo de categorías de movimientos (con íconos) */
  categories?: Category[]
  /** regla de reparto elegida (50/30/20, 70/20/10…) */
  financialPlanId?: string
  /** porcentajes personalizados del plan (si los cambió) */
  financialPlanCustom?: { key: string; pct: number }[]
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
