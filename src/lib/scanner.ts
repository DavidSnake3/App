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
