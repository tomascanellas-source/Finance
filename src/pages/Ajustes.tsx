import { useState } from 'react'
import { supabase, SUPABASE_URL } from '../supabase'

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function Ajustes({ email }: { email: string }) {
  const [token, setToken] = useState('')
  const [msg, setMsg] = useState('')
  const url = `${SUPABASE_URL}/functions/v1/ingest`

  async function generar() {
    const t = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('')
    // Un token nuevo sustituye a los anteriores
    await supabase.from('ingest_tokens').delete().not('token_hash', 'is', null)
    const { error } = await supabase.from('ingest_tokens').insert({ token_hash: await sha256(t) })
    if (error) return setMsg('No se ha podido crear el token. Vuelve a intentarlo.')
    setToken(t)
    setMsg('')
  }

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); setMsg('Copiado.') } catch { setMsg('Selecciona el texto y cópialo a mano.') }
  }

  return (
    <div className="pagina estrecha">
      <header className="cabecera"><h1>Ajustes</h1></header>

      <section className="panel">
        <h2>Atajo de Apple Pay</h2>
        <p>Cada vez que pagues con Apple Pay, un Atajo del iPhone enviará el importe y el comercio a esta app. Se configura una sola vez.</p>
        <ol className="pasos">
          <li>
            Genera tu token. Solo se muestra ahora: cópialo al Atajo. Si lo pierdes, genera otro y el anterior deja de funcionar.
            <div className="fila-btn">
              <button className="btn primary" onClick={generar}>{token ? 'Generar otro token' : 'Generar token'}</button>
            </div>
            {token && <div className="copiable"><code>{token}</code><button className="btn small" onClick={() => copiar(token)}>Copiar</button></div>}
          </li>
          <li>Abre <b>Atajos</b> → <b>Automatización</b> → <b>+</b> → <b>Transacción</b>. Elige tus tarjetas (Revolut), marca <b>Ejecutar inmediatamente</b> y pulsa <b>Siguiente</b> → <b>Nuevo atajo en blanco</b>.</li>
          <li>
            Añade la acción <b>Obtener contenido de URL</b> con esta dirección:
            <div className="copiable"><code>{url}</code><button className="btn small" onClick={() => copiar(url)}>Copiar</button></div>
          </li>
          <li>Pulsa la flecha de la acción: <b>Método</b> POST. En <b>Cabeceras</b> añade <code>Authorization</code> con el valor <code>Bearer </code> seguido de tu token (con el espacio).</li>
          <li>En <b>Cuerpo de la solicitud</b> elige <b>JSON</b> y añade tres campos de texto: <code>importe</code> → variable <b>Importe</b>, <code>comercio</code> → variable <b>Comercio</b>, <code>tarjeta</code> → variable <b>Tarjeta o pase</b>.</li>
          <li>Opcional: añade <b>Mostrar notificación</b> con el <b>Contenido de URL</b> para ver “12,50 € en Mercadona · Supermercado” tras cada pago.</li>
        </ol>
        {msg && <p className="msg ok" role="status">{msg}</p>}
      </section>

      <section className="panel">
        <h2>Instalar en el iPhone</h2>
        <p>En Safari, pulsa <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>. La app se abrirá a pantalla completa como cualquier otra.</p>
      </section>

      <section className="panel">
        <h2>Cuenta</h2>
        <p className="muted">Has entrado como {email}.</p>
        <div><button className="btn" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div>
      </section>
    </div>
  )
}
