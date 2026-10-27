import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setMsg(null)
    const { error, data } =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
    setOcupado(false)
    if (error) setMsg({ texto: traducir(error.message), error: true })
    else if (modo === 'crear' && !data.session) setMsg({ texto: 'Te hemos enviado un email para confirmar la cuenta. Ábrelo y vuelve aquí para entrar.' })
  }

  return (
    <div className="login">
      <h1>Finanzas</h1>
      <p className="sub">Tus gastos y tu cartera, en un solo sitio.</p>
      <form className="panel" onSubmit={enviar}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button className="btn primary" disabled={ocupado}>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</button>
        {msg && <p className={msg.error ? 'msg err' : 'msg ok'} role="status">{msg.texto}</p>}
        <button type="button" className="linkbtn" onClick={() => setModo(modo === 'entrar' ? 'crear' : 'entrar')}>
          {modo === 'entrar' ? 'Es la primera vez: crear cuenta' : 'Ya tengo cuenta: entrar'}
        </button>
      </form>
    </div>
  )
}

function traducir(m: string) {
  if (/invalid login/i.test(m)) return 'Email o contraseña incorrectos.'
  if (/not confirmed/i.test(m)) return 'Confirma tu cuenta desde el email que te enviamos.'
  if (/already registered/i.test(m)) return 'Ya hay una cuenta con ese email: entra con tu contraseña.'
  return m
}
