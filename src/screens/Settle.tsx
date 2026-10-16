import { useMemo, useState } from 'react'
import { ArrowRight, HandCoins, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { brl, dateFull, formatMoneyInput, parseNumber, today } from '../lib/format'
import { computeSplit } from '../lib/split'
import type { Entry, Member, Settlement, Trip } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { Empty, Field, Sheet } from '../components/ui'

interface Props {
  vehicleId: string
  userId: string
  entries: Entry[]
  trips: Trip[]
  settlements: Settlement[]
  members: Member[]
  initialScope: string | null // id da viagem ou null (geral)
  onChanged: (msg: string) => void
}

export function Settle({ vehicleId, userId, entries, trips, settlements, members, initialScope, onChanged }: Props) {
  const [scope, setScope] = useState<string>(initialScope ?? 'general')
  const [paying, setPaying] = useState<{ from: string; to: string; amount: number } | null>(null)
  const trip = trips.find((t) => t.id === scope) ?? null

  const name = (id: string) => (id === userId ? 'Você' : members.find((m) => m.user_id === id)?.name || 'Alguém')
  const member = (id: string) => members.find((m) => m.user_id === id)
  const realName = (id: string) => member(id)?.name || member(id)?.email || '?'

  // Viagem: lançamentos e pagamentos dela. Geral: o que ficou fora de viagens.
  const scopeEntries = useMemo(() => entries.filter((e) => (trip ? e.trip_id === trip.id : !e.trip_id) && !e.pending), [entries, trip])
  const scopeSettlements = useMemo(() => settlements.filter((s) => (trip ? s.trip_id === trip.id : !s.trip_id)), [settlements, trip])
  const participants = trip && trip.participants.length ? trip.participants : members.map((m) => m.user_id)
  const result = useMemo(() => computeSplit(scopeEntries, scopeSettlements, participants), [scopeEntries, scopeSettlements, participants])
  const notSplit = scopeEntries.filter((e) => !e.split).length

  return (
    <div className="page">
      <h1 className="page-title">Acerto de contas</h1>
      <p className="ink-2" style={{ marginTop: -10 }}>
        Quem pagou o quê e quanto cada um deve. Os gastos marcados para dividir são repartidos igualmente entre os participantes.
      </p>

      <section className="card stack">
        <Field label="Acerto de">
          <select id="settle-scope" className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="general">Gastos do carro fora de viagens</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                Viagem: {t.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="settle-summary">
          <div>
            <span className="stat-label">Total dividido</span>
            <strong className="num">{brl(result.total)}</strong>
          </div>
          <div>
            <span className="stat-label">Cada um ({participants.length})</span>
            <strong className="num">{brl(participants.length ? result.total / participants.length : 0)}</strong>
          </div>
        </div>
        <p className="hint">
          {result.count} {result.count === 1 ? 'gasto dividido' : 'gastos divididos'}{notSplit ? ` · ${notSplit} fora da divisão (pessoais)` : ''}
          {trip && trip.participants.length ? ` · participantes definidos na viagem` : ''}
        </p>
      </section>

      {result.count === 0 && scopeSettlements.length === 0 ? (
        <div className="card">
          <Empty
            icon={<HandCoins size={24} />}
            title="Nada para acertar aqui"
            text="Quando alguém lançar um gasto marcado para dividir, o saldo de cada pessoa aparece aqui."
          />
        </div>
      ) : (
        <>
          <section className="card stack">
            <h2 className="section-title">Como acertar</h2>
            {result.transfers.length === 0 ? (
              <div className="notice" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}>
                ✓ Tudo certo! Ninguém deve nada.
              </div>
            ) : (
              <div className="list">
                {result.transfers.map((t) => (
                  <div key={`${t.from}-${t.to}`} className="row transfer">
                    <Avatar name={realName(t.from)} url={member(t.from)?.avatar_url} small />
                    <span className="row-main">
                      <span className="row-title" style={{ display: 'block', whiteSpace: 'normal' }}>
                        {name(t.from)} paga <ArrowRight size={14} style={{ verticalAlign: -2 }} /> {name(t.to)}
                      </span>
                      <span className="row-sub" style={{ display: 'block' }}>
                        Pix, dinheiro… depois registre aqui
                      </span>
                    </span>
                    <span className="row-end">
                      <span className="row-amount" style={{ display: 'block' }}>
                        {brl(t.amount)}
                      </span>
                      <button className="link" style={{ fontSize: 13 }} onClick={() => setPaying(t)}>
                        Registrar pagamento
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card stack">
            <h2 className="section-title">Por pessoa</h2>
            <div className="list">
              {result.perPerson.map((p) => (
                <div key={p.id} className="row">
                  <Avatar name={realName(p.id)} url={member(p.id)?.avatar_url} small />
                  <span className="row-main">
                    <span className="row-title" style={{ display: 'block' }}>
                      {name(p.id)}
                    </span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      Pagou {brl(p.paid)} · parte {brl(p.share)}
                      {p.sent || p.received ? ` · acertos ${brl(p.sent - p.received)}` : ''}
                    </span>
                  </span>
                  <span className={`badge ${p.balance > 0.009 ? 'ok' : p.balance < -0.009 ? 'overdue' : 'neutral'}`}>
                    {p.balance > 0.009 ? `recebe ${brl(p.balance)}` : p.balance < -0.009 ? `deve ${brl(-p.balance)}` : 'quite'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {scopeSettlements.length > 0 && (
            <section className="card stack">
              <h2 className="section-title">Pagamentos registrados</h2>
              <div className="list">
                {scopeSettlements.map((s) => (
                  <div key={s.id} className="row">
                    <span className="row-icon k-service">
                      <HandCoins size={18} />
                    </span>
                    <span className="row-main">
                      <span className="row-title" style={{ display: 'block' }}>
                        {name(s.from_user)} pagou {name(s.to_user)}
                      </span>
                      <span className="row-sub" style={{ display: 'block' }}>
                        {dateFull(s.date)}
                        {s.note ? ` · ${s.note}` : ''}
                      </span>
                    </span>
                    <span className="row-amount">{brl(s.amount)}</span>
                    <button
                      className="icon-btn"
                      aria-label="Apagar pagamento"
                      onClick={async () => {
                        await api.deleteSettlement(s.id)
                        onChanged('Pagamento apagado')
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {paying && (
        <PaymentForm
          initial={paying}
          people={participants}
          name={name}
          onClose={() => setPaying(null)}
          onSave={async (from, to, amount, date, note) => {
            await api.saveSettlement({ vehicle_id: vehicleId, trip_id: trip?.id ?? null, from_user: from, to_user: to, amount, date, note })
            setPaying(null)
            onChanged('Pagamento registrado')
          }}
        />
      )}
    </div>
  )
}

function PaymentForm({
  initial,
  people,
  name,
  onClose,
  onSave,
}: {
  initial: { from: string; to: string; amount: number }
  people: string[]
  name: (id: string) => string
  onClose: () => void
  onSave: (from: string, to: string, amount: number, date: string, note: string) => Promise<void>
}) {
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [amount, setAmount] = useState(formatMoneyInput(String(initial.amount)))
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const everyone = [...new Set([...people, initial.from, initial.to])]

  return (
    <Sheet title="Registrar pagamento" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          const v = parseNumber(amount)
          if (!v || v <= 0) return setError('Informe o valor.')
          if (from === to) return setError('Escolha duas pessoas diferentes.')
          setBusy(true)
          try {
            await onSave(from, to, v, date, note.trim())
          } catch (err) {
            setError((err as Error).message)
            setBusy(false)
          }
        }}
      >
        <div className="form-grid">
          <Field label="Quem pagou">
            <select id="pay-from" className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
              {everyone.map((p) => (
                <option key={p} value={p}>
                  {name(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Para quem">
            <select id="pay-to" className="select" value={to} onChange={(e) => setTo(e.target.value)}>
              {everyone.map((p) => (
                <option key={p} value={p}>
                  {name(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valor">
            <div className="input-wrap">
              <span className="prefix">R$</span>
              <input id="pay-amount" className="input has-prefix num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => setAmount(formatMoneyInput(amount))} />
            </div>
          </Field>
          <Field label="Data">
            <input id="pay-date" className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Observação (opcional)">
          <input id="pay-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Pix" />
        </Field>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-block" disabled={busy}>
          {busy ? 'Salvando…' : 'Registrar pagamento'}
        </button>
      </form>
    </Sheet>
  )
}
