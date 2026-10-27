import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const supabase = createClient(SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY as string)

export interface Gasto {
  id: string
  importe: number
  comercio: string
  categoria: string
  tarjeta: string | null
  fecha: string
  origen: 'applepay' | 'manual' | 'atajo'
  tipo: 'gasto' | 'ingreso'
}

export interface Activo {
  id: string
  nombre: string
  tipo: string
  ticker: string | null
  valor_actual: number | null
  valor_fecha: string | null
}

export interface Aportacion {
  id: string
  activo_id: string
  importe: number
  fecha: string
  tipo: 'aportacion' | 'inicial'
  participaciones: number | null
}

export interface Precio {
  activo_id: string
  fecha: string
  cierre_eur: number
}

// Postgres devuelve numeric como string: lo pasamos a número
export const num = (v: unknown) => (typeof v === 'number' ? v : Number(v))
