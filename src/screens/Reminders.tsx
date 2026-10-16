import { useState } from 'react'
import { BellRing, CalendarClock, Check, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { reminderStatus } from '../lib/calc'
import { dateFull, km, num, relativeDays, today } from '../lib/format'
import type { Reminder } from '../lib/types'
import { Empty } from '../components/ui'

export function Reminders({
  reminders,
  odometer,
  onAdd,
  onEdit,
  onChanged,
}: {
  reminders: Reminder[]
  odometer: number
  onAdd: () => void
  onEdit: (r: Reminder) => void
  onChanged: (msg: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const items = reminders.map((r) => ({ r, s: reminderStatus(r, odometer) })).sort((a, b) => b.s.progress - a.s.progress)

  return (
    <div className="page">
      <div className="section-head">
        <h1 className="page-title">Lembretes</h1>
        <button className="btn btn-sm" onClick={onAdd}>
          <Plus size={16} /> Novo
        </button>
      </div>
      <p className="ink-2" style={{ marginTop: -10 }}>
        Contagem pelo hodômetro atual: <strong className="num">{num(odometer)} km</strong>
      </p>

      {items.length === 0 ? (
        <div className="card">
          <Empty
            icon={<BellRing size={24} />}
            title="Nenhum lembrete ainda"
            text="Avisos de troca de óleo, revisão, pneus e licenciamento, por km ou por data."
            action={
              <button className="btn" onClick={onAdd}>
                Criar lembrete
              </button>
            }
          />
        </div>
      ) : (
        <div className="stack">
          {items.map(({ r, s }) => (
            <section key={r.id} className="card reminder">
              <div className="reminder-top">
                <span className={`row-icon ${s.state === 'overdue' ? 'k-expense' : s.state === 'soon' ? 'k-amber' : 'k-service'}`}>
                  <CalendarClock size={19} />
                </span>
                <button className="row-main" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => onEdit(r)}>
                  <span className="row-title" style={{ display: 'block' }}>
                    {r.title}
                  </span>
                  <span className="row-sub" style={{ display: 'block' }}>
                    {[r.interval_km ? `a cada ${km(r.interval_km)}` : null, r.interval_months ? `a cada ${r.interval_months} meses` : null].filter(Boolean).join(' ou ')}
                  </span>
                </button>
                <span className={`badge ${s.state}`}>{s.state === 'overdue' ? 'Vencido' : s.state === 'soon' ? 'Em breve' : 'Em dia'}</span>
              </div>
              <div className={`bar ${s.state}`} role="progressbar" aria-valuenow={Math.round(Math.min(1, s.progress) * 100)} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${Math.min(1, s.progress) * 100}%` }} />
              </div>
              <div className="section-head" style={{ alignItems: 'center' }}>
                <span className="hint">
                  {[
                    s.kmLeft !== null ? (s.kmLeft >= 0 ? `Faltam ${km(s.kmLeft)} (aos ${num(s.nextKm)} km)` : `Passou ${km(-s.kmLeft)}`) : null,
                    s.nextDate ? `Vence ${relativeDays(s.daysLeft!)} (${dateFull(s.nextDate)})` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={busy === r.id}
                  onClick={async () => {
                    setBusy(r.id)
                    await api.saveReminder({ ...r, last_km: odometer, last_date: today() }, r.id)
                    setBusy(null)
                    onChanged(`${r.title}: contagem reiniciada`)
                  }}
                >
                  <Check size={16} /> Feito hoje
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
