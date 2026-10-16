// Modo sem internet: guarda os últimos dados no celular e põe os lançamentos
// feitos sem sinal numa fila, que é enviada sozinha quando a conexão volta.
import { api } from './api'
import type { Entry, EntryInput, Profile } from './types'

type QueueItem = { op: 'save'; id: string; input: EntryInput; at: string } | { op: 'delete'; id: string; vehicle_id: string; at: string }

const QUEUE_KEY = 'autobil-outbox-v1'
const listeners = new Set<() => void>()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sem espaço ou armazenamento bloqueado: segue sem cache */
  }
}

// ---------- Cache dos dados ----------
export const cacheSet = (key: string, data: unknown) => write(`autobil-cache-${key}`, data)
export const cacheGet = <T>(key: string): T | null => read<T | null>(`autobil-cache-${key}`, null)

export function isNetworkError(err: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String((err as Error)?.message ?? err).toLowerCase()
  return /sem conex|failed to fetch|network|load failed|fetch/.test(msg)
}

// ---------- Fila de envio ----------
export const getQueue = () => read<QueueItem[]>(QUEUE_KEY, [])
const setQueue = (q: QueueItem[]) => {
  write(QUEUE_KEY, q)
  listeners.forEach((l) => l())
}
export function onQueueChange(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

// Salva o lançamento; sem internet, guarda na fila. Responde se foi enviado ou ficou na fila.
export async function saveEntrySafe(input: EntryInput, id?: string): Promise<'sent' | 'queued'> {
  const eid = id ?? newId()
  const pending = getQueue().some((q) => q.id === eid)
  if (!pending) {
    try {
      await api.saveEntry(input, eid)
      return 'sent'
    } catch (err) {
      if (!isNetworkError(err)) throw err
    }
  }
  // Mantém só a versão mais nova de cada lançamento na fila
  setQueue([...getQueue().filter((q) => q.id !== eid), { op: 'save', id: eid, input, at: new Date().toISOString() }])
  return 'queued'
}

export async function deleteEntrySafe(id: string, vehicleId: string): Promise<'sent' | 'queued'> {
  const queue = getQueue()
  const queuedSave = queue.find((q) => q.id === id && q.op === 'save')
  // Ainda não tinha sido enviado: basta tirar da fila
  if (queuedSave && !navigator.onLine) {
    setQueue(queue.filter((q) => q.id !== id))
    return 'queued'
  }
  try {
    await api.deleteEntry(id)
    setQueue(getQueue().filter((q) => q.id !== id))
    return 'sent'
  } catch (err) {
    if (!isNetworkError(err)) throw err
    setQueue([...queue.filter((q) => q.id !== id), { op: 'delete', id, vehicle_id: vehicleId, at: new Date().toISOString() }])
    return 'queued'
  }
}

let flushing = false

// Envia o que estiver na fila. Para no primeiro erro de rede; descarta o que o servidor recusar.
export async function flushQueue(): Promise<{ sent: number; failed: string[] }> {
  if (flushing) return { sent: 0, failed: [] }
  flushing = true
  let sent = 0
  const failed: string[] = []
  try {
    for (const item of getQueue()) {
      try {
        if (item.op === 'save') await api.saveEntry(item.input, item.id)
        else await api.deleteEntry(item.id)
        sent++
        setQueue(getQueue().filter((q) => q !== item && !(q.id === item.id && q.at === item.at)))
      } catch (err) {
        if (isNetworkError(err)) break
        failed.push((err as Error).message)
        setQueue(getQueue().filter((q) => !(q.id === item.id && q.at === item.at)))
      }
    }
  } finally {
    flushing = false
  }
  return { sent, failed }
}

// Junta a fila aos lançamentos carregados, para a tela mostrar tudo (com o aviso "aguardando sinal")
export function withQueue(entries: Entry[], vehicleId: string, user: Profile | null): Entry[] {
  const queue = getQueue()
  if (!queue.length) return entries
  let list = [...entries]
  for (const q of queue) {
    if (q.op === 'delete') {
      list = list.filter((e) => e.id !== q.id)
      continue
    }
    if (q.input.vehicle_id !== vehicleId) continue
    const existing = list.find((e) => e.id === q.id)
    const merged: Entry = {
      ...(existing ?? { id: q.id, user_id: user?.id ?? null, user_name: user?.name ?? '', created_at: q.at }),
      ...q.input,
      pending: true,
    } as Entry
    list = existing ? list.map((e) => (e.id === q.id ? merged : e)) : [merged, ...list]
  }
  return list.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
}
