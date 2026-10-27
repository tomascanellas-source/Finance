// Trae el precio de cierre diario de cada activo con símbolo (Yahoo Finance), lo pasa a euros
// y lo guarda en la tabla `precios`. Lo ejecuta GitHub Actions cada día laborable tras el cierre.
//
// Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.

const URL_BASE = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const UA = { 'user-agent': 'Mozilla/5.0 (finance-app price sync)' }

// Respuesta de /v8/finance/chart -> { currency, closes: Map<'YYYY-MM-DD', number> } en la fecha local del mercado
export function cierresDiarios(chart) {
  const r = chart?.chart?.result?.[0]
  if (!r) throw new Error(chart?.chart?.error?.description ?? 'Respuesta vacía de Yahoo')
  const offset = r.meta?.gmtoffset ?? 0
  const ts = r.timestamp ?? []
  const close = r.indicators?.quote?.[0]?.close ?? []
  const closes = new Map()
  ts.forEach((t, i) => {
    const c = close[i]
    if (typeof c === 'number' && Number.isFinite(c)) closes.set(new Date((t + offset) * 1000).toISOString().slice(0, 10), c)
  })
  return { currency: r.meta?.currency ?? 'EUR', closes }
}

// Convierte cada cierre con el tipo de cambio de ese día (o el anterior disponible)
export function aEuros(closes, currency, fx) {
  if (currency === 'EUR') return closes
  const pence = currency === 'GBp' || currency === 'GBX'
  const fechasFx = [...fx.keys()].sort()
  const out = new Map()
  for (const [fecha, c] of closes) {
    let tasa
    for (const f of fechasFx) { if (f <= fecha) tasa = fx.get(f); else break }
    tasa ??= fx.get(fechasFx[0])
    if (tasa) out.set(fecha, (pence ? c / 100 : c) * tasa)
  }
  return out
}

async function yahoo(symbol, desde) {
  const p1 = Math.floor(Date.parse(desde) / 1000)
  const p2 = Math.floor(Date.now() / 1000) + 86400
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`)
  return cierresDiarios(await res.json())
}

async function db(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(`Supabase ${path}: HTTP ${res.status} ${await res.text()}`)
  return res.status === 204 || init.method === 'POST' ? null : res.json()
}

async function main() {
  if (!URL_BASE || !KEY) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  const activos = await db('activos?select=id,ticker&ticker=not.is.null')
  const aportes = await db('aportaciones?select=activo_id,fecha&order=fecha.asc')
  const ultimos = await db('precios?select=activo_id,fecha&order=fecha.desc&limit=10000')

  const hace10 = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10)
  let fallos = 0
  for (const a of activos) {
    try {
      // Si ya tenemos precios, basta con los últimos días; si no, desde la primera aportación
      const ultimo = ultimos.find(p => p.activo_id === a.id)?.fecha
      const primera = aportes.find(p => p.activo_id === a.id)?.fecha ?? hace10
      const desde = ultimo ? (ultimo < hace10 ? ultimo : hace10) : (primera < hace10 ? primera : hace10)
      const desdeMenos7 = new Date(Date.parse(desde) - 7 * 864e5).toISOString().slice(0, 10)

      const { currency, closes } = await yahoo(a.ticker, desdeMenos7)
      let enEur = closes
      if (currency !== 'EUR') {
        const base = currency === 'GBp' || currency === 'GBX' ? 'GBP' : currency
        enEur = aEuros(closes, currency, (await yahoo(`${base}EUR=X`, desdeMenos7)).closes)
      }
      const filas = [...enEur].map(([fecha, cierre_eur]) => ({ activo_id: a.id, fecha, cierre_eur: Number(cierre_eur.toFixed(6)) }))
      if (filas.length) await db('precios?on_conflict=activo_id,fecha', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(filas) })
      console.log(`${a.ticker}: ${filas.length} cierres (${currency})`)
    } catch (e) {
      fallos++
      console.error(`${a.ticker}: ${e.message}`)
    }
  }
  if (fallos && fallos === activos.length) process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1) })
