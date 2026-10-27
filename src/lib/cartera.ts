import type { Activo, Aportacion, Precio } from '../supabase'

export interface Posicion {
  activo: Activo
  neto: number            // € aportados menos retirados
  valor: number           // valor de hoy en €
  participaciones: number | null
  ultimoPrecio: Precio | null
  conPrecio: boolean      // false = el valor es lo aportado o el valor apuntado a mano
}

// Precio de cierre de ese día o, si no hay, el anterior más cercano; si la fecha es anterior a todos, el primero
function precioEn(precios: Precio[], fecha: string): number | null {
  if (!precios.length) return null
  let elegido = precios[0]
  for (const p of precios) {
    if (p.fecha <= fecha) elegido = p
    else break
  }
  return elegido.cierre_eur
}

// Participaciones de cada movimiento: las que dio el usuario (posición inicial) o importe / precio de ese día.
// Valor = participaciones × último precio
export function valorar(activos: Activo[], aportaciones: Aportacion[], precios: Precio[]): Posicion[] {
  const porActivo = new Map<string, Precio[]>()
  for (const p of precios) {
    const l = porActivo.get(p.activo_id) ?? []
    l.push(p)
    porActivo.set(p.activo_id, l)
  }
  for (const l of porActivo.values()) l.sort((a, b) => a.fecha.localeCompare(b.fecha))

  return activos
    .map(activo => {
      const movs = aportaciones.filter(a => a.activo_id === activo.id)
      const neto = movs.reduce((s, a) => s + a.importe, 0)
      const ps = porActivo.get(activo.id) ?? []
      if (activo.ticker && ps.length) {
        const participaciones = movs.reduce(
          (s, a) => s + (a.participaciones != null ? Math.sign(a.importe) * a.participaciones : a.importe / (precioEn(ps, a.fecha) as number)),
          0,
        )
        const ultimo = ps[ps.length - 1]
        return { activo, neto, participaciones, ultimoPrecio: ultimo, valor: participaciones * ultimo.cierre_eur, conPrecio: true }
      }
      const manual = activo.valor_actual
      return { activo, neto, participaciones: null, ultimoPrecio: null, valor: manual ?? neto, conPrecio: manual != null }
    })
    .filter(p => p.neto !== 0 || p.valor !== 0)
    .sort((a, b) => b.valor - a.valor)
}
