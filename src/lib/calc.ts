import type { Entry, EntryKind, Reminder, Vehicle } from './types'
import { addDays, addMonths, daysBetween, monthKey, parseDate, toISODate } from './format'

export function currentOdometer(vehicle: Vehicle, entries: Entry[]) {
  return entries.reduce((max, e) => (e.odometer && e.odometer > max ? e.odometer : max), vehicle.initial_odometer || 0)
}

export interface ConsumptionPoint {
  date: string
  odometer: number
  kml: number
  fuel: string
}

// Método do tanque cheio: km rodados entre dois tanques cheios ÷ litros colocados depois do primeiro.
export function consumption(entries: Entry[]) {
  const fills = entries
    .filter((e) => e.kind === 'fuel' && e.odometer && e.liters)
    .sort((a, b) => a.odometer! - b.odometer!)
  const points: ConsumptionPoint[] = []
  let lastFullOdo: number | null = null
  let liters = 0
  let totalKm = 0
  let totalL = 0
  for (const f of fills) {
    if (lastFullOdo !== null) liters += f.liters!
    if (f.full_tank) {
      if (lastFullOdo !== null && liters > 0) {
        const driven = f.odometer! - lastFullOdo
        const kml = driven / liters
        if (kml > 0 && kml < 60) {
          points.push({ date: f.date, odometer: f.odometer!, kml, fuel: f.fuel_type || '' })
          totalKm += driven
          totalL += liters
        }
      }
      lastFullOdo = f.odometer!
      liters = 0
    }
  }
  return { points, average: totalL > 0 ? totalKm / totalL : null, last: points.length ? points[points.length - 1].kml : null }
}

export function sumBy(entries: Entry[], kind?: EntryKind) {
  return entries.filter((e) => !kind || e.kind === kind).reduce((s, e) => s + e.amount, 0)
}

export function inMonth(entries: Entry[], key: string) {
  return entries.filter((e) => monthKey(e.date) === key)
}

export function lastMonths(n: number, from = new Date()) {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) keys.push(monthKey(toISODate(addMonths(new Date(from.getFullYear(), from.getMonth(), 1), -i))))
  return keys
}

export interface MonthTotals {
  key: string
  fuel: number
  expense: number
  service: number
  total: number
}

export function monthlyTotals(entries: Entry[], keys: string[]): MonthTotals[] {
  return keys.map((key) => {
    const list = inMonth(entries, key)
    const fuel = sumBy(list, 'fuel')
    const expense = sumBy(list, 'expense')
    const service = sumBy(list, 'service')
    return { key, fuel, expense, service, total: fuel + expense + service }
  })
}

// Custo por km: tudo que foi gasto no período ÷ km rodados no período (pelas leituras de hodômetro)
export function costPerKm(entries: Entry[]) {
  const odos = entries.filter((e) => e.odometer).map((e) => e.odometer!)
  if (odos.length < 2) return null
  const driven = Math.max(...odos) - Math.min(...odos)
  if (driven <= 0) return null
  return sumBy(entries) / driven
}

export function byCategory(entries: Entry[]) {
  const map = new Map<string, { label: string; kind: EntryKind; amount: number }>()
  for (const e of entries) {
    const label = e.kind === 'fuel' ? 'Combustível' : e.category || 'Outros'
    const cur = map.get(label) ?? { label, kind: e.kind, amount: 0 }
    cur.amount += e.amount
    map.set(label, cur)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

export type ReminderState = 'ok' | 'soon' | 'overdue'

export interface ReminderStatus {
  nextKm: number | null
  nextDate: string | null
  kmLeft: number | null
  daysLeft: number | null
  progress: number // 0 a 1 (quanto do intervalo já passou)
  state: ReminderState
}

export function reminderStatus(r: Reminder, odometer: number): ReminderStatus {
  const nextKm = r.interval_km && r.last_km !== null ? r.last_km + r.interval_km : null
  const nextDate =
    r.interval_months && r.last_date ? toISODate(addMonths(parseDate(r.last_date), r.interval_months)) : null
  const kmLeft = nextKm !== null ? nextKm - odometer : null
  const daysLeft = nextDate ? daysBetween(new Date(new Date().toDateString()), parseDate(nextDate)) : null

  const pKm = nextKm !== null && r.interval_km ? (odometer - r.last_km!) / r.interval_km : 0
  const pDate =
    nextDate && r.last_date
      ? daysBetween(parseDate(r.last_date), new Date()) / Math.max(1, daysBetween(parseDate(r.last_date), parseDate(nextDate)))
      : 0
  const progress = Math.max(0, Math.max(pKm, pDate))

  let state: ReminderState = 'ok'
  if ((kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft <= 0)) state = 'overdue'
  else if ((kmLeft !== null && kmLeft <= 1000) || (daysLeft !== null && daysLeft <= 30) || progress >= 0.85) state = 'soon'

  return { nextKm, nextDate, kmLeft, daysLeft, progress, state }
}

// ---------- Relatórios por período ----------
export type Group = 'day' | 'week' | 'month'

export interface Bucket extends MonthTotals {
  label: string // rótulo curto no eixo
  long: string // título no balão
}

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

// Segunda-feira da semana da data
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export function inRange(entries: Entry[], from: string, to: string) {
  return entries.filter((e) => e.date >= from && e.date <= to)
}

export function daysInRange(from: string, to: string) {
  return daysBetween(parseDate(from), parseDate(to)) + 1
}

export function buckets(entries: Entry[], from: string, to: string, group: Group): Bucket[] {
  const start = parseDate(from)
  const end = parseDate(to)
  const out: Bucket[] = []
  let cur = group === 'week' ? weekStart(start) : group === 'month' ? new Date(start.getFullYear(), start.getMonth(), 1) : start
  let guard = 0
  while (cur <= end && guard++ < 400) {
    const next = group === 'day' ? addDays(cur, 1) : group === 'week' ? addDays(cur, 7) : addMonths(cur, 1)
    const a = toISODate(cur < start ? start : cur)
    const lastDay = addDays(next, -1)
    const b = toISODate(lastDay > end ? end : lastDay)
    const list = entries.filter((e) => e.date >= a && e.date <= b)
    const fuel = sumBy(list, 'fuel')
    const expense = sumBy(list, 'expense')
    const service = sumBy(list, 'service')
    const label = group === 'month' ? MONTHS_SHORT[cur.getMonth()] : dm(cur)
    const long =
      group === 'day'
        ? `${cur.getDate()} de ${MONTHS_LONG[cur.getMonth()]}`
        : group === 'week'
          ? `Semana de ${dm(parseDate(a))} a ${dm(parseDate(b))}`
          : `${MONTHS_LONG[cur.getMonth()][0].toUpperCase()}${MONTHS_LONG[cur.getMonth()].slice(1)} de ${cur.getFullYear()}`
    out.push({ key: toISODate(cur), label, long, fuel, expense, service, total: fuel + expense + service })
    cur = next
  }
  return out
}
