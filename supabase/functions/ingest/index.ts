// Recibe cada pago que envía el Atajo de Apple Pay del iPhone y lo guarda como gasto.
// El Atajo manual ("Apuntar movimiento") añade "tipo": "Gasto" o "Ingreso".
//
// POST /functions/v1/ingest
// Authorization: Bearer <token generado en Ajustes>
// { "importe": "23,50 €", "comercio": "MERCADONA", "tarjeta": "Revolut", "fecha": "2026-10-27T09:12:00Z" }
// { "importe": "15", "comercio": "Bizum de Ana", "tipo": "Ingreso" }

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { CATEGORIAS, categorizar, categorizarIngreso, esIngreso, isCategoria, normalizarComercio, parseImporte } from '../_shared/gastos.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

Deno.serve(async req => {
  if (req.method !== 'POST') return json(405, { error: 'Usa POST' })

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: 'Falta el token del Atajo' })
  const { data: tok } = await admin.from('ingest_tokens').select('user_id').eq('token_hash', await sha256(token)).maybeSingle()
  if (!tok) return json(401, { error: 'Token no válido: genera uno nuevo en Ajustes' })

  let body: Record<string, unknown>
  try {
    // Atajos suele poner mayúscula al escribir la clave ("Importe"): aceptamos cualquier forma
    body = Object.fromEntries(Object.entries(await req.json()).map(([k, v]) => [k.trim().toLowerCase(), v]))
  } catch {
    return json(400, { error: 'El cuerpo debe ser JSON' })
  }

  const importe = parseImporte(body.importe)
  const comercio = String(body.comercio ?? '').trim().slice(0, 120)
  if (!(importe > 0)) return json(400, { error: `Importe no válido: ${String(body.importe)}` })
  if (!comercio) return json(400, { error: 'Falta el comercio' })
  const tarjeta = body.tarjeta ? String(body.tarjeta).slice(0, 80) : null
  const fecha = parseFecha(body.fecha)
  // Solo el Atajo manual manda "tipo"; el de Apple Pay no
  const origen = body.tipo != null ? 'atajo' : 'applepay'

  if (esIngreso(body.tipo)) {
    const categoria = categorizarIngreso(comercio)
    const { data, error } = await admin
      .from('gastos')
      .insert({ user_id: tok.user_id, importe, comercio, categoria, tarjeta, fecha, origen, tipo: 'ingreso' })
      .select('id')
      .single()
    if (error) return json(500, { error: 'No se ha podido guardar el ingreso' })
    return json(200, { ok: true, id: data.id, mensaje: `+${euros(importe)} · ${comercio} · ${categoria}` })
  }

  const { data: reglas } = await admin.from('reglas').select('comercio_norm, categoria').eq('user_id', tok.user_id)
  const categoria = categorizar(comercio, reglas ?? []) ?? (await categorizarConIA(comercio)) ?? 'Otros'

  const { data, error } = await admin
    .from('gastos')
    .insert({ user_id: tok.user_id, importe, comercio, categoria, tarjeta, fecha, origen, tipo: 'gasto' })
    .select('id')
    .single()
  if (error) return json(500, { error: 'No se ha podido guardar el gasto' })

  // Lo que decide la IA se guarda como regla para no volver a preguntarle por ese comercio
  if (categoria !== 'Otros') {
    await admin.from('reglas').upsert(
      { user_id: tok.user_id, comercio_norm: normalizarComercio(comercio), categoria },
      { onConflict: 'user_id,comercio_norm', ignoreDuplicates: true },
    )
  }

  return json(200, { ok: true, id: data.id, mensaje: `${euros(importe)} en ${comercio} · ${categoria}` })
})

const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

function parseFecha(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim()) {
    const t = Date.parse(raw)
    if (Number.isFinite(t) && Math.abs(t - Date.now()) < 400 * 864e5) return new Date(t).toISOString()
  }
  return new Date().toISOString()
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Opcional: solo si el secreto ANTHROPIC_API_KEY está configurado en Supabase
async function categorizarConIA(comercio: string): Promise<string | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: `Clasifica este cargo de tarjeta de un usuario en España en UNA de estas categorías: ${CATEGORIAS.join(', ')}.\nComercio: "${comercio}"\nResponde solo con el nombre exacto de la categoría.`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const out = await res.json()
    const text = String(out?.content?.[0]?.text ?? '').trim()
    return isCategoria(text) ? text : null
  } catch {
    return null
  }
}
