import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase, num, type Activo, type Aportacion, type Precio } from '../supabase'
import { parseImporte } from '../../supabase/functions/_shared/gastos.ts'
import { valorar } from '../lib/cartera'
import { eur, fechaCorta, hoyISO, pct, signed } from '../lib/format'

// Activos habituales en Trade Republic con su símbolo de Yahoo Finance (cotización en euros)
const SUGERENCIAS: { nombre: string; tipo: string; ticker: string | null }[] = [
  { nombre: 'iShares Core MSCI World', tipo: 'ETF', ticker: 'EUNL.DE' },
  { nombre: 'Vanguard FTSE All-World', tipo: 'ETF', ticker: 'VWCE.DE' },
  { nombre: 'iShares Core S&P 500', tipo: 'ETF', ticker: 'SXR8.DE' },
  { nombre: 'iShares Core MSCI EM IMI', tipo: 'ETF', ticker: 'IS3N.DE' },
  { nombre: 'Bitcoin', tipo: 'Cripto', ticker: 'BTC-EUR' },
  { nombre: 'Ethereum', tipo: 'Cripto', ticker: 'ETH-EUR' },
  { nombre: 'Cuenta remunerada', tipo: 'Efectivo', ticker: null },
]
// Participaciones con muchos decimales: "12,4537" o "12.4537" (no hay separador de miles)
const parseCantidad = (s: string) => Number(s.trim().replace(',', '.'))
const COLORES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)']

export default function Inversiones() {
  const [activos, setActivos] = useState<Activo[]>([])
  const [aportaciones, setAportaciones] = useState<Aportacion[]>([])
  const [precios, setPrecios] = useState<Precio[]>([])
  const [error, setError] = useState('')
  const [cargado, setCargado] = useState(false)

  const cargar = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('activos').select('id, nombre, tipo, ticker, valor_actual, valor_fecha').order('nombre'),
      supabase.from('aportaciones').select('id, activo_id, importe, fecha, tipo, participaciones').order('fecha', { ascending: false }),
      supabase.from('precios').select('activo_id, fecha, cierre_eur').order('fecha').limit(20000),
    ])
    if (a.error || b.error || c.error) setError('No se puede cargar la cartera. Revisa la conexión y recarga.')
    else {
      setActivos(a.data.map(x => ({ ...x, valor_actual: x.valor_actual == null ? null : num(x.valor_actual) })))
      setAportaciones(b.data.map(x => ({ ...x, importe: num(x.importe), participaciones: x.participaciones == null ? null : num(x.participaciones) })))
      setPrecios(c.data.map(x => ({ ...x, cierre_eur: num(x.cierre_eur) })))
    }
    setCargado(true)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const posiciones = useMemo(() => valorar(activos, aportaciones, precios), [activos, aportaciones, precios])
  const aportado = posiciones.reduce((s, p) => s + p.neto, 0)
  const valor = posiciones.reduce((s, p) => s + p.valor, 0)
  const ganancia = valor - aportado
  const ultimoCierre = precios.reduce<string | null>((m, p) => (!m || p.fecha > m ? p.fecha : m), null)
  const base = posiciones.reduce((s, p) => s + Math.max(0, p.valor), 0) || 1

  async function borrar(id: string) {
    const { error } = await supabase.from('aportaciones').delete().eq('id', id)
    if (error) setError('No se ha podido borrar.')
    else cargar()
  }

  return (
    <div className="pagina">
      <header className="cabecera">
        <h1>Inversiones</h1>
        <span className="muted">{ultimoCierre ? `Precios al cierre del ${fechaCorta(ultimoCierre)}` : 'Los precios se actualizan cada día al cierre'}</span>
      </header>
      {error && <div className="banner" role="alert">{error}</div>}

      <section className="totals">
        <div className="tot"><div className="label">Valor hoy</div><div className="v num">{eur.format(valor)}</div><div className="n">{posiciones.length} activos</div></div>
        <div className="tot"><div className="label">Aportado neto</div><div className="v num">{eur.format(aportado)}</div><div className="n">{aportaciones.length} movimientos</div></div>
        <div className="tot"><div className="label">Ganancia</div><div className={'v num ' + (ganancia >= 0 ? 'pos' : 'negc')}>{aportado ? signed(ganancia) : '—'}</div><div className="n">{aportado ? `${ganancia >= 0 ? '+' : '−'}${pct.format(Math.abs(ganancia) / aportado)} sobre lo aportado` : 'Valor hoy menos aportado'}</div></div>
      </section>

      <div className="grid">
        <div className="col">
          <NuevaAportacion activos={activos} onGuardado={cargar} />
        </div>
        <div className="col">
          <section className="panel">
            <h2>Dónde está tu dinero</h2>
            {!posiciones.length && <p className="empty">{cargado ? 'Tus activos aparecerán aquí con su peso en la cartera y lo que ganan o pierden. Empieza con una aportación.' : 'Cargando…'}</p>}
            {posiciones.map((p, i) => {
              const g = p.valor - p.neto
              const color = COLORES[i % COLORES.length]
              return (
                <div className="fila" key={p.activo.id}>
                  <div className="nombre"><i className="dot" style={{ background: color }} /><span className="t">{p.activo.nombre}</span><span className="tag">{p.activo.tipo}</span></div>
                  <div className="num">{pct.format(Math.max(0, p.valor) / base)}</div>
                  <div className="bar"><i style={{ width: `${(Math.max(0, p.valor) / base) * 100}%`, background: color }} /></div>
                  <div className="meta">
                    <span>Valor <b className="num">{eur.format(p.valor)}</b></span>
                    <span>Aportado <b className="num">{eur.format(p.neto)}</b></span>
                    {p.conPrecio && <span className={'num ' + (g >= 0 ? 'pos' : 'negc')}>{signed(g)}</span>}
                    {p.activo.ticker && !p.ultimoPrecio && <span className="muted">Precio pendiente: llega tras el próximo cierre</span>}
                    {!p.activo.ticker && <ValorManual activo={p.activo} onGuardado={cargar} />}
                  </div>
                </div>
              )
            })}
          </section>

          <section className="panel">
            <h2>Historial</h2>
            {!aportaciones.length && <p className="empty">Aún no hay movimientos.</p>}
            <ul className="movs">
              {aportaciones.map(a => (
                <FilaAportacion key={a.id} a={a} nombre={activos.find(x => x.id === a.activo_id)?.nombre ?? '—'} onBorrar={() => borrar(a.id)} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function FilaAportacion({ a, nombre, onBorrar }: { a: Aportacion; nombre: string; onBorrar: () => void }) {
  const [confirmar, setConfirmar] = useState(false)
  return (
    <li className="mov">
      <div className="movtxt"><span className="t">{nombre}</span><span className="muted">{a.tipo === 'inicial' ? `Posición inicial · ${fechaCorta(a.fecha)}` : fechaCorta(a.fecha)}{a.participaciones != null ? ` · ${a.participaciones.toLocaleString('es-ES', { maximumFractionDigits: 6 })} part.` : ''}</span></div>
      <span className={'num importe ' + (a.importe < 0 ? 'negc' : '')}>{signed(a.importe)}</span>
      {confirmar
        ? <span className="confirmar"><button className="btn small" onClick={onBorrar}>Borrar</button><button className="linkbtn" onClick={() => setConfirmar(false)}>No</button></span>
        : <button className="linkbtn" onClick={() => setConfirmar(true)}>Borrar</button>}
    </li>
  )
}

function ValorManual({ activo, onGuardado }: { activo: Activo; onGuardado: () => void }) {
  const [editando, setEditando] = useState(false)
  const [v, setV] = useState('')
  async function guardar() {
    const n = v.trim() === '' ? null : parseImporte(v)
    if (n != null && !(n >= 0)) return
    await supabase.from('activos').update({ valor_actual: n, valor_fecha: n == null ? null : hoyISO() }).eq('id', activo.id)
    setEditando(false)
    onGuardado()
  }
  if (!editando)
    return <button className="linkbtn" onClick={() => { setV(activo.valor_actual != null ? String(activo.valor_actual).replace('.', ',') : ''); setEditando(true) }}>
      {activo.valor_actual != null ? `Valor apuntado el ${fechaCorta(activo.valor_fecha!)} · actualizar` : 'Apuntar valor actual'}
    </button>
  return (
    <span className="valedit">
      <input aria-label={`Valor actual de ${activo.nombre}`} inputMode="decimal" value={v} autoFocus onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardar()} />
      <button className="btn small" onClick={guardar}>Guardar</button>
      <button className="linkbtn" onClick={() => setEditando(false)}>Cancelar</button>
    </span>
  )
}

function NuevaAportacion({ activos, onGuardado }: { activos: Activo[]; onGuardado: () => void }) {
  const [modo, setModo] = useState<'aportar' | 'retirar' | 'inicial'>('aportar')
  const [participaciones, setParticipaciones] = useState('')
  const [activoId, setActivoId] = useState('')
  const [nuevo, setNuevo] = useState({ nombre: '', tipo: 'ETF', ticker: '' })
  const [importe, setImporte] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null)
  const elegido = activoId || (activos.length ? activos[0].id : '__nuevo')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const n = parseImporte(importe)
    if (!(n > 0)) return setMsg({ texto: 'Escribe un importe mayor que 0, por ejemplo 150.', error: true })
    let id = elegido
    let nombre = activos.find(a => a.id === id)?.nombre ?? ''
    if (id === '__nuevo') {
      if (!nuevo.nombre.trim()) return setMsg({ texto: 'Ponle nombre al activo.', error: true })
      const { data, error } = await supabase.from('activos')
        .insert({ nombre: nuevo.nombre.trim(), tipo: nuevo.tipo, ticker: nuevo.ticker.trim().toUpperCase() || null })
        .select('id').single()
      if (error) return setMsg({ texto: 'No se ha podido crear el activo.', error: true })
      id = data.id
      nombre = nuevo.nombre.trim()
    }
    const part = participaciones.trim() ? parseCantidad(participaciones) : null
    if (part != null && !(part > 0)) return setMsg({ texto: 'Las participaciones deben ser un número, por ejemplo 12,5.', error: true })
    const { error } = await supabase.from('aportaciones').insert({
      activo_id: id,
      importe: modo === 'retirar' ? -n : n,
      fecha,
      tipo: modo === 'inicial' ? 'inicial' : 'aportacion',
      participaciones: part,
    })
    if (error) return setMsg({ texto: 'No se ha guardado. Revisa la conexión.', error: true })
    setMsg({ texto: modo === 'inicial' ? `Registrado lo que ya tenías en ${nombre}: ${eur.format(n)}.` : `${modo === 'aportar' ? 'Aportados' : 'Retirados'} ${eur.format(n)} en ${nombre}.` })
    setImporte(''); setParticipaciones(''); setNuevo({ nombre: '', tipo: 'ETF', ticker: '' }); setActivoId(id); setModo('aportar'); setFecha(hoyISO())
    onGuardado()
  }

  return (
    <form className="panel" onSubmit={guardar}>
      <h2>{modo === 'inicial' ? 'Lo que ya tienes invertido' : 'Nueva aportación'}</h2>
      <div className="seg tres" role="group" aria-label="Tipo de movimiento">
        <button type="button" aria-pressed={modo === 'aportar'} onClick={() => setModo('aportar')}>Aportar</button>
        <button type="button" aria-pressed={modo === 'retirar'} onClick={() => setModo('retirar')}>Retirar</button>
        <button type="button" aria-pressed={modo === 'inicial'} onClick={() => setModo('inicial')}>Ya lo tengo</button>
      </div>
      {modo === 'inicial' && <p className="hint">Para cada activo que ya tengas, pon el total que has metido hasta hoy. Si además pones las participaciones que te muestra Trade Republic, el valor será exacto.</p>}
      <div className="field">
        <label htmlFor="i-activo">¿Dónde inviertes?</label>
        <select id="i-activo" value={elegido} onChange={e => setActivoId(e.target.value)}>
          {activos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          <option value="__nuevo">+ Nuevo activo…</option>
        </select>
      </div>
      {elegido === '__nuevo' && (
        <div className="newbox">
          <div className="chips">
            {SUGERENCIAS.map(s => (
              <button type="button" className="chip" key={s.nombre} onClick={() => setNuevo({ nombre: s.nombre, tipo: s.tipo, ticker: s.ticker ?? '' })}>{s.nombre}</button>
            ))}
          </div>
          <div className="field"><label htmlFor="i-nombre">Nombre</label><input id="i-nombre" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="iShares Core MSCI World" /></div>
          <div className="row2">
            <div className="field"><label htmlFor="i-tipo">Tipo</label>
              <select id="i-tipo" value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value })}>
                {['ETF', 'Acción', 'Cripto', 'Fondo', 'Efectivo', 'Otro'].map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div className="field"><label htmlFor="i-ticker">Símbolo (opcional)</label><input id="i-ticker" value={nuevo.ticker} onChange={e => setNuevo({ ...nuevo, ticker: e.target.value })} placeholder="EUNL.DE" /></div>
          </div>
          <p className="hint">El símbolo es el de Yahoo Finance y sirve para traer el precio cada día. Sin símbolo, el valor es lo que apuntes a mano.</p>
        </div>
      )}
      <div className="row2">
        <div className="field"><label htmlFor="i-importe">{modo === 'inicial' ? 'Total invertido (€)' : 'Importe (€)'}</label><input id="i-importe" className="amount" inputMode="decimal" placeholder="0,00" value={importe} onChange={e => setImporte(e.target.value)} /></div>
        <div className="field"><label htmlFor="i-fecha">{modo === 'inicial' ? 'Desde (aprox.)' : 'Fecha'}</label><input id="i-fecha" type="date" max={hoyISO()} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      </div>
      {modo !== 'retirar' && (
        <div className="field">
          <label htmlFor="i-part">Participaciones {modo === 'inicial' ? '(recomendado)' : '(opcional)'}</label>
          <input id="i-part" inputMode="decimal" placeholder="Ej. 12,4537" value={participaciones} onChange={e => setParticipaciones(e.target.value)} />
        </div>
      )}
      <button className="btn primary">{modo === 'inicial' ? 'Registrar lo que tengo' : modo === 'aportar' ? 'Guardar aportación' : 'Guardar retirada'}</button>
      {msg && <p className={msg.error ? 'msg err' : 'msg ok'} role="status">{msg.texto}</p>}
    </form>
  )
}
