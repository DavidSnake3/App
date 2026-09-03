// Lector de códigos de barras y QR con la cámara del teléfono.
//
// Usa BarcodeDetector, que viene dentro del navegador de Android y lee todos
// los formatos de un súper (EAN-13 del producto, UPC, Code 128 de la góndola)
// y también QR. No hace falta ninguna librería extra ni conexión.

/** Formatos que intentamos leer: los de tienda primero */
export const FORMATOS = [
  'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93',
  'itf', 'codabar', 'qr_code', 'data_matrix', 'pdf417', 'aztec',
] as const

interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox?: DOMRectReadOnly
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?(): Promise<string[]>
}

function ctor(): BarcodeDetectorCtor | undefined {
  return (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
}

/** ¿Este teléfono puede leer códigos? */
export function scannerDisponible(): boolean {
  return Boolean(ctor()) && Boolean(navigator.mediaDevices?.getUserMedia)
}

/** Crea el lector con los formatos que el aparato soporte */
export async function crearLector(): Promise<BarcodeDetectorLike | null> {
  const C = ctor()
  if (!C) return null
  try {
    const soportados = C.getSupportedFormats ? await C.getSupportedFormats() : []
    const formats = soportados.length
      ? FORMATOS.filter((f) => soportados.includes(f))
      : [...FORMATOS]
    return new C(formats.length ? { formats } : undefined)
  } catch {
    try { return new C() } catch { return null }
  }
}

/**
 * Enciende la cámara de atrás. Devuelve el stream para pintarlo en un <video>.
 * Si el usuario no da permiso, lanza el error para poder explicárselo.
 */
export async function abrirCamara(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  })
}

/** Apaga la cámara: sin esto el LED se queda encendido */
export function cerrarCamara(stream: MediaStream | null | undefined): void {
  for (const t of stream?.getTracks() ?? []) t.stop()
}

/**
 * Un código EAN-13 trae su dígito de control. Verificarlo evita registrar
 * lecturas a medias cuando la cámara se movió.
 */
export function codigoValido(code: string): boolean {
  const limpio = code.trim()
  if (!/^\d{8}$|^\d{12,13}$/.test(limpio)) return true // QR y otros: se aceptan
  const digitos = limpio.split('').map(Number)
  const control = digitos.pop() as number
  let suma = 0
  // de derecha a izquierda, alternando ×3 y ×1
  for (let i = digitos.length - 1, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) {
    suma += digitos[i] * peso
  }
  return (10 - (suma % 10)) % 10 === control
}

/**
 * Busca el nombre del producto por su código.
 *
 * Pregunta a las bases abiertas de Open Food Facts (comida), Open Products
 * Facts (todo lo demás) y Open Beauty Facts (higiene). Solo se manda el código
 * de barras: ningún dato tuyo sale de aquí.
 *
 * Ojo: la cobertura de Centroamérica es floja, así que muchos productos de
 * pulpería o marca del súper no van a aparecer. No importa: lo escribís una
 * vez y la app ya lo recuerda para siempre (el catálogo local manda sobre
 * esto).
 */
const BASES = [
  'https://world.openfoodfacts.org',
  'https://world.openproductsfacts.org',
  'https://world.openbeautyfacts.org',
]

interface ProductoAbierto {
  product_name?: string
  product_name_es?: string
  brands?: string
  quantity?: string
}

function armarNombre(p: ProductoAbierto): string {
  const base = (p.product_name_es || p.product_name || '').trim()
  if (!base) return ''
  // "Leche Dos Pinos 1 L": marca delante y contenido detrás, si vienen
  const marca = (p.brands || '').split(',')[0]?.trim()
  const partes = [base]
  if (marca && !base.toLowerCase().includes(marca.toLowerCase())) partes.unshift(marca)
  if (p.quantity?.trim()) partes.push(p.quantity.trim())
  return partes.join(' ').slice(0, 60)
}

export async function buscarNombre(barcode: string, señal?: AbortSignal): Promise<string> {
  const code = barcode.trim()
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return '' // los QR no son productos

  for (const base of BASES) {
    if (señal?.aborted) return ''
    try {
      const r = await fetch(
        `${base}/api/v2/product/${code}.json?fields=product_name,product_name_es,brands,quantity`,
        { signal: señal, headers: { Accept: 'application/json' } },
      )
      if (!r.ok) continue
      const j = await r.json() as { status?: number; product?: ProductoAbierto }
      const nombre = j.product ? armarNombre(j.product) : ''
      if (nombre) return nombre
    } catch {
      // sin internet o consulta cancelada: se prueba la siguiente
    }
  }
  return '' // no está en ninguna: se escribe a mano y queda guardado
}
