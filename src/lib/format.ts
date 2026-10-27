export const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
export const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const pct = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 })
export const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + eur.format(Math.abs(n))

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Mes como "2026-10"
export const mesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const mesNombre = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
export const mesCorto = (m: string) => MESES_CORTOS[Number(m.slice(5, 7)) - 1]
export function sumarMeses(m: string, n: number): string {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)
  return mesDe(d)
}

export const hoyISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export const fechaCorta = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
