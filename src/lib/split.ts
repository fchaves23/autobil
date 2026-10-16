// Acerto de contas: quem pagou, quanto é a parte de cada um e quem deve a quem.
import type { Entry, Settlement } from './types'

export interface PersonBalance {
  id: string
  paid: number // gastos divididos que a pessoa pagou
  share: number // parte que cabe a ela
  sent: number // pagamentos de acerto que ela fez
  received: number // pagamentos de acerto que ela recebeu
  balance: number // > 0: tem a receber; < 0: deve
}

export interface Transfer {
  from: string
  to: string
  amount: number
}

export interface SplitResult {
  total: number
  perPerson: PersonBalance[]
  transfers: Transfer[]
  count: number
}

const cents = (n: number) => Math.round(n * 100) / 100

export function computeSplit(entries: Entry[], settlements: Settlement[], participants: string[]): SplitResult {
  const shared = entries.filter((e) => e.split && e.amount > 0)
  const total = shared.reduce((s, e) => s + e.amount, 0)
  const people = new Map<string, PersonBalance>()
  const person = (id: string) => {
    if (!people.has(id)) people.set(id, { id, paid: 0, share: 0, sent: 0, received: 0, balance: 0 })
    return people.get(id)!
  }

  participants.forEach((p) => person(p))
  const n = participants.length || 1
  participants.forEach((p) => (person(p).share = total / n))

  // Quem pagou e não participa da divisão (ex.: alguém de fora da viagem) também é reembolsado
  for (const e of shared) {
    const payer = e.paid_by ?? e.user_id
    if (payer) person(payer).paid += e.amount
  }
  for (const s of settlements) {
    person(s.from_user).sent += s.amount
    person(s.to_user).received += s.amount
  }

  const perPerson = [...people.values()].map((p) => ({ ...p, balance: cents(p.paid - p.share + p.sent - p.received) }))

  // Quita com o menor número de transferências: maior devedor paga ao maior credor
  const debtors = perPerson.filter((p) => p.balance < -0.009).map((p) => ({ id: p.id, v: -p.balance }))
  const creditors = perPerson.filter((p) => p.balance > 0.009).map((p) => ({ id: p.id, v: p.balance }))
  debtors.sort((a, b) => b.v - a.v)
  creditors.sort((a, b) => b.v - a.v)
  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = cents(Math.min(debtors[i].v, creditors[j].v))
    if (amount > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount })
    debtors[i].v = cents(debtors[i].v - amount)
    creditors[j].v = cents(creditors[j].v - amount)
    if (debtors[i].v <= 0.009) i++
    if (creditors[j].v <= 0.009) j++
  }

  return { total: cents(total), perPerson: perPerson.sort((a, b) => b.balance - a.balance), transfers, count: shared.length }
}
