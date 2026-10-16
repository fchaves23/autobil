import { useMemo, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { sumBy } from '../lib/calc'
import { brl, dateShort, monthKey, monthLong, num } from '../lib/format'
import type { Entry, EntryKind } from '../lib/types'
import { Empty, KindIcon } from '../components/ui'

export function EntryRow({ entry: e, onClick }: { entry: Entry; onClick: () => void }) {
  const title = e.kind === 'fuel' ? `${e.category || 'Combustível'}${e.liters ? ` · ${num(e.liters, 1)} L` : ''}` : e.category || 'Outros'
  const sub = [dateShort(e.date), e.odometer ? `${num(e.odometer)} km` : null, e.description || null, e.user_name ? `por ${e.user_name}` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <button className="row" onClick={onClick}>
      <span className={`row-icon k-${e.kind}`}>
        <KindIcon kind={e.kind} size={19} />
      </span>
      <span className="row-main">
        <span className="row-title" style={{ display: 'block' }}>
          {title}
        </span>
        <span className="row-sub" style={{ display: 'block' }}>
          {sub}
        </span>
      </span>
      <span className="row-end">
        <span className="row-amount" style={{ display: 'block' }}>
          {brl(e.amount)}
        </span>
        {e.kind === 'fuel' && e.price_per_liter && (
          <span className="row-sub num" style={{ display: 'block' }}>
            {brl(e.price_per_liter)}/L
          </span>
        )}
      </span>
    </button>
  )
}

type Filter = 'all' | EntryKind

export function History({ entries, onEdit, onAdd }: { entries: Entry[]; onEdit: (e: Entry) => void; onAdd: () => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = entries.filter(
      (e) =>
        (filter === 'all' || e.kind === filter) &&
        (!term || `${e.category} ${e.description} ${e.user_name ?? ''}`.toLowerCase().includes(term)),
    )
    const map = new Map<string, Entry[]>()
    for (const e of list) {
      const k = monthKey(e.date)
      map.set(k, [...(map.get(k) ?? []), e])
    }
    return [...map.entries()]
  }, [entries, filter, q])

  return (
    <div className="page">
      <div className="section-head">
        <h1 className="page-title">Histórico</h1>
        <button className="btn btn-sm" onClick={onAdd}>
          <Plus size={16} /> Lançar
        </button>
      </div>

      <div className="input-wrap">
        <Search size={18} className="prefix" style={{ left: 14 }} />
        <input id="history-search" className="input has-prefix" placeholder="Buscar por categoria, observação ou motorista" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="chips">
        {(
          [
            ['all', 'Tudo'],
            ['fuel', 'Abastecimentos'],
            ['expense', 'Despesas'],
            ['service', 'Serviços'],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <Empty icon={<Search size={24} />} title="Nenhum lançamento encontrado" text="Mude o filtro ou registre um novo lançamento." />
        </div>
      ) : (
        groups.map(([key, list]) => (
          <section key={key} className="month-group">
            <div className="month-head">
              <h3>{monthLong(key)}</h3>
              <span className="num ink-2" style={{ fontWeight: 700, fontSize: 14 }}>
                {brl(sumBy(list))}
              </span>
            </div>
            <div className="card" style={{ paddingBlock: 6 }}>
              <div className="list">
                {list.map((e) => (
                  <EntryRow key={e.id} entry={e} onClick={() => onEdit(e)} />
                ))}
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  )
}
