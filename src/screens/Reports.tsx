import { useState } from 'react'
import { byCategory, consumption, costPerKm, lastMonths, monthlyTotals, sumBy } from '../lib/calc'
import { brl, monthKey, num } from '../lib/format'
import type { Entry } from '../lib/types'
import { CategoryBars, ConsumptionChart, Legend, MonthlyChart } from '../components/Charts'
import { Empty } from '../components/ui'
import { ChartColumn } from 'lucide-react'

const PERIODS = [3, 6, 12] as const

export function Reports({ entries }: { entries: Entry[] }) {
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(6)
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const keys = lastMonths(months)
  const list = entries.filter((e) => keys.includes(monthKey(e.date)))
  const monthly = monthlyTotals(entries, keys)
  const total = sumBy(list)
  const fuel = list.filter((e) => e.kind === 'fuel')
  const liters = fuel.reduce((s, e) => s + (e.liters ?? 0), 0)
  const cons = consumption(list)
  const cpk = costPerKm(list)
  const odos = list.filter((e) => e.odometer).map((e) => e.odometer!)
  const driven = odos.length > 1 ? Math.max(...odos) - Math.min(...odos) : null

  return (
    <div className="page">
      <h1 className="page-title">Relatórios</h1>
      <div className="segmented" role="group" aria-label="Período" style={{ maxWidth: 360 }}>
        {PERIODS.map((p) => (
          <button key={p} aria-pressed={months === p} onClick={() => setMonths(p)}>
            {p} meses
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <Empty icon={<ChartColumn size={24} />} title="Sem dados no período" text="Os gráficos aparecem assim que houver lançamentos." />
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Total gasto</span>
              <span className="stat-value">{brl(total)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Média por mês</span>
              <span className="stat-value">{brl(total / months)}</span>
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
              <h2 className="section-title">Gastos por mês</h2>
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
                <MonthlyChart data={monthly} height={240} />
              </>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="num" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', textAlign: 'right' }}>
                      <th style={{ textAlign: 'left', padding: '6px 4px' }}>Mês</th>
                      <th style={{ padding: '6px 4px' }}>Combustível</th>
                      <th style={{ padding: '6px 4px' }}>Serviços</th>
                      <th style={{ padding: '6px 4px' }}>Despesas</th>
                      <th style={{ padding: '6px 4px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m) => (
                      <tr key={m.key} style={{ borderTop: '1px solid var(--line)', textAlign: 'right' }}>
                        <td style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>{m.key.split('-').reverse().join('/')}</td>
                        <td style={{ padding: '8px 4px' }}>{brl(m.fuel)}</td>
                        <td style={{ padding: '8px 4px' }}>{brl(m.service)}</td>
                        <td style={{ padding: '8px 4px' }}>{brl(m.expense)}</td>
                        <td style={{ padding: '8px 4px', fontWeight: 800 }}>{brl(m.total)}</td>
                      </tr>
                    ))}
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
                <p className="hint">Registre pelo menos três abastecimentos com tanque cheio para ver a evolução do consumo.</p>
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
