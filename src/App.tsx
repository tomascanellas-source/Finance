import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Login from './pages/Login'
import Gastos from './pages/Gastos'
import Inversiones from './pages/Inversiones'
import Ajustes from './pages/Ajustes'

type Vista = 'gastos' | 'inversiones' | 'ajustes'
const VISTAS: [Vista, string][] = [['gastos', 'Gastos'], ['inversiones', 'Inversiones'], ['ajustes', 'Ajustes']]
const vistaDeHash = (): Vista => {
  const h = location.hash.slice(1)
  return h === 'inversiones' || h === 'ajustes' ? h : 'gastos'
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [vista, setVista] = useState<Vista>(vistaDeHash)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    const onHash = () => setVista(vistaDeHash())
    addEventListener('hashchange', onHash)
    return () => {
      data.subscription.unsubscribe()
      removeEventListener('hashchange', onHash)
    }
  }, [])

  if (session === undefined) return <div className="cargando">Cargando…</div>
  if (!session) return <Login />

  return (
    <div className="app">
      <main className="contenido">
        {vista === 'gastos' && <Gastos />}
        {vista === 'inversiones' && <Inversiones />}
        {vista === 'ajustes' && <Ajustes email={session.user.email ?? ''} />}
      </main>
      <nav className="tabs" aria-label="Secciones">
        {VISTAS.map(([v, label]) => (
          <a key={v} href={`#${v}`} aria-current={vista === v ? 'page' : undefined}>{label}</a>
        ))}
      </nav>
    </div>
  )
}
