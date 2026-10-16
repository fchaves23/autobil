import { BellRing, CalendarClock, ChevronRight, Fuel, Gauge, Plus, Receipt, Wrench } from 'lucide-react'
import { consumption, costPerKm, inMonth, lastMonths, monthlyTotals, reminderStatus, sumBy } from '../lib/calc'
import { brl, dateShort, km, monthKey, monthLong, num, relativeDays, today } from '../lib/format'
import type { Entry, EntryKind, Reminder, Vehicle } from '../lib/types'
import { Legend, MonthlyChart } from '../components/Charts'
import { Empty, KindIcon, Odometer } from '../components/ui'
import { EntryRow } from './History'

interface Props {
  vehicle: Vehicle
  entries: Entry[]
  reminders: Reminder[]
  odometer: number
  onAdd: (kind: EntryKind) => void
  onEdit: (e: Entry) => void
  onGo: (tab: 'history' | 'reminders' | 'reports') => void
  onEditReminder: (r: Reminder) => void
}

export function Home({ vehicle, entries, reminders, odometer, onAdd, onEdit, onGo, onEditReminder }: Props) {
  const thisMonth = monthKey(today())
  const monthEntries = inMonth(entries, thisMonth)
  const spent = sumBy(monthEntries)
  // Média dos 6 meses fechados anteriores (o mês atual ainda está em andamento)
  const closed = monthlyTotals(entries, lastMonths(7).slice(0, 6)).filter((m) => m.total > 0)
  const avgMonth = closed.length ? closed.reduce((s, m) => s + m.total, 0) / closed.length : null
  const cons = consumption(entries)
  const keys = lastMonths(6)
  const recentEntries = entries.filter((e) => keys.includes(monthKey(e.date)))
  const cpk = costPerKm(recentEntries)
  const lastFuel = entries.find((e) => e.kind === 'fuel')
  const upcoming = reminders
    .map((r) => ({ r, s: reminderStatus(r, odometer) }))
    .sort((a, b) => b.s.progress - a.s.progress)
    .slice(0, 3)

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-label">Gasto em {monthLong(thisMonth).toLowerCase()}</div>
        <div className="hero-value num">{brl(spent)}</div>
        <div className="hero-meta">
          {avgMonth !== null && <span className="hero-chip">Média mensal {brl(avgMonth)}</span>}
          <span className="hero-chip">{monthEntries.length} lançamentos</span>
          <span className="hero-chip">Combustível {brl(sumBy(monthEntries, 'fuel'))}</span>
        </div>
      </section>

      <div className="quick">
        {(['fuel', 'expense', 'service'] as EntryKind[]).map((k) => (
          <button key={k} className="quick-btn" onClick={() => onAdd(k)}>
            <span className={`stat-icon k-${k}`}>
              <KindIcon kind={k} size={19} />
            </span>
            {k === 'fuel' ? 'Abastecer' : k === 'expense' ? 'Despesa' : 'Serviço'}
          </button>
        ))}
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-icon k-primary">
            <Gauge size={18} />
          </span>
          <span className="stat-label">Consumo médio</span>
          <span className="stat-value">
            {num(cons.average, 1)}
            <small>km/l</small>
          </span>
        </div>
        <div className="stat">
          <span className="stat-icon k-amber">
            <Receipt size={18} />
          </span>
          <span className="stat-label">Custo por km</span>
          <span className="stat-value">
            {cpk !== null ? brl(cpk) : '—'}
            <small>6 meses</small>
          </span>
        </div>
        <div className="stat">
          <span className="stat-icon k-fuel">
            <Fuel size={18} />
          </span>
          <span className="stat-label">Último abastecimento</span>
          <span className="stat-value">
            {lastFuel?.price_per_liter ? brl(lastFuel.price_per_liter) : '—'}
            <small>/L</small>
          </span>
        </div>
        <div className="stat">
          <span className="stat-icon k-service">
            <Wrench size={18} />
          </span>
          <span className="stat-label">Hodômetro</span>
          <Odometer value={odometer} />
        </div>
      </div>

      <div className="grid-2">
        <section className="card stack">
          <div className="section-head">
            <h2 className="section-title">Últimos 6 meses</h2>
            <button className="link" onClick={() => onGo('reports')}>
              Relatórios
            </button>
          </div>
          <Legend />
          <MonthlyChart data={monthlyTotals(entries, keys)} height={200} />
        </section>

        <section className="card stack">
          <div className="section-head">
            <h2 className="section-title">Próximas manutenções</h2>
            <button className="link" onClick={() => onGo('reminders')}>
              Ver todas
            </button>
          </div>
          {upcoming.length === 0 ? (
            <Empty icon={<BellRing size={24} />} title="Nenhum lembrete" text="Crie lembretes de troca de óleo, revisão e pneus." />
          ) : (
            <div className="list">
              {upcoming.map(({ r, s }) => (
                <button key={r.id} className="row" onClick={() => onEditReminder(r)}>
                  <span className={`row-icon ${s.state === 'overdue' ? 'k-expense' : s.state === 'soon' ? 'k-amber' : 'k-service'}`}>
                    <CalendarClock size={19} />
                  </span>
                  <span className="row-main">
                    <span className="row-title" style={{ display: 'block' }}>
                      {r.title}
                    </span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      {[s.kmLeft !== null ? (s.kmLeft >= 0 ? `faltam ${km(s.kmLeft)}` : `passou ${km(-s.kmLeft)}`) : null, s.nextDate ? `vence ${relativeDays(s.daysLeft!)}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className={`badge ${s.state}`}>{s.state === 'overdue' ? 'Vencido' : s.state === 'soon' ? 'Em breve' : 'Em dia'}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="section-head" style={{ marginBottom: 6 }}>
          <h2 className="section-title">Lançamentos recentes</h2>
          <button className="link" onClick={() => onGo('history')}>
            Histórico <ChevronRight size={14} style={{ verticalAlign: -2 }} />
          </button>
        </div>
        {entries.length === 0 ? (
          <Empty
            icon={<Plus size={24} />}
            title={`Nada lançado no ${vehicle.name} ainda`}
            text="Comece pelo próximo abastecimento: anote o km e marque tanque cheio."
            action={
              <button className="btn" onClick={() => onAdd('fuel')}>
                Registrar abastecimento
              </button>
            }
          />
        ) : (
          <div className="list">
            {entries.slice(0, 5).map((e) => (
              <EntryRow key={e.id} entry={e} onClick={() => onEdit(e)} />
            ))}
          </div>
        )}
      </section>
      <p className="hint" style={{ textAlign: 'center' }}>
        {lastFuel ? `Último abastecimento em ${dateShort(lastFuel.date)}` : ''}
      </p>
    </div>
  )
}
