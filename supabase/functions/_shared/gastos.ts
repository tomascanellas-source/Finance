// Lógica compartida entre la función `ingest` (Deno) y la web: sin dependencias.

export const CATEGORIAS = [
  'Supermercado',
  'Restaurantes',
  'Transporte',
  'Compras',
  'Ocio',
  'Hogar',
  'Salud',
  'Suscripciones',
  'Viajes',
  'Otros',
] as const
export type Categoria = (typeof CATEGORIAS)[number]

// "23,50 €", "€1.234,56", "12.99", "-4,20" -> número positivo con 2 decimales; NaN si no se entiende
export function parseImporte(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? round2(Math.abs(raw)) : NaN
  if (typeof raw !== 'string') return NaN
  let s = raw.replace(/[^\d.,-]/g, '').replace(/-/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  const dec = Math.max(lastComma, lastDot)
  // Un separador seguido de exactamente 3 cifras y sin otro tipo de separador es de miles: "1.234"
  if (dec >= 0 && s.length - dec - 1 === 3 && (lastComma < 0 || lastDot < 0)) s = s.replace(/[.,]/g, '')
  else if (dec >= 0) s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1)
  const n = Number(s)
  return Number.isFinite(n) ? round2(n) : NaN
}

const round2 = (n: number) => Math.round(n * 100) / 100

// "MERCADONA 1234 MADRID" -> "mercadona madrid"
export function normalizarComercio(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Palabras clave habituales en España; la primera que aparezca en el comercio decide
const PALABRAS: [Categoria, string[]][] = [
  ['Supermercado', ['mercadona', 'carrefour', 'lidl', 'aldi', 'dia ', 'eroski', 'alcampo', 'consum', 'hipercor', 'bonpreu', 'caprabo', 'ahorramas', 'supermercado', 'super ', 'condis', 'spar', 'froiz', 'gadis', 'simply', 'el corte ingles super']],
  ['Restaurantes', ['restaurante', 'rest ', 'bar ', 'cafe', 'cafeteria', 'mcdonald', 'burger king', 'telepizza', 'domino', 'kfc', 'starbucks', 'glovo', 'just eat', 'uber eats', 'deliveroo', 'tagliatella', 'vips', 'goiko', 'taberna', 'cerveceria', 'pizzeria', 'sushi', 'panaderia', 'pasteleria', 'horno']],
  ['Transporte', ['uber', 'cabify', 'bolt', 'free now', 'freenow', 'taxi', 'renfe', 'metro', 'emt', 'tmb', 'gasolinera', 'repsol', 'cepsa', 'bp ', 'galp', 'shell', 'parking', 'aparcamiento', 'peaje', 'autopista', 'bicing', 'lime', 'iryo', 'ouigo', 'alsa']],
  ['Suscripciones', ['netflix', 'spotify', 'hbo', 'max ', 'disney', 'prime video', 'amazon prime', 'apple com bill', 'apple com', 'icloud', 'youtube', 'google one', 'chatgpt', 'openai', 'anthropic', 'claude', 'dazn', 'movistar', 'gym', 'gimnasio', 'basic fit', 'basicfit', 'dir ', 'holmes place']],
  ['Viajes', ['ryanair', 'vueling', 'iberia', 'easyjet', 'air europa', 'booking', 'airbnb', 'hotel', 'expedia', 'edreams', 'aena']],
  ['Salud', ['farmacia', 'clinica', 'hospital', 'dentista', 'dental', 'optica', 'sanitas', 'adeslas', 'fisioterapia', 'medico']],
  ['Hogar', ['ikea', 'leroy merlin', 'bricomart', 'bauhaus', 'iberdrola', 'endesa', 'naturgy', 'holaluz', 'agua', 'canal de isabel', 'vodafone', 'orange', 'digi', 'jazztel', 'lowi', 'pepephone', 'alquiler']],
  ['Compras', ['amazon', 'zara', 'mango', 'primark', 'pull bear', 'bershka', 'massimo dutti', 'h m', 'uniqlo', 'decathlon', 'el corte ingles', 'fnac', 'mediamarkt', 'media markt', 'pccomponentes', 'aliexpress', 'shein', 'apple store', 'sephora', 'druni', 'primor', 'nike', 'adidas']],
  ['Ocio', ['cine', 'cinesa', 'yelmo', 'teatro', 'ticketmaster', 'entradas', 'steam', 'playstation', 'nintendo', 'xbox', 'museo', 'concierto', 'discoteca', 'padel', 'playtomic']],
]

export interface Regla { comercio_norm: string; categoria: string }

// Primero las reglas del usuario (lo que ya corrigió), luego las palabras clave. null = no se sabe.
export function categorizar(comercio: string, reglas: Regla[] = []): Categoria | null {
  const norm = normalizarComercio(comercio)
  if (!norm) return null
  const exacta = reglas.find(r => r.comercio_norm === norm)
  if (exacta && isCategoria(exacta.categoria)) return exacta.categoria
  const parcial = reglas
    .filter(r => r.comercio_norm.length >= 4 && norm.includes(r.comercio_norm))
    .sort((a, b) => b.comercio_norm.length - a.comercio_norm.length)[0]
  if (parcial && isCategoria(parcial.categoria)) return parcial.categoria
  const conEspacios = ` ${norm} `
  for (const [cat, palabras] of PALABRAS) {
    if (palabras.some(p => conEspacios.includes(p.endsWith(' ') ? ` ${p}` : p))) return cat
  }
  return null
}

export function isCategoria(s: string): s is Categoria {
  return (CATEGORIAS as readonly string[]).includes(s)
}
