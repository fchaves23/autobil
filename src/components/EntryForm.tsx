import { useMemo, useState } from 'react'
import { api } from '../lib/api'
import { num, parseNumber, today } from '../lib/format'
import { EXPENSE_CATEGORIES, FUEL_TYPES, KIND_LABEL, SERVICE_CATEGORIES, type Entry, type EntryKind, type Reminder, type Vehicle } from '../lib/types'
import { DeleteButton, Field, KindIcon, Sheet } from './ui'

interface Props {
  vehicle: Vehicle
  kind: EntryKind
  entry?: Entry
  reminders: Reminder[]
  odometer: number
  onClose: () => void
  onSaved: (message: string) => void
}

const str = (n: number | null | undefined, digits?: number) =>
  n === null || n === undefined ? '' : digits !== undefined ? n.toFixed(digits).replace('.', ',') : String(n).replace('.', ',')

export function EntryForm({ vehicle, kind: initialKind, entry, reminders, odometer, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? initialKind)
  const [date, setDate] = useState(entry?.date ?? today())
  const [odo, setOdo] = useState(str(entry?.odometer))
  const [amount, setAmount] = useState(str(entry?.amount, 2))
  const [liters, setLiters] = useState(str(entry?.liters))
  const [price, setPrice] = useState(str(entry?.price_per_liter))
  const [edited, setEdited] = useState<('amount' | 'liters' | 'price')[]>(entry ? ['amount', 'price'] : [])
  const defaultFuel = vehicle.fuel_type === 'flex' ? 'gasolina' : vehicle.fuel_type
  const [fuelType, setFuelType] = useState(entry?.fuel_type ?? defaultFuel)
  const [fullTank, setFullTank] = useState(entry?.full_tank ?? true)
  const [category, setCategory] = useState(entry?.category ?? '')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [reminderId, setReminderId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const fuelOptions = vehicle.fuel_type === 'flex' ? ['gasolina', 'etanol'] : [vehicle.fuel_type]

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
      if (target === 'amount' && l && p) vals.amount = str(l * p, 2)
      if (target === 'liters' && a && p) vals.liters = str(+(a / p).toFixed(2))
      if (target === 'price' && a && l) vals.price = str(+(a / l).toFixed(3))
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
    if (kind === 'fuel' && !o) return setError('Informe o hodômetro: é com ele que calculamos o consumo.')
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
          full_tank: kind === 'fuel' ? fullTank : true,
          category: kind === 'fuel' ? FUEL_TYPES[fuelType] ?? fuelType : category,
          description: description.trim(),
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

        {kind === 'fuel' && fuelOptions.length > 1 && (
          <div className="chips" role="group" aria-label="Combustível">
            {fuelOptions.map((f) => (
              <button key={f} type="button" className="chip" aria-pressed={fuelType === f} onClick={() => setFuelType(f)}>
                {FUEL_TYPES[f]}
              </button>
            ))}
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
            <input id="entry-date" className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label={kind === 'fuel' ? 'Hodômetro' : 'Hodômetro (opcional)'}>
            <div className="input-wrap">
              <input id="entry-odo" className="input has-suffix num" inputMode="numeric" placeholder={num(odometer)} value={odo} onChange={(e) => setOdo(e.target.value)} />
              <span className="suffix">km</span>
            </div>
          </Field>

          {kind === 'fuel' && (
            <>
              <Field label="Preço por litro">
                <div className="input-wrap">
                  <span className="prefix">R$</span>
                  <input id="entry-price" className="input has-prefix num" inputMode="decimal" placeholder="5,99" value={price} onChange={(e) => onFuelField('price', e.target.value)} />
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
                style={{ fontWeight: 700 }}
              />
            </div>
          </Field>
        </div>

        {kind === 'fuel' && (
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
