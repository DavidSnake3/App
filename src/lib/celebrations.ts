// Los estilos de la pantalla de "mes completado", para elegir en Ajustes.
import type { CelebrationStyle } from '../types/finance'

export const CELEBRATION_STYLES: { id: CelebrationStyle; label: string; desc: string }[] = [
  { id: 'estallido', label: 'Estallido', desc: 'Tarjeta con rebote, anillo que se dibuja y cañonazo de confeti' },
  { id: 'trofeo', label: 'Trofeo', desc: 'El trofeo cae, brilla y llueven monedas doradas' },
  { id: 'aurora', label: 'Aurora', desc: 'Ondas de color, sobria y elegante' },
  { id: 'fuegos', label: 'Fuegos artificiales', desc: 'Explosiones por toda la pantalla' },
  { id: 'racha', label: 'Racha', desc: 'El anillo se llena al 100 % y cuenta tus meses seguidos' },
]
