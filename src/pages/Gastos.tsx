import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase, num, type Gasto } from '../supabase'
import { CATEGORIAS, categorizar, normalizarComercio, parseImporte, type Regla } from '../../supabase/functions/_shared/gastos.ts'
import { eur, eur0, fechaCorta, hoyISO, mesCorto, mesDe, mesNombre, pct, sumarMeses } from '../lib/format'

const COLOR: Record<string, string> = {
  Supermercado: 'var(--c1)', Restaurantes: 'var(--c3)', Transporte: 'var(--c2)', Compras: 'var(--c4)', Ocio: 'var(--c5)',
  Hogar: 'var(--c6)', Salud: 'var(--c7)', Suscripciones: 'var(--c8)', Viajes: 'var(--c9)', Otros: 'var(--muted)',
}

export default function Gastos() {
  const mesActual = mesDe(new Date())
  const [mes, setMes] = useState(mesActual)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [reglas, setReglas] = useState<Regla[]>([])
  const [error, setError] = useState('')
  const [cargado, setCargado] = useState(false)

  const cargar = useCallback(async () => {
    const desde = sumarMeses(mesActual, -12) + '-01'
    const [g, r] = await Promise.all([
      supabase.from('gastos').select('id, importe, comercio, categoria, tarjeta, fecha, origen').gte('fecha', desde).order('fecha', { ascending: false }).limit(5000),
      supabase.from('reglas').select('comercio_norm, categoria'),
    ])
    if (g.error) setError('No se pueden cargar los gastos. Revisa la conexión y recarga.')
    else setGastos(g.data.map(x => ({ ...x, importe: num(x.importe) })) as Gasto[])
    if (!r.error) setReglas(r.data)
    setCargado(true)
  }, [mesActual])

  useEffect(() => {
    cargar()
    // Los pagos que llegan del Atajo aparecen solos mientras la app está abierta
    const ch = supabase.channel('gastos').on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => cargar()).subscribe()
    const onFocus = () => document.visibilityState === 'visible' && cargar()
    document.addEventListener('visibilitychange', onFocus)
    return () => { supabase.removeChannel(ch); document.removeEventListener('visibilitychange', onFocus) }
  }, [cargar])

  const delMes = useMemo(() => gastos.filter(g => mesDe(new Date(g.fecha)) === mes), [gastos, mes])
  const total = delMes.reduce((s, g) => s + g.importe, 0)

  // Comparación justa: el mes anterior hasta el mismo día
  const comparacion = useMemo(() => {
    const anterior = sumarMeses(mes, -1)
    const hastaDia = mes === mesActual ? new Date().getDate() : 31
    const prev = gastos.filter(g => { const d = new Date(g.fecha); return mesDe(d) === anterior && d.getDate() <= hastaDia })
    return { total: prev.reduce((s, g) => s + g.importe, 0), mesNombre: mesNombre(anterior).split(' ')[0], parcial: mes === mesActual }
  }, [gastos, mes, mesActual])

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    for (const g of delMes) m.set(g.categoria, (m.get(g.categoria) ?? 0) + g.importe)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [delMes])

  const seisMeses = useMemo(() => {
    const meses = Array.from({ length: 6 }, (_, i) => sumarMeses(mes, i - 5))
    return meses.map(m => ({ m, total: gastos.filter(g => mesDe(new Date(g.fecha)) === m).reduce((s, g) => s + g.importe, 0) }))
  }, [gastos, mes])

  const topComercios = useMemo(() => {
    const m = new Map<string, { nombre: string; total: number; veces: number }>()
    for (const g of delMes) {
      const k = normalizarComercio(g.comercio) || g.comercio
      const e = m.get(k) ?? { nombre: g.comercio, total: 0, veces: 0 }
      e.total += g.importe; e.veces++
      m.set(k, e)
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 5)
  }, [delMes])

  async function cambiarCategoria(g: Gasto, categoria: string) {
    setGastos(gs => gs.map(x => (x.id === g.id ? { ...x, categoria } : x)))
    const norm = normalizarComercio(g.comercio)
    const [a] = await Promise.all([
      supabase.from('gastos').update({ categoria }).eq('id', g.id),
      norm ? supabase.from('reglas').upsert({ comercio_norm: norm, categoria }, { onConflict: 'user_id,comercio_norm' }) : null,
    ])
    if (a.error) setError('No se ha podido cambiar la categoría.')
    // Aplica la nueva regla a los gastos de ese comercio que estaban en Otros
    if (norm) {
      const otros = gastos.filter(x => x.id !== g.id && x.categoria === 'Otros' && normalizarComercio(x.comercio) === norm).map(x => x.id)
      if (otros.length) await supabase.from('gastos').update({ categoria }).in('id', otros)
    }
    cargar()
  }

  async function borrar(id: string) {
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (error) setError('No se ha podido borrar.')
    else setGastos(gs => gs.filter(g => g.id !== id))
  }

  const max6 = Math.max(...seisMeses.map(x => x.total), 1)
  const diff = total - comparacion.total

  return (
    <div className="pagina">
      <header className="cabecera">
        <h1>Gastos</h1>
        <div className="mesnav">
          <button className="btn small" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior">‹</button>
          <span className="mes">{mesNombre(mes)}</span>
          <button className="btn small" onClick={() => setMes(sumarMeses(mes, 1))} disabled={mes >= mesActual} aria-label="Mes siguiente">›</button>
        </div>
      </header>

      {error && <div className="banner" role="alert">{error}</div>}

      <section className="totals">
        <div className="tot"><div className="label">Gastado</div><div className="v num">{eur.format(total)}</div><div className="n">{delMes.length} pagos</div></div>
        <div className="tot">
          <div className="label">Frente a {comparacion.mesNombre}</div>
          <div className={'v num ' + (comparacion.total === 0 ? '' : diff > 0 ? 'negc' : 'pos')}>
            {comparacion.total === 0 ? '—' : (diff > 0 ? '+' : '−') + eur.format(Math.abs(diff))}
          </div>
          <div className="n">{comparacion.total === 0 ? 'Sin datos del mes anterior' : `${comparacion.parcial ? 'a estas alturas de mes, ' : ''}${pct.format(Math.abs(diff) / comparacion.total)} ${diff > 0 ? 'más' : 'menos'}`}</div>
        </div>
        <div className="tot"><div className="label">Categoría principal</div><div className="v">{porCategoria[0]?.[0] ?? '—'}</div><div className="n">{porCategoria[0] ? `${eur.format(porCategoria[0][1])} · ${pct.format(porCategoria[0][1] / (total || 1))}` : 'Aún sin gastos'}</div></div>
      </section>

      <div className="grid">
        <div className="col">
          <NuevoGasto reglas={reglas} onGuardado={cargar} />
          <section className="panel">
            <h2>Últimos 6 meses</h2>
            <div className="columnas" role="img" aria-label="Gasto total de los últimos 6 meses">
              {seisMeses.map(x => (
                <button key={x.m} className={'columna' + (x.m === mes ? ' activa' : '')} onClick={() => setMes(x.m)} title={`${mesNombre(x.m)}: ${eur.format(x.total)}`}>
                  <span className="cval num">{x.total ? eur0.format(x.total) : ''}</span>
                  <span className="cbar" style={{ height: `${(x.total / max6) * 100}%` }} />
                  <span className="cmes">{mesCorto(x.m)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="col">
          <section className="panel">
            <h2>¿A dónde va tu dinero?</h2>
            {!porCategoria.length && <p className="empty">{cargado ? 'Cuando pagues con Apple Pay o apuntes un gasto, aquí verás el reparto por categoría.' : 'Cargando…'}</p>}
            {porCategoria.map(([cat, v]) => (
              <div className="fila" key={cat}>
                <div className="nombre"><i className="dot" style={{ background: COLOR[cat] ?? 'var(--muted)' }} />{cat}</div>
                <div className="num">{eur.format(v)} <span className="muted">· {pct.format(v / total)}</span></div>
                <div className="bar"><i style={{ width: `${(v / porCategoria[0][1]) * 100}%`, background: COLOR[cat] ?? 'var(--muted)' }} /></div>
              </div>
            ))}
          </section>

          {topComercios.length > 0 && (
            <section className="panel">
              <h2>Dónde más gastas</h2>
              <ol className="top">
                {topComercios.map(c => (
                  <li key={c.nombre}><span className="t">{c.nombre}</span><span className="muted">{c.veces} {c.veces === 1 ? 'vez' : 'veces'}</span><span className="num">{eur.format(c.total)}</span></li>
                ))}
              </ol>
            </section>
          )}

          <section className="panel">
            <h2>Movimientos</h2>
            {!delMes.length && <p className="empty">No hay gastos en {mesNombre(mes)}.</p>}
            <ul className="movs">
              {delMes.map(g => (
                <Movimiento key={g.id} g={g} onCategoria={c => cambiarCategoria(g, c)} onBorrar={() => borrar(g.id)} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function Movimiento({ g, onCategoria, onBorrar }: { g: Gasto; onCategoria: (c: string) => void; onBorrar: () => void }) {
  const [confirmar, setConfirmar] = useState(false)
  return (
    <li className="mov">
      <div className="movtxt">
        <span className="t">{g.comercio}</span>
        <span className="muted">{fechaCorta(g.fecha)}{g.origen === 'applepay' ? ' · Apple Pay' : ''}{g.tarjeta ? ` · ${g.tarjeta}` : ''}</span>
      </div>
      <span className="num importe">{eur.format(g.importe)}</span>
      <select aria-label={`Categoría de ${g.comercio}`} value={g.categoria} onChange={e => onCategoria(e.target.value)}>
        {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
      </select>
      {confirmar
        ? <span className="confirmar"><button className="btn small" onClick={onBorrar}>Borrar</button><button className="linkbtn" onClick={() => setConfirmar(false)}>No</button></span>
        : <button className="linkbtn" onClick={() => setConfirmar(true)}>Borrar</button>}
    </li>
  )
}

function NuevoGasto({ reglas, onGuardado }: { reglas: Regla[]; onGuardado: () => void }) {
  const [importe, setImporte] = useState('')
  const [comercio, setComercio] = useState('')
  const [categoria, setCategoria] = useState('auto')
  const [fecha, setFecha] = useState(hoyISO())
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null)
  const sugerida = comercio ? categorizar(comercio, reglas) : null

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const n = parseImporte(importe)
    if (!(n > 0)) return setMsg({ texto: 'Escribe un importe, por ejemplo 12,50.', error: true })
    if (!comercio.trim()) return setMsg({ texto: 'Escribe dónde has gastado.', error: true })
    const cat = categoria === 'auto' ? sugerida ?? 'Otros' : categoria
    const ahora = new Date()
    const f = fecha === hoyISO() ? ahora.toISOString() : new Date(fecha + 'T12:00:00').toISOString()
    const { error } = await supabase.from('gastos').insert({ importe: n, comercio: comercio.trim(), categoria: cat, fecha: f, origen: 'manual' })
    if (error) return setMsg({ texto: 'No se ha guardado. Revisa la conexión.', error: true })
    if (categoria !== 'auto') {
      const norm = normalizarComercio(comercio)
      if (norm) await supabase.from('reglas').upsert({ comercio_norm: norm, categoria: cat }, { onConflict: 'user_id,comercio_norm' })
    }
    setMsg({ texto: `Guardado: ${eur.format(n)} en ${comercio.trim()} (${cat}).` })
    setImporte(''); setComercio(''); setCategoria('auto'); setFecha(hoyISO())
    onGuardado()
  }

  return (
    <form className="panel" onSubmit={guardar}>
      <h2>Apuntar un gasto</h2>
      <div className="row2">
        <div className="field"><label htmlFor="g-importe">Importe (€)</label><input id="g-importe" className="amount" inputMode="decimal" placeholder="0,00" value={importe} onChange={e => setImporte(e.target.value)} /></div>
        <div className="field"><label htmlFor="g-fecha">Fecha</label><input id="g-fecha" type="date" value={fecha} max={hoyISO()} onChange={e => setFecha(e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="g-comercio">¿Dónde?</label><input id="g-comercio" placeholder="Mercadona, cena con Ana…" value={comercio} onChange={e => setComercio(e.target.value)} /></div>
      <div className="field">
        <label htmlFor="g-cat">Categoría</label>
        <select id="g-cat" value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="auto">Automática{comercio ? `: ${sugerida ?? 'Otros'}` : ''}</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <button className="btn primary">Guardar gasto</button>
      {msg && <p className={msg.error ? 'msg err' : 'msg ok'} role="status">{msg.texto}</p>}
    </form>
  )
}
