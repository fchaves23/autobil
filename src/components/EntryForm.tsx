import { useMemo, useState } from 'react'
import { api } from '../lib/api'
import { formatIntInput, formatMoneyInput, num, parseNumber, today } from '../lib/format'
import {
  EXPENSE_CATEGORIES,
  FUEL_KINDS,
  FUEL_KINDS_BY_ENGINE,
  KIND_LABEL,
  NOT_FUEL,
  SERVICE_CATEGORIES,
  fuelLabel,
  type Entry,
  type EntryKind,
  type Reminder,
  type Trip,
  type Vehicle,
} from '../lib/types'
import { DeleteButton, Field, KindIcon, Sheet } from './ui'

interface Props {
  vehicle: Vehicle
  kind: EntryKind
  entry?: Entry
  reminders: Reminder[]
  trips: Trip[]
  lastFuelType: string | null
  odometer: number
  onClose: () => void
  onSaved: (message: string) => void
}

const str = (n: number | null | undefined, digits?: number) =>
  n === null || n === undefined ? '' : digits !== undefined ? n.toFixed(digits).replace('.', ',') : String(n).replace('.', ',')

// Viagem que está valendo numa data (a mais recente que já começou e não terminou)
export function tripForDate(trips: Trip[], date: string) {
  return trips.find((t) => t.start_date <= date && (!t.end_date || t.end_date >= date)) ?? null
}

export function EntryForm({ vehicle, kind: initialKind, entry, reminders, trips, lastFuelType, odometer, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? initialKind)
  const [date, setDate] = useState(entry?.date ?? today())
  const [odo, setOdo] = useState(entry?.odometer != null ? formatIntInput(String(entry.odometer)) : '')
  const [amount, setAmount] = useState(entry ? formatMoneyInput(String(entry.amount)) : '')
  const [liters, setLiters] = useState(str(entry?.liters))
  const [price, setPrice] = useState(entry?.price_per_liter != null ? formatMoneyInput(String(entry.price_per_liter), 3) : '')
  const [edited, setEdited] = useState<('amount' | 'liters' | 'price')[]>(entry ? ['amount', 'price'] : [])
  const suggested = FUEL_KINDS_BY_ENGINE[vehicle.fuel_type] ?? Object.keys(FUEL_KINDS)
  // Novo abastecimento já vem com o último combustível usado neste carro
  // "diesel" genérico é de lançamentos antigos: num novo, sugere S10 / o primeiro da lista
  const [fuelType, setFuelType] = useState(entry?.fuel_type ?? (lastFuelType && FUEL_KINDS[lastFuelType] && lastFuelType !== 'diesel' ? lastFuelType : suggested[0]))
  const [showAllFuels, setShowAllFuels] = useState(false)
  const [tripId, setTripId] = useState<string>(entry ? entry.trip_id ?? '' : tripForDate(trips, today())?.id ?? '')
  const [tripTouched, setTripTouched] = useState(!!entry)
  const [fullTank, setFullTank] = useState(entry?.full_tank ?? true)
  const [category, setCategory] = useState(entry?.category ?? '')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [reminderId, setReminderId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isArla = kind === 'fuel' && NOT_FUEL.has(fuelType)
  const extraFuels = Object.keys(FUEL_KINDS).filter((k) => !suggested.includes(k) && (k !== 'diesel' || fuelType === 'diesel'))
  const fuelOptions = [...suggested, ...(showAllFuels ? extraFuels : extraFuels.filter((k) => k === fuelType))]

  // Preenche o terceiro campo do abastecimento a partir dos dois últimos editados
  function onFuelField(field: 'amount' | 'liters' | 'price', value: string) {
    const vals = { amount, liters, price, [field]: value }
    const order = [field, ...edited.filter((f) => f !== field)].slice(0, 2) as ('amount' | 'liters' | 'price')[]
    setEdited(order)
    const a = parseNumber(vals.amount)
    const l = parseNumber(vals.liters)
    const p = parseNumber(vals.price)
    const target = (['amount', 'liters', 'price'] as const).find((f) => !order.includes(f))
    if (order.length === 2) {
      if (target === 'amount' && l && p) vals.amount = formatMoneyInput(String(+(l * p).toFixed(2)))
      if (target === 'liters' && a && p) vals.liters = str(+(a / p).toFixed(2))
      if (target === 'price' && a && l) vals.price = formatMoneyInput(String(+(a / l).toFixed(3)), 3)
    }
    setAmount(vals.amount)
    setLiters(vals.liters)
    setPrice(vals.price)
  }

  const matchingReminder = useMemo(
    () => reminders.find((r) => r.title.toLowerCase() === category.toLowerCase())?.id ?? '',
    [reminders, category],
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const a = parseNumber(amount)
    const o = parseNumber(odo)
    const l = parseNumber(liters)
    const p = parseNumber(price)
    if (!a || a <= 0) return setError('Informe o valor.')
    if (kind === 'fuel' && (!l || !p)) return setError('Informe litros e preço por litro (ou o total).')
    if (kind === 'fuel' && !isArla && !o) return setError('Informe o hodômetro: é com ele que calculamos o consumo.')
    if (kind !== 'fuel' && !category) return setError('Escolha uma categoria.')
    setBusy(true)
    try {
      await api.saveEntry(
        {
          vehicle_id: vehicle.id,
          kind,
          date,
          odometer: o,
          amount: a,
          liters: kind === 'fuel' ? l : null,
          price_per_liter: kind === 'fuel' ? p : null,
          fuel_type: kind === 'fuel' ? fuelType : null,
          full_tank: kind === 'fuel' && !isArla ? fullTank : true,
          category: kind === 'fuel' ? fuelLabel(fuelType) : category,
          description: description.trim(),
          trip_id: tripId || null,
        },
        entry?.id,
      )
      const rid = reminderId || (kind === 'service' && !entry ? matchingReminder : '')
      const r = reminders.find((x) => x.id === rid)
      if (r) {
        await api.saveReminder({ ...r, last_km: o ?? odometer, last_date: date }, r.id)
      }
      onSaved(entry ? 'Lançamento atualizado' : `${KIND_LABEL[kind]} salvo`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title={entry ? `Editar ${KIND_LABEL[kind].toLowerCase()}` : 'Novo lançamento'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        {!entry && (
          <div className="segmented" role="group" aria-label="Tipo">
            {(['fuel', 'expense', 'service'] as EntryKind[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k)
                  setCategory('')
                }}
              >
                <KindIcon kind={k} size={16} />
                {k === 'fuel' ? 'Abastecer' : k === 'expense' ? 'Despesa' : 'Serviço'}
              </button>
            ))}
          </div>
        )}

        {kind === 'fuel' && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="label">Combustível</span>
            <div className="chips" role="group" aria-label="Combustível">
              {fuelOptions.map((f) => (
                <button key={f} type="button" className="chip" aria-pressed={fuelType === f} onClick={() => setFuelType(f)}>
                  {FUEL_KINDS[f]}
                </button>
              ))}
              {!showAllFuels && extraFuels.some((k) => k !== fuelType) && (
                <button type="button" className="chip chip-more" onClick={() => setShowAllFuels(true)}>
                  Outros…
                </button>
              )}
            </div>
            {isArla && <span className="hint">Arla 32 entra no custo, mas não conta no consumo (km/l).</span>}
          </div>
        )}

        {kind !== 'fuel' && (
          <Field label="Categoria">
            <select id="entry-category" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Escolha…</option>
              {(kind === 'expense' ? EXPENSE_CATEGORIES : SERVICE_CATEGORIES).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        )}

        <div className="form-grid">
          <Field label="Data">
            <input
              id="entry-date"
              className="input"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => {
                setDate(e.target.value)
                if (!tripTouched) setTripId(tripForDate(trips, e.target.value)?.id ?? '')
              }}
              required
            />
          </Field>
          <Field label={kind === 'fuel' && !isArla ? 'Hodômetro' : 'Hodômetro (opcional)'}>
            <div className="input-wrap">
              <input id="entry-odo" className="input has-suffix num" inputMode="numeric" placeholder={num(odometer)} value={odo} onChange={(e) => setOdo(e.target.value)} onBlur={() => setOdo(formatIntInput(odo))} />
              <span className="suffix">km</span>
            </div>
          </Field>

          {kind === 'fuel' && (
            <>
              <Field label="Preço por litro">
                <div className="input-wrap">
                  <span className="prefix">R$</span>
                  <input id="entry-price" className="input has-prefix num" inputMode="decimal" placeholder="5,99" value={price} onChange={(e) => onFuelField('price', e.target.value.replace('.', ','))} onBlur={() => setPrice(formatMoneyInput(price, 3))} />
                </div>
              </Field>
              <Field label="Litros">
                <div className="input-wrap">
                  <input id="entry-liters" className="input has-suffix num" inputMode="decimal" placeholder="40" value={liters} onChange={(e) => onFuelField('liters', e.target.value)} />
                  <span className="suffix">L</span>
                </div>
              </Field>
            </>
          )}

          <Field label={kind === 'fuel' ? 'Total pago' : 'Valor'} full hint={kind === 'fuel' ? 'Preencha dois dos três campos e o terceiro é calculado.' : undefined}>
            <div className="input-wrap">
              <span className="prefix">R$</span>
              <input
                id="entry-amount"
                className="input has-prefix num"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => (kind === 'fuel' ? onFuelField('amount', e.target.value) : setAmount(e.target.value))}
                onBlur={() => setAmount(formatMoneyInput(amount))}
                style={{ fontWeight: 700 }}
              />
            </div>
          </Field>
        </div>

        {kind === 'fuel' && !isArla && (
          <label className="switch">
            <span>
              <strong>Tanque cheio</strong>
              <br />
              <span className="hint">Necessário para calcular o consumo (km/l).</span>
            </span>
            <input id="entry-full" type="checkbox" checked={fullTank} onChange={(e) => setFullTank(e.target.checked)} />
          </label>
        )}

        {kind === 'service' && reminders.length > 0 && (
          <Field label="Concluir lembrete" hint="O lembrete reinicia a contagem a partir desta data e km.">
            <select id="entry-reminder" className="select" value={reminderId || matchingReminder} onChange={(e) => setReminderId(e.target.value || 'none')}>
              <option value="none">Nenhum</option>
              {reminders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        {trips.length > 0 && (
          <Field label="Viagem" hint={tripId ? 'Conta no total do carro e também nesta viagem.' : 'Fica só nos números gerais do carro.'}>
            <select
              id="entry-trip"
              className="select"
              value={tripId}
              onChange={(e) => {
                setTripId(e.target.value)
                setTripTouched(true)
              }}
            >
              <option value="">Nenhuma viagem</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {!t.end_date ? ' (em andamento)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Observação (opcional)">
          <input id="entry-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === 'fuel' ? 'Posto, cidade…' : 'Detalhes'} />
        </Field>

        {error && <div className="error">{error}</div>}

        <div className="sheet-actions">
          {entry && (
            <DeleteButton
              onConfirm={async () => {
                await api.deleteEntry(entry.id)
                onSaved('Lançamento excluído')
              }}
            />
          )}
          <button className="btn" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
