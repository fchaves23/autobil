import { useEffect, useRef, useState } from 'react'
import type { ConsumptionPoint, MonthTotals } from '../lib/calc'
import { brl, brlShort, dateShort, monthLong, monthShort, num } from '../lib/format'
import type { EntryKind } from '../lib/types'

export const SERIES: { key: EntryKind; label: string; color: string }[] = [
  { key: 'fuel', label: 'Combustível', color: 'var(--s-fuel)' },
  { key: 'service', label: 'Serviços', color: 'var(--s-service)' },
  { key: 'expense', label: 'Despesas', color: 'var(--s-expense)' },
]

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceMax(v: number, ticks = 4) {
  if (v <= 0) return { max: ticks, step: 1 }
  const raw = v / ticks
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!
  return { max: step * ticks, step }
}

// Retângulo com só os cantos de cima arredondados (ponta do dado), base reta no eixo
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

export function MonthlyChart({ data, height = 220 }: { data: MonthTotals[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const m = { top: 12, right: 4, bottom: 26, left: 48 }
  const iw = Math.max(0, width - m.left - m.right)
  const ih = height - m.top - m.bottom
  const { max, step } = niceMax(Math.max(...data.map((d) => d.total), 0))
  const band = data.length ? iw / data.length : 0
  const bw = Math.min(40, band * 0.58)
  const y = (v: number) => m.top + ih - (v / max) * ih
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - m.left) / band)
    setHover(i >= 0 && i < data.length ? i : null)
  }

  const h = hover !== null ? data[hover] : null
  if (data.every((d) => d.total === 0)) {
    return <p className="hint" style={{ paddingBlock: 24, textAlign: 'center' }}>Nenhum gasto no período. Os lançamentos aparecem aqui mês a mês.</p>
  }
  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Gastos por mês">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--muted)' : 'var(--grid)'} strokeWidth={1} />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num">
                {t >= 1000 ? `${num(t / 1000, t % 1000 ? 1 : 0)} mil` : num(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = m.left + band * i + band / 2
            let acc = 0
            const segs = SERIES.map((s) => ({ ...s, v: d[s.key] })).filter((s) => s.v > 0)
            return (
              <g key={d.key} opacity={hover === null || hover === i ? 1 : 0.45}>
                {hover === i && <rect x={m.left + band * i} y={m.top} width={band} height={ih} fill="var(--surface-2)" rx={8} />}
                {segs.map((s, j) => {
                  const y0 = y(acc)
                  acc += s.v
                  const y1 = y(acc)
                  const gap = j > 0 ? 2 : 0
                  const hh = Math.max(0, y0 - y1 - gap)
                  const isTop = j === segs.length - 1
                  return isTop ? (
                    <path key={s.key} d={topRounded(cx - bw / 2, y1, bw, hh, 4)} fill={s.color} />
                  ) : (
                    <rect key={s.key} x={cx - bw / 2} y={y1 + gap} width={bw} height={hh} fill={s.color} />
                  )
                })}
                <text x={cx} y={height - 8} textAnchor="middle" style={{ fontWeight: hover === i ? 700 : 500 }}>
                  {monthShort(d.key)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {h && hover !== null && (
        <div className="tooltip" style={{ left: Math.min(Math.max(m.left + band * hover + band / 2, 80), width - 80), top: y(h.total) }}>
          <div style={{ marginBottom: 4 }}>
            <b>{monthLong(h.key)}</b>
          </div>
          {SERIES.map((s) => (
            <div className="t-row" key={s.key}>
              <span>
                <i style={{ background: s.color }} />
                {s.label}
              </span>
              <span>{brl(h[s.key])}</span>
            </div>
          ))}
          <div className="t-row" style={{ marginTop: 4, fontWeight: 800 }}>
            <span>Total</span>
            <span>{brl(h.total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function Legend() {
  return (
    <div className="legend">
      {SERIES.map((s) => (
        <span key={s.key}>
          <i style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

export function ConsumptionChart({ points, average, height = 200 }: { points: ConsumptionPoint[]; average: number | null; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const m = { top: 14, right: 12, bottom: 26, left: 40 }
  const iw = Math.max(0, width - m.left - m.right)
  const ih = height - m.top - m.bottom
  const vals = points.map((p) => p.kml)
  const lo = Math.floor(Math.min(...vals, average ?? Infinity) - 1)
  const hi = Math.ceil(Math.max(...vals, average ?? -Infinity) + 1)
  const x = (i: number) => m.left + (points.length > 1 ? (i / (points.length - 1)) * iw : iw / 2)
  const y = (v: number) => m.top + ih - ((v - lo) / Math.max(1, hi - lo)) * ih
  const stepT = Math.max(1, Math.round((hi - lo) / 4))
  const ticks: number[] = []
  for (let t = lo; t <= hi; t += stepT) ticks.push(t)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.kml)}`).join(' ')
  const area = points.length ? `${line} L${x(points.length - 1)},${m.top + ih} L${x(0)},${m.top + ih} Z` : ''
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 70))))

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!points.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - rect.left - m.left) / Math.max(1, iw)
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1)))))
  }

  const h = hover !== null ? points[hover] : null
  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Consumo em km por litro">
          <defs>
            <linearGradient id="kml-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--s-fuel)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--s-fuel)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num">
                {t}
              </text>
            </g>
          ))}
          {average !== null && (
            <g>
              <line x1={m.left} x2={width - m.right} y1={y(average)} y2={y(average)} stroke="var(--amber)" strokeDasharray="4 4" strokeWidth={1.5} />
              <text x={width - m.right} y={y(average) - 6} textAnchor="end" style={{ fill: 'var(--amber-ink)', fontWeight: 700 }}>
                média {num(average, 1)}
              </text>
            </g>
          )}
          <path d={area} fill="url(#kml-fill)" />
          <path d={line} fill="none" stroke="var(--s-fuel)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) =>
            (i % labelEvery === 0 && points.length - 1 - i >= labelEvery * 0.75) || i === points.length - 1 ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
                {dateShort(p.date)}
              </text>
            ) : null,
          )}
          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} stroke="var(--muted)" strokeDasharray="2 3" />
              <circle cx={x(hover)} cy={y(h.kml)} r={5} fill="var(--s-fuel)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
          {points.length > 0 && hover === null && (
            <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].kml)} r={4.5} fill="var(--s-fuel)" stroke="var(--surface)" strokeWidth={2} />
          )}
        </svg>
      )}
      {h && hover !== null && (
        <div className="tooltip" style={{ left: Math.min(Math.max(x(hover), 80), width - 80), top: y(h.kml) }}>
          <div className="t-row">
            <b>{dateShort(h.date)}</b>
            <b>{num(h.kml, 1)} km/l</b>
          </div>
          <div className="t-row" style={{ opacity: 0.75 }}>
            <span>{h.fuel ? h.fuel[0].toUpperCase() + h.fuel.slice(1) : 'Combustível'}</span>
            <span>{num(h.odometer)} km</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function CategoryBars({ items }: { items: { label: string; kind: EntryKind; amount: number }[] }) {
  const max = Math.max(...items.map((i) => i.amount), 1)
  const color = (k: EntryKind) => SERIES.find((s) => s.key === k)!.color
  return (
    <div className="hbar">
      {items.map((i) => (
        <div key={i.label} style={{ display: 'contents' }}>
          <span className="hbar-label">{i.label}</span>
          <span className="hbar-value">{brlShort(i.amount)}</span>
          <div className="hbar-track">
            <i style={{ width: `${(i.amount / max) * 100}%`, background: color(i.kind) }} />
          </div>
        </div>
      ))}
    </div>
  )
}
