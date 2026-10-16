import { useState } from 'react'
import { api } from '../lib/api'
import { num, parseNumber, today } from '../lib/format'
import { FUEL_TYPES, type Reminder, type Vehicle } from '../lib/types'
import { DeleteButton, Field, Sheet } from './ui'

const PRESETS = [
  { title: 'Troca de óleo', km: 10000, months: 12 },
  { title: 'Revisão', km: 10000, months: 12 },
  { title: 'Rodízio de pneus', km: 10000, months: null },
  { title: 'Alinhamento e balanceamento', km: 10000, months: null },
  { title: 'Licenciamento', km: null, months: 12 },
]

export function ReminderForm({
  vehicleId,
  reminder,
  odometer,
  onClose,
  onSaved,
}: {
  vehicleId: string
  reminder?: Reminder
  odometer: number
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [title, setTitle] = useState(reminder?.title ?? '')
  const [everyKm, setEveryKm] = useState(reminder?.interval_km ? String(reminder.interval_km) : '')
  const [everyMonths, setEveryMonths] = useState(reminder?.interval_months ? String(reminder.interval_months) : '')
  const [lastKm, setLastKm] = useState(reminder?.last_km != null ? String(reminder.last_km) : String(Math.round(odometer)))
  const [lastDate, setLastDate] = useState(reminder?.last_date ?? today())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const km = parseNumber(everyKm)
    const months = parseNumber(everyMonths)
    if (!title.trim()) return setError('Dê um nome ao lembrete.')
    if (!km && !months) return setError('Defina a cada quantos km ou meses.')
    setBusy(true)
    try {
      await api.saveReminder(
        {
          vehicle_id: vehicleId,
          title: title.trim(),
          interval_km: km ? Math.round(km) : null,
          interval_months: months ? Math.round(months) : null,
          last_km: parseNumber(lastKm),
          last_date: lastDate || null,
        },
        reminder?.id,
      )
      onSaved(reminder ? 'Lembrete atualizado' : 'Lembrete criado')
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title={reminder ? 'Editar lembrete' : 'Novo lembrete'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        {!reminder && (
          <div className="chips">
            {PRESETS.map((p) => (
              <button
                key={p.title}
                type="button"
                className="chip"
                aria-pressed={title === p.title}
                onClick={() => {
                  setTitle(p.title)
                  setEveryKm(p.km ? String(p.km) : '')
                  setEveryMonths(p.months ? String(p.months) : '')
                }}
              >
                {p.title}
              </button>
            ))}
          </div>
        )}
        <Field label="Nome">
          <input id="rem-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Troca de óleo" />
        </Field>
        <div className="form-grid">
          <Field label="A cada (km)">
            <div className="input-wrap">
              <input id="rem-km" className="input has-suffix num" inputMode="numeric" value={everyKm} onChange={(e) => setEveryKm(e.target.value)} placeholder="10000" />
              <span className="suffix">km</span>
            </div>
          </Field>
          <Field label="Ou a cada (meses)">
            <div className="input-wrap">
              <input id="rem-months" className="input has-suffix num" inputMode="numeric" value={everyMonths} onChange={(e) => setEveryMonths(e.target.value)} placeholder="12" />
              <span className="suffix">meses</span>
            </div>
          </Field>
          <Field label="Última vez (km)">
            <input id="rem-lastkm" className="input num" inputMode="numeric" value={lastKm} onChange={(e) => setLastKm(e.target.value)} />
          </Field>
          <Field label="Última vez (data)">
            <input id="rem-lastdate" className="input" type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} />
          </Field>
        </div>
        <p className="hint">O aviso aparece pelo que vencer primeiro: km ou data. Hodômetro atual: {num(odometer)} km.</p>
        {error && <div className="error">{error}</div>}
        <div className="sheet-actions">
          {reminder && (
            <DeleteButton
              onConfirm={async () => {
                await api.deleteReminder(reminder.id)
                onSaved('Lembrete excluído')
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

export function VehicleForm({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle?: Vehicle
  onClose: () => void
  onSaved: (msg: string, vehicleId?: string) => void
}) {
  const [name, setName] = useState(vehicle?.name ?? '')
  const [brand, setBrand] = useState(vehicle?.brand ?? '')
  const [model, setModel] = useState(vehicle?.model ?? '')
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : '')
  const [plate, setPlate] = useState(vehicle?.plate ?? '')
  const [fuel, setFuel] = useState(vehicle?.fuel_type ?? 'flex')
  const [odo, setOdo] = useState(vehicle ? String(vehicle.initial_odometer) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Dê um apelido ao carro, como "Onix" ou "Carro da Ana".')
    setBusy(true)
    const input = {
      name: name.trim(),
      brand: brand.trim(),
      model: model.trim(),
      year: parseNumber(year),
      plate: plate.trim().toUpperCase(),
      fuel_type: fuel,
      initial_odometer: parseNumber(odo) ?? 0,
    }
    try {
      if (vehicle) {
        await api.updateVehicle(vehicle.id, input)
        onSaved('Carro atualizado')
      } else {
        const v = await api.createVehicle(input)
        onSaved('Carro cadastrado', v.id)
      }
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title={vehicle ? 'Editar carro' : 'Cadastrar carro'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <Field label="Apelido">
          <input id="veh-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Onix, Carro da firma" autoFocus={!vehicle} />
        </Field>
        <div className="form-grid">
          <Field label="Marca">
            <input id="veh-brand" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Chevrolet" />
          </Field>
          <Field label="Modelo">
            <input id="veh-model" className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Onix LT 1.0" />
          </Field>
          <Field label="Ano">
            <input id="veh-year" className="input num" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2021" />
          </Field>
          <Field label="Placa">
            <input id="veh-plate" className="input" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC1D23" maxLength={8} style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="Combustível">
            <select id="veh-fuel" className="select" value={fuel} onChange={(e) => setFuel(e.target.value)}>
              {Object.entries(FUEL_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label={vehicle ? 'Km inicial' : 'Km atual'}>
            <div className="input-wrap">
              <input id="veh-odo" className="input has-suffix num" inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value)} placeholder="45000" />
              <span className="suffix">km</span>
            </div>
          </Field>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="sheet-actions">
          <button className="btn" disabled={busy}>
            {busy ? 'Salvando…' : vehicle ? 'Salvar' : 'Cadastrar carro'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

export function JoinForm({ onClose, onJoined }: { onClose: () => void; onJoined: (vehicleId: string) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title="Entrar num carro" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (code.trim().length < 6) return setError('O código tem 6 caracteres.')
          setBusy(true)
          setError('')
          try {
            onJoined(await api.joinByCode(code))
          } catch (err) {
            setError((err as Error).message)
            setBusy(false)
          }
        }}
      >
        <p className="ink-2">Peça ao dono do carro o código de convite. Ele aparece para o dono em Garagem › Motoristas.</p>
        <Field label="Código de convite">
          <input
            id="join-code"
            className="input num"
            value={code}
            maxLength={6}
            autoFocus
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="K7P2QX"
            style={{ letterSpacing: '0.3em', fontWeight: 800, fontSize: 22, textAlign: 'center', height: 58 }}
          />
        </Field>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar no carro'}
        </button>
      </form>
    </Sheet>
  )
}

export function ProfileForm({ name, onClose, onSaved }: { name: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title="Seu nome" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!value.trim()) return
          setBusy(true)
          await api.updateProfileName(value.trim())
          onSaved('Nome atualizado')
        }}
      >
        <Field label="Como os outros motoristas veem você">
          <input id="profile-name" className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
        <button className="btn btn-block" disabled={busy}>
          Salvar
        </button>
      </form>
    </Sheet>
  )
}

export function NewPasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title="Criar nova senha" onClose={onCancel}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
          if (password !== confirm) return setError('As duas senhas não são iguais.')
          setBusy(true)
          try {
            await api.updatePassword(password)
            onDone()
          } catch (err) {
            setError((err as Error).message)
            setBusy(false)
          }
        }}
      >
        <p className="ink-2">Você entrou pelo link de recuperação. Escolha a nova senha da sua conta.</p>
        <Field label="Nova senha" hint="Mínimo de 6 caracteres.">
          <input id="new-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <Field label="Repita a nova senha">
          <input id="new-password-confirm" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-block" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </Sheet>
  )
}

export function DeleteVehicle({ vehicle, onDeleted }: { vehicle: Vehicle; onDeleted: () => void }) {
  return (
    <DeleteButton
      label={`Excluir ${vehicle.name}`}
      onConfirm={async () => {
        await api.deleteVehicle(vehicle.id)
        onDeleted()
      }}
    />
  )
}
