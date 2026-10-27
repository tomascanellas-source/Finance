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
        <h2>Atajo para apuntar a mano</h2>
        <p>Para Bizums, nómina, pagos con la tarjeta física o en efectivo. Lo lanzas desde la pantalla de bloqueo o diciendo “Oye Siri, apunta un movimiento”: te pregunta si es gasto o ingreso, cuánto y el concepto.</p>
        <ol className="pasos">
          <li>En <b>Atajos</b>, pestaña <b>Atajos</b> → <b>+</b>. Ponle de nombre <b>Apunta un movimiento</b> (es lo que dirás a Siri).</li>
          <li>Añade la acción <b>Lista</b> con dos elementos: <code>Gasto</code> e <code>Ingreso</code>. Debajo, <b>Elegir de la lista</b>.</li>
          <li>Añade <b>Solicitar entrada</b> de tipo <b>Número</b> con la pregunta <code>¿Cuánto?</code>, y otra <b>Solicitar entrada</b> de tipo <b>Texto</b> con <code>¿Concepto?</code>.</li>
          <li>
            Añade <b>Obtener contenido de URL</b> con la misma dirección y la misma cabecera <code>Authorization</code> que el Atajo de Apple Pay (puedes copiar el valor desde ese Atajo):
            <div className="copiable"><code>{url}</code><button className="btn small" onClick={() => copiar(url)}>Copiar</button></div>
          </li>
          <li>Método <b>POST</b>, cuerpo <b>JSON</b> con tres campos de texto: <code>importe</code> → la entrada de <b>¿Cuánto?</b>, <code>comercio</code> → la entrada de <b>¿Concepto?</b>, <code>tipo</code> → <b>Elemento elegido</b>. Para escoger cada una, pulsa el campo → <b>Seleccionar variable</b> → toca la acción de la que sale.</li>
          <li>Termina con <b>Mostrar notificación</b> → <b>Contenido de URL</b>, para ver “+15,00 € · Bizum de Ana · Bizum”.</li>
          <li>Para tenerlo a mano: mantén pulsada la pantalla de bloqueo → <b>Personalizar</b> → añade el widget de <b>Atajos</b>, o asígnalo al <b>botón de acción</b> si tu iPhone lo tiene.</li>
        </ol>
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
