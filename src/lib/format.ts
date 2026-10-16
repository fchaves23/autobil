const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlShortFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export const brl = (n: number) => brlFmt.format(n || 0)
export const brlShort = (n: number) => brlShortFmt.format(n || 0)

export const num = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined || !isFinite(n)
    ? '—'
    : n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const km = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${num(n)} km`)

export function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const today = () => toISODate(new Date())

// Datas AAAA-MM-DD são lidas como data local (sem fuso), para não "voltar um dia".
export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonths(d: Date, n: number) {
  const x = new Date(d)
  const day = x.getDate()
  x.setDate(1)
  x.setMonth(x.getMonth() + n)
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, last))
  return x
}

export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000)

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const monthKey = (s: string) => s.slice(0, 7)
export function monthShort(key: string) {
  const [, m] = key.split('-').map(Number)
  return MONTHS[m - 1]
}
export function monthLong(key: string) {
  const [y, m] = key.split('-').map(Number)
  const thisYear = new Date().getFullYear()
  return y === thisYear ? MONTHS_LONG[m - 1] : `${MONTHS_LONG[m - 1]} de ${y}`
}

export function dateShort(s: string) {
  const d = parseDate(s)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`
}

export function dateFull(s: string) {
  return parseDate(s).toLocaleDateString('pt-BR')
}

export function relativeDays(n: number) {
  if (n === 0) return 'hoje'
  if (n === 1) return 'amanhã'
  if (n === -1) return 'ontem'
  if (n > 0) return n < 60 ? `em ${n} dias` : `em ${Math.round(n / 30)} meses`
  return -n < 60 ? `há ${-n} dias` : `há ${Math.round(-n / 30)} meses`
}

// Aceita "1.234,56", "1234.56" ou "1234,5"
export function parseNumber(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const thousandsOnly = /^\d{1,3}(\.\d{3})+$/.test(t) // "48.120" = quarenta e oito mil
  const normalized = t.includes(',') || thousandsOnly ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(normalized)
  return isFinite(n) ? n : null
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?'
