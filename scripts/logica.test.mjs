import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aEuros, cierresDiarios } from './precios.mjs'
import { categorizar, normalizarComercio, parseImporte } from '../supabase/functions/_shared/gastos.ts'
import { valorar } from '../src/lib/cartera.ts'

test('parseImporte entiende los formatos que manda el iPhone', () => {
  assert.equal(parseImporte('23,50 €'), 23.5)
  assert.equal(parseImporte('€1.234,56'), 1234.56)
  assert.equal(parseImporte('1,234.56'), 1234.56)
  assert.equal(parseImporte('12.99'), 12.99)
  assert.equal(parseImporte('1.234'), 1234)
  assert.equal(parseImporte('-4,20 €'), 4.2)
  assert.equal(parseImporte(7), 7)
  assert.ok(Number.isNaN(parseImporte('gratis')))
})

test('categorizar usa primero las reglas del usuario y luego las palabras clave', () => {
  assert.equal(categorizar('MERCADONA 1234 MADRID'), 'Supermercado')
  assert.equal(categorizar('Uber *Trip'), 'Transporte')
  assert.equal(categorizar('Uber Eats'), 'Restaurantes')
  assert.equal(categorizar('NETFLIX.COM'), 'Suscripciones')
  assert.equal(categorizar('Bar Manolo'), 'Restaurantes')
  assert.equal(categorizar('Comercio desconocido SL'), null)
  const reglas = [{ comercio_norm: normalizarComercio('Mercadona'), categoria: 'Hogar' }]
  assert.equal(categorizar('MERCADONA 1234 MADRID', reglas), 'Hogar')
})

test('cierresDiarios y aEuros convierten un chart de Yahoo en cierres en euros', () => {
  const chart = { chart: { result: [{ meta: { currency: 'USD', gmtoffset: -14400 }, timestamp: [1793030400, 1793116800], indicators: { quote: [{ close: [100, null] }] } }] } }
  const { currency, closes } = cierresDiarios(chart)
  assert.equal(currency, 'USD')
  assert.equal(closes.size, 1)
  const fecha = [...closes.keys()][0]
  const fx = new Map([['2026-01-01', 0.9]])
  assert.equal(aEuros(closes, 'USD', fx).get(fecha), 90)
})

test('valorar calcula participaciones con el precio del día de cada aportación', () => {
  const activos = [
    { id: 'a', nombre: 'ETF', tipo: 'ETF', ticker: 'EUNL.DE', valor_actual: null, valor_fecha: null },
    { id: 'b', nombre: 'Cuenta', tipo: 'Efectivo', ticker: null, valor_actual: 510, valor_fecha: '2026-10-27' },
  ]
  const aportaciones = [
    { id: '1', activo_id: 'a', importe: 100, fecha: '2026-10-01' },
    { id: '2', activo_id: 'a', importe: 100, fecha: '2026-10-03' },
    { id: '3', activo_id: 'b', importe: 500, fecha: '2026-10-01' },
  ]
  const precios = [
    { activo_id: 'a', fecha: '2026-10-01', cierre_eur: 50 },
    { activo_id: 'a', fecha: '2026-10-02', cierre_eur: 100 },
    { activo_id: 'a', fecha: '2026-10-24', cierre_eur: 80 },
  ]
  const [cuenta, etf] = valorar(activos, aportaciones, precios)
  // 100/50 + 100/100 (el 3 no cotizó: se usa el 2) = 3 participaciones × 80
  assert.equal(etf.participaciones, 3)
  assert.equal(etf.valor, 240)
  assert.equal(cuenta.valor, 510)
  assert.equal(cuenta.conPrecio, true)
})

test('valorar usa las participaciones de una posición inicial cuando se conocen', () => {
  const activos = [{ id: 'a', nombre: 'ETF', tipo: 'ETF', ticker: 'EUNL.DE', valor_actual: null, valor_fecha: null }]
  const aportaciones = [
    { id: '1', activo_id: 'a', importe: 1000, fecha: '2024-01-01', tipo: 'inicial', participaciones: 12.5 },
    { id: '2', activo_id: 'a', importe: 100, fecha: '2026-10-01', tipo: 'aportacion', participaciones: null },
  ]
  const precios = [
    { activo_id: 'a', fecha: '2026-10-01', cierre_eur: 100 },
    { activo_id: 'a', fecha: '2026-10-24', cierre_eur: 110 },
  ]
  const [etf] = valorar(activos, aportaciones, precios)
  assert.equal(etf.participaciones, 13.5)
  assert.equal(etf.neto, 1100)
  assert.equal(Math.round(etf.valor * 100) / 100, 1485)
})
