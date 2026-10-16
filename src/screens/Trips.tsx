import { useState } from 'react'
import { ChartColumn, Flag, HandCoins, MapPinned, Pencil, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { consumption, daysInRange, sumBy } from '../lib/calc'
import { brl, dateFull, num, today } from '../lib/format'
import { NOT_FUEL, type Entry, type Member, type Trip } from '../lib/types'
import { DeleteButton, Empty, Field, Sheet } from '../components/ui'

export interface TripStats {
  total: number
  fuel: number
  km: number | null
  kml: number | null
  costPerKm: number | null
  liters: number
  days: number
  count: number
}

export function tripStats(trip: Trip, entries: Entry[]): TripStats {
  const list = entries.filter((e) => e.trip_id === trip.id)
  const odos = list.filter((e) => e.odometer).map((e) => e.odometer!)
  const km = odos.length > 1 ? Math.max(...odos) - Math.min(...odos) : null
  const total = sumBy(list)
  return {
    total,
    fuel: sumBy(list, 'fuel'),
    km,
    kml: consumption(list).average,
    costPerKm: km ? total / km : null,
    liters: list.filter((e) => e.kind === 'fuel' && !NOT_FUEL.has(e.fuel_type ?? '')).reduce((s, e) => s + (e.liters ?? 0), 0),
    days: daysInRange(trip.start_date, trip.end_date ?? today()),
    count: list.length,
  }
}

function TripCard({
  trip,
  stats,
  onEdit,
  onReport,
  onSettle,
  onFinish,
}: {
  trip: Trip
  stats: TripStats
  onEdit: () => void
  onReport: () => void
  onSettle: () => void
  onFinish?: () => void
}) {
  const active = !trip.end_date
  return (
    <section className={`card stack trip-card${active ? ' trip-active' : ''}`}>
      <div className="section-head" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <span className={`badge ${active ? 'soon' : 'neutral'}`}>{active ? 'Em andamento' : 'Encerrada'}</span>
          <h2 className="section-title" style={{ marginTop: 6 }}>
            {trip.name}
          </h2>
          <p className="hint">
            {active ? `Desde ${dateFull(trip.start_date)}` : `${dateFull(trip.start_date)} a ${dateFull(trip.end_date!)}`} · {stats.days}{' '}
            {stats.days === 1 ? 'dia' : 'dias'}
          </p>
        </div>
        <button className="icon-btn" onClick={onEdit} aria-label={`Editar ${trip.name}`}>
          <Pencil size={17} />
        </button>
      </div>
      <div className="trip-stats">
        <div>
          <span className="stat-label">Gasto</span>
          <strong className="num">{brl(stats.total)}</strong>
        </div>
        <div>
          <span className="stat-label">Rodados</span>
          <strong className="num">{stats.km !== null ? `${num(stats.km)} km` : '—'}</strong>
        </div>
        <div>
          <span className="stat-label">Consumo</span>
          <strong className="num">{stats.kml !== null ? `${num(stats.kml, 1)} km/l` : '—'}</strong>
        </div>
        <div>
          <span className="stat-label">Custo/km</span>
          <strong className="num">{stats.costPerKm !== null ? brl(stats.costPerKm) : '—'}</strong>
        </div>
      </div>
      <div className="share-actions">
        <button className="btn btn-sm" onClick={onReport} disabled={stats.count === 0}>
          <ChartColumn size={16} /> Relatório da viagem
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onSettle} disabled={stats.count === 0}>
          <HandCoins size={16} /> Acerto
        </button>
        {active && onFinish && (
          <button className="btn btn-sm btn-ghost" onClick={onFinish}>
            <Flag size={16} /> Encerrar viagem
          </button>
        )}
      </div>
      <span className="hint">{stats.count === 0 ? 'Nenhum lançamento nesta viagem ainda.' : `${stats.count} lançamentos`}</span>
    </section>
  )
}

export function Trips({
  trips,
  entries,
  onAdd,
  onEdit,
  onReport,
  onSettle,
  onChanged,
}: {
  trips: Trip[]
  entries: Entry[]
  onAdd: () => void
  onEdit: (t: Trip) => void
  onReport: (t: Trip) => void
  onSettle: (t: Trip) => void
  onChanged: (msg: string) => void
}) {
  const active = trips.filter((t) => !t.end_date)
  const past = trips.filter((t) => t.end_date)

  return (
    <div className="page">
      <div className="section-head">
        <h1 className="page-title">Viagens</h1>
        <button className="btn btn-sm" onClick={onAdd}>
          <Plus size={16} /> Nova viagem
        </button>
      </div>
      <p className="ink-2" style={{ marginTop: -10 }}>
        Separe os gastos de cada viagem. Tudo continua somando nos números gerais do carro.
      </p>

      {trips.length === 0 ? (
        <div className="card">
          <Empty
            icon={<MapPinned size={24} />}
            title="Nenhuma viagem ainda"
            text="Crie uma viagem (ex.: Sul do Brasil). Enquanto ela estiver em andamento, os lançamentos novos entram nela automaticamente."
            action={
              <button className="btn" onClick={onAdd}>
                Criar viagem
              </button>
            }
          />
        </div>
      ) : (
        <>
          {active.map((t) => (
            <TripCard
              key={t.id}
              trip={t}
              stats={tripStats(t, entries)}
              onEdit={() => onEdit(t)}
              onReport={() => onReport(t)}
              onSettle={() => onSettle(t)}
              onFinish={async () => {
                await api.saveTrip({ ...t, end_date: today() < t.start_date ? t.start_date : today() }, t.id)
                onChanged(`Viagem ${t.name} encerrada`)
              }}
            />
          ))}
          {past.length > 0 && <h2 className="section-title">Viagens anteriores</h2>}
          {past.map((t) => (
            <TripCard key={t.id} trip={t} stats={tripStats(t, entries)} onEdit={() => onEdit(t)} onReport={() => onReport(t)} onSettle={() => onSettle(t)} />
          ))}
        </>
      )}
    </div>
  )
}

export function TripForm({
  vehicleId,
  trip,
  members,
  onClose,
  onSaved,
}: {
  vehicleId: string
  trip?: Trip
  members: Member[]
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [name, setName] = useState(trip?.name ?? '')
  const [start, setStart] = useState(trip?.start_date ?? today())
  const [ongoing, setOngoing] = useState(trip ? !trip.end_date : true)
  const [end, setEnd] = useState(trip?.end_date ?? today())
  const [notes, setNotes] = useState(trip?.notes ?? '')
  // Vazio = todas as pessoas do carro dividem os custos
  const [participants, setParticipants] = useState<string[]>(trip?.participants?.length ? trip.participants : members.map((m) => m.user_id))
  const toggle = (id: string) => setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <Sheet title={trip ? 'Editar viagem' : 'Nova viagem'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          if (!name.trim()) return setError('Dê um nome à viagem, como "Sul do Brasil".')
          if (!ongoing && end < start) return setError('A data de fim precisa ser depois do início.')
          if (members.length > 1 && participants.length === 0) return setError('Escolha pelo menos uma pessoa para dividir os custos.')
          const all = members.every((m) => participants.includes(m.user_id))
          setBusy(true)
          try {
            await api.saveTrip(
              {
                vehicle_id: vehicleId,
                name: name.trim(),
                start_date: start,
                end_date: ongoing ? null : end,
                notes: notes.trim(),
                participants: all ? [] : participants,
              },
              trip?.id,
            )
            onSaved(trip ? 'Viagem atualizada' : `Viagem ${name.trim()} criada`)
          } catch (err) {
            setError((err as Error).message)
            setBusy(false)
          }
        }}
      >
        <Field label="Nome da viagem">
          <input id="trip-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Sul do Brasil" autoFocus={!trip} />
        </Field>
        <div className="form-grid">
          <Field label="Início">
            <input id="trip-start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          {!ongoing && (
            <Field label="Fim">
              <input id="trip-end" className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          )}
        </div>
        <label className="switch">
          <span>
            <strong>Viagem em andamento</strong>
            <br />
            <span className="hint">Os lançamentos novos entram nela automaticamente.</span>
          </span>
          <input id="trip-ongoing" type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
        </label>
        {members.length > 1 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="label">Quem divide os custos</span>
            <div className="chips">
              {members.map((m) => (
                <button key={m.user_id} type="button" className="chip" aria-pressed={participants.includes(m.user_id)} onClick={() => toggle(m.user_id)}>
                  {m.name || m.email}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Anotações (opcional)">
          <input id="trip-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Roteiro, quem foi…" />
        </Field>
        {error && <div className="error">{error}</div>}
        <div className="sheet-actions">
          {trip && (
            <DeleteButton
              label="Excluir viagem"
              onConfirm={async () => {
                await api.deleteTrip(trip.id)
                onSaved('Viagem excluída. Os lançamentos continuam no carro.')
              }}
            />
          )}
          <button className="btn" disabled={busy}>
            {busy ? 'Salvando…' : trip ? 'Salvar' : 'Criar viagem'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
