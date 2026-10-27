import { useState } from 'react'
import { pct } from '../lib/format'

export interface Rebanada { clave: string; etiqueta: string; valor: number; color: string }

interface Props {
  datos: Rebanada[]
  titulo: string            // lectura accesible y etiqueta del centro
  total: string             // total ya formateado, se muestra en el centro
  formato: (n: number) => string
  leyenda?: boolean
}

const R = 84, C = 2 * Math.PI * R, HUECO = 3

// Rosco con el total en el centro; al pasar el dedo o el ratón por una porción (o su fila) el centro muestra su detalle
export default function Donut({ datos, titulo, total, formato, leyenda = true }: Props) {
  const [activa, setActiva] = useState<string | null>(null)
  const suma = datos.reduce((s, d) => s + d.valor, 0)
  if (!(suma > 0)) return null
  const actual = datos.find(d => d.clave === activa)

  let acumulado = 0
  const trozos = datos.map(d => {
    const largo = Math.max((d.valor / suma) * C - (datos.length > 1 ? HUECO : 0), 0.5)
    const t = { ...d, largo, inicio: acumulado }
    acumulado += (d.valor / suma) * C
    return t
  })

  return (
    <div className="donutwrap">
      <div className="donut">
        <svg viewBox="0 0 200 200" role="img" aria-label={`${titulo}: ${datos.map(d => `${d.etiqueta} ${pct.format(d.valor / suma)}`).join(', ')}`}>
          <circle cx="100" cy="100" r={R} className="donut-pista" />
          <g transform="rotate(-90 100 100)">
            {trozos.map(t => (
              <circle
                key={t.clave}
                cx="100" cy="100" r={R}
                className={'donut-trozo' + (activa === t.clave ? ' on' : activa ? ' off' : '')}
                stroke={t.color}
                strokeDasharray={`${t.largo} ${C - t.largo}`}
                strokeDashoffset={-t.inicio}
                onMouseEnter={() => setActiva(t.clave)}
                onMouseLeave={() => setActiva(null)}
                onClick={() => setActiva(activa === t.clave ? null : t.clave)}
              />
            ))}
          </g>
        </svg>
        <div className="donut-centro" aria-hidden="true">
          <span className="label t">{actual ? actual.etiqueta : titulo}</span>
          <span className="num donut-valor">{actual ? formato(actual.valor) : total}</span>
          <span className="donut-sub">{actual ? pct.format(actual.valor / suma) : `${datos.length} ${datos.length === 1 ? 'parte' : 'partes'}`}</span>
        </div>
      </div>

      {leyenda && (
        <ul className="leyenda">
          {datos.map(d => (
            <li key={d.clave}>
              <button
                type="button"
                className={activa === d.clave ? 'on' : ''}
                onMouseEnter={() => setActiva(d.clave)} onMouseLeave={() => setActiva(null)}
                onFocus={() => setActiva(d.clave)} onBlur={() => setActiva(null)}
              >
                <i className="dot" style={{ background: d.color }} />
                <span className="t">{d.etiqueta}</span>
                <span className="num muted">{pct.format(d.valor / suma)}</span>
                <span className="num">{formato(d.valor)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
