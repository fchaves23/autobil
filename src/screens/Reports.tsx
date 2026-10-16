import { useMemo, useState } from 'react'
import { ChartColumn, FileSpreadsheet, FileText, MapPinned } from 'lucide-react'
import { buckets, byCategory, consumption, costPerKm, daysInRange, inRange, sumBy, type Group } from '../lib/calc'
import { addDays, addMonths, brl, dateFull, num, toISODate, today } from '../lib/format'
import { NOT_FUEL, type Entry, type EntryKind, type Trip, type Vehicle } from '../lib/types'
import type { ReportExport } from '../lib/export'
import { CategoryBars, ConsumptionChart, Legend, MonthlyChart } from '../components/Charts'
import { Empty, Field } from '../components/ui'

type Preset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | '3m' | '6m' | '12m' | 'year' | 'custom'
type KindFilter = 'all' | EntryKind

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'lastMonth', label: 'Mês passado' },
  { id: '3m', label: '3 meses' },
  { id: '6m', label: '6 meses' },
  { id: '12m', label: '12 meses' },
  { id: 'year', label: 'Este ano' },
  { id: 'custom', label: 'Personalizado' },
]

const GROUP_LABEL: Record<Group, string> = { day: 'Dia', week: 'Semana', month: 'Mês' }

function presetRange(p: Preset): [string, string] {
  const now = new Date()
  const t = today()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  switch (p) {
    case 'today':
      return [t, t]
    case '7d':
      return [toISODate(addDays(now, -6)), t]
    case '30d':
      return [toISODate(addDays(now, -29)), t]
    case 'month':
      return [toISODate(firstOfMonth), t]
    case 'lastMonth':
      return [toISODate(addMonths(firstOfMonth, -1)), toISODate(addDays(firstOfMonth, -1))]
    case '3m':
      return [toISODate(addMonths(firstOfMonth, -2)), t]
    case '6m':
      return [toISODate(addMonths(firstOfMonth, -5)), t]
    case '12m':
      return [toISODate(addMonths(firstOfMonth, -11)), t]
    case 'year':
      return [`${now.getFullYear()}-01-01`, t]
    default:
      return [toISODate(addMonths(firstOfMonth, -5)), t]
  }
}

// Agrupamento que faz sentido para o tamanho do período
const autoGroup = (days: number): Group => (days <= 31 ? 'day' : days <= 120 ? 'week' : 'month')
const allowed = (days: number): Group[] => (days <= 62 ? ['day', 'week', 'month'] : days <= 400 ? ['week', 'month'] : ['month'])

export function Reports({
  entries,
  trips,
  vehicle,
  initialTrip,
}: {
  entries: Entry[]
  trips: Trip[]
  vehicle: Vehicle | null
  initialTrip: string | null
}) {
  const [tripFilter, setTripFilter] = useState<string>(initialTrip ?? 'all')
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)
  const [exportError, setExportError] = useState('')
  const trip = trips.find((t) => t.id === tripFilter) ?? null
  const [preset, setPreset] = useState<Preset>('6m')
  const [custom, setCustom] = useState<[string, string]>(() => presetRange('30d'))
  const [groupChoice, setGroupChoice] = useState<Group | null>(null)
  const [kind, setKind] = useState<KindFilter>('all')
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const [from, to] = trip
    ? [trip.start_date, trip.end_date ?? (today() > trip.start_date ? today() : trip.start_date)]
    : preset === 'custom'
      ? custom[0] <= custom[1]
        ? custom
        : [custom[1], custom[0]]
      : presetRange(preset)
  const days = daysInRange(from, to)
  const options = allowed(days)
  const group = groupChoice && options.includes(groupChoice) ? groupChoice : autoGroup(days)

  // Numa viagem valem os lançamentos marcados nela (mesmo fora das datas); no geral, o período escolhido
  const scope = useMemo(() => (trip ? entries.filter((e) => e.trip_id === trip.id) : inRange(entries, from, to)), [entries, trip, from, to])
  const list = useMemo(() => scope.filter((e) => kind === 'all' || e.kind === kind), [scope, kind])
  const data = useMemo(() => buckets(list, from, to, group), [list, from, to, group])

  const total = sumBy(list)
  const fuel = list.filter((e) => e.kind === 'fuel' && !NOT_FUEL.has(e.fuel_type ?? ''))
  const liters = fuel.reduce((s, e) => s + (e.liters ?? 0), 0)
  // Consumo e km usam todos os abastecimentos do período, mesmo com filtro de tipo
  const periodAll = scope
  const cons = consumption(periodAll)
  const cpk = costPerKm(periodAll)
  const odos = periodAll.filter((e) => e.odometer).map((e) => e.odometer!)
  const driven = odos.length > 1 ? Math.max(...odos) - Math.min(...odos) : null
  const avgLabel = days >= 56 ? 'Média por mês' : days >= 14 ? 'Média por semana' : 'Média por dia'
  const avgValue = days >= 56 ? total / (days / 30.44) : days >= 14 ? total / (days / 7) : total / days

  async function runExport(format: 'xlsx' | 'pdf') {
    if (!vehicle) return
    setExporting(format)
    setExportError('')
    const payload: ReportExport = {
      vehicleName: vehicle.name,
      vehiclePlate: vehicle.plate,
      title: trip ? `Viagem ${trip.name}` : 'Relatório geral',
      from,
      to,
      filters: [
        kind === 'all' ? 'Todos os gastos' : kind === 'fuel' ? 'Só combustível' : kind === 'expense' ? 'Só despesas' : 'Só serviços',
        `agrupado por ${GROUP_LABEL[group].toLowerCase()}`,
        `${list.length} lançamentos`,
      ].join(' · '),
      summary: [
        ['Total gasto', brl(total)],
        [avgLabel, brl(avgValue)],
        ['Combustível', brl(sumBy(list, 'fuel'))],
        ['Serviços', brl(sumBy(list, 'service'))],
        ['Despesas', brl(sumBy(list, 'expense'))],
        ['Km rodados', driven !== null ? `${num(driven)} km` : '—'],
        ['Custo por km', cpk !== null ? brl(cpk) : '—'],
        ['Consumo médio', cons.average !== null ? `${num(cons.average, 1)} km/l` : '—'],
        ['Litros abastecidos', `${num(liters, 1)} L`],
        ['Preço médio do litro', liters ? brl(sumBy(fuel) / liters) : '—'],
      ],
      groupLabel: GROUP_LABEL[group],
      buckets: data,
      categories: byCategory(list),
      entries: list,
      tripName: (id) => trips.find((t) => t.id === id)?.name ?? '',
    }
    try {
      const mod = await import('../lib/export')
      await (format === 'xlsx' ? mod.exportXlsx(payload) : mod.exportPdf(payload))
    } catch (err) {
      setExportError(`Não foi possível gerar o arquivo: ${(err as Error).message}`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="page">
      <div className="section-head" style={{ flexWrap: 'wrap' }}>
        <h1 className="page-title">Relatórios</h1>
        <div className="share-actions">
          <button className="btn btn-sm btn-ghost" disabled={!list.length || !!exporting} onClick={() => runExport('xlsx')}>
            <FileSpreadsheet size={16} /> {exporting === 'xlsx' ? 'Gerando…' : 'Excel'}
          </button>
          <button className="btn btn-sm btn-ghost" disabled={!list.length || !!exporting} onClick={() => runExport('pdf')}>
            <FileText size={16} /> {exporting === 'pdf' ? 'Gerando…' : 'PDF'}
          </button>
        </div>
      </div>
      {exportError && <div className="error">{exportError}</div>}

      <section className="card stack">
        {trips.length > 0 && (
          <Field label="Viagem">
            <select id="report-trip" className="select" value={tripFilter} onChange={(e) => setTripFilter(e.target.value)}>
              <option value="all">Geral do carro (todos os lançamentos)</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  Viagem: {t.name}
                  {!t.end_date ? ' (em andamento)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        {trip ? (
          <p className="notice" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <MapPinned size={16} /> Mostrando só os lançamentos da viagem {trip.name}.
          </p>
        ) : (
        <div className="chips" role="group" aria-label="Período">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="chip"
              aria-pressed={preset === p.id}
              onClick={() => {
                setPreset(p.id)
                setGroupChoice(null)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        )}

        {!trip && preset === 'custom' && (
          <div className="form-grid">
            <Field label="De">
              <input id="report-from" className="input" type="date" value={custom[0]} max={today()} onChange={(e) => e.target.value && setCustom([e.target.value, custom[1]])} />
            </Field>
            <Field label="Até">
              <input id="report-to" className="input" type="date" value={custom[1]} max={today()} onChange={(e) => e.target.value && setCustom([custom[0], e.target.value])} />
            </Field>
          </div>
        )}

        <div className="filter-row">
          <div className="segmented" role="group" aria-label="Agrupar por">
            {(['day', 'week', 'month'] as Group[]).map((g) => (
              <button key={g} aria-pressed={group === g} disabled={!options.includes(g)} onClick={() => setGroupChoice(g)}>
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          <select id="report-kind" className="select" style={{ height: 46 }} value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} aria-label="Tipo de gasto">
            <option value="all">Todos os gastos</option>
            <option value="fuel">Só combustível</option>
            <option value="expense">Só despesas</option>
            <option value="service">Só serviços</option>
          </select>
        </div>

        <p className="hint">
          {from === to ? dateFull(from) : `${dateFull(from)} a ${dateFull(to)}`} · {days} {days === 1 ? 'dia' : 'dias'} · {list.length}{' '}
          {list.length === 1 ? 'lançamento' : 'lançamentos'}
        </p>
      </section>

      {list.length === 0 ? (
        <div className="card">
          <Empty icon={<ChartColumn size={24} />} title="Sem lançamentos no período" text="Escolha outro período ou tipo de gasto." />
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Total gasto</span>
              <span className="stat-value">{brl(total)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">{avgLabel}</span>
              <span className="stat-value">{brl(avgValue)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Km rodados</span>
              <span className="stat-value">
                {num(driven)}
                <small>km</small>
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Custo por km</span>
              <span className="stat-value">{cpk !== null ? brl(cpk) : '—'}</span>
            </div>
          </div>

          <section className="card stack">
            <div className="section-head" style={{ flexWrap: 'wrap' }}>
              <h2 className="section-title">Gastos por {GROUP_LABEL[group].toLowerCase()}</h2>
              <div className="segmented" role="group" aria-label="Visualização">
                <button aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
                  Gráfico
                </button>
                <button aria-pressed={view === 'table'} onClick={() => setView('table')}>
                  Tabela
                </button>
              </div>
            </div>
            {view === 'chart' ? (
              <>
                <Legend />
                <MonthlyChart data={data} height={240} />
              </>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="num" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', textAlign: 'right' }}>
                      <th style={{ textAlign: 'left', padding: '6px 4px' }}>{GROUP_LABEL[group]}</th>
                      <th style={{ padding: '6px 4px' }}>Combustível</th>
                      <th style={{ padding: '6px 4px' }}>Serviços</th>
                      <th style={{ padding: '6px 4px' }}>Despesas</th>
                      <th style={{ padding: '6px 4px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data
                      .filter((d) => d.total > 0)
                      .map((d) => (
                        <tr key={d.key} style={{ borderTop: '1px solid var(--line)', textAlign: 'right' }}>
                          <td style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600, whiteSpace: 'nowrap' }}>{d.long}</td>
                          <td style={{ padding: '8px 4px' }}>{brl(d.fuel)}</td>
                          <td style={{ padding: '8px 4px' }}>{brl(d.service)}</td>
                          <td style={{ padding: '8px 4px' }}>{brl(d.expense)}</td>
                          <td style={{ padding: '8px 4px', fontWeight: 800 }}>{brl(d.total)}</td>
                        </tr>
                      ))}
                    <tr style={{ borderTop: '2px solid var(--line)', textAlign: 'right', fontWeight: 800 }}>
                      <td style={{ textAlign: 'left', padding: '8px 4px' }}>Total</td>
                      <td style={{ padding: '8px 4px' }}>{brl(sumBy(list, 'fuel'))}</td>
                      <td style={{ padding: '8px 4px' }}>{brl(sumBy(list, 'service'))}</td>
                      <td style={{ padding: '8px 4px' }}>{brl(sumBy(list, 'expense'))}</td>
                      <td style={{ padding: '8px 4px' }}>{brl(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid-2">
            <section className="card stack">
              <div className="section-head">
                <h2 className="section-title">Consumo (km/l)</h2>
                <span className="hint">tanque cheio a tanque cheio</span>
              </div>
              {cons.points.length >= 2 ? (
                <ConsumptionChart points={cons.points} average={cons.average} />
              ) : (
                <p className="hint">
                  {cons.points.length === 1
                    ? `Média do período: ${num(cons.average, 1)} km/l. Com mais abastecimentos de tanque cheio, aparece a evolução.`
                    : 'Precisa de pelo menos dois abastecimentos com tanque cheio no período para calcular o consumo.'}
                </p>
              )}
              <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div>
                  <div className="stat-label">Litros abastecidos</div>
                  <div className="stat-value">
                    {num(liters, 0)}
                    <small>L</small>
                  </div>
                </div>
                <div>
                  <div className="stat-label">Preço médio</div>
                  <div className="stat-value">
                    {liters ? brl(sumBy(fuel) / liters) : '—'}
                    <small>/L</small>
                  </div>
                </div>
              </div>
            </section>

            <section className="card stack">
              <h2 className="section-title">Para onde foi o dinheiro</h2>
              <CategoryBars items={byCategory(list)} />
            </section>
          </div>
        </>
      )}
    </div>
  )
}
