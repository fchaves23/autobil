import { useEffect, useState, type ReactNode } from 'react'
import { Fuel, Receipt, Wrench, X } from 'lucide-react'
import type { EntryKind } from '../lib/types'

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="brand">
      <img src="/icon.svg" alt="" width={size} height={size} />
      <span>
        auto<b>bil</b>
      </span>
    </div>
  )
}

export function KindIcon({ kind, size = 20 }: { kind: EntryKind; size?: number }) {
  if (kind === 'fuel') return <Fuel size={size} />
  if (kind === 'service') return <Wrench size={size} />
  return <Receipt size={size} />
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, full }: { label: string; hint?: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="stat-icon k-primary">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="center-screen">
      <div className="spinner" />
    </div>
  )
}

// Botão de excluir em dois passos (sem confirm() do navegador)
export function DeleteButton({ onConfirm, label = 'Excluir' }: { onConfirm: () => Promise<void> | void; label?: string }) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={busy}
      onClick={async () => {
        if (!armed) return setArmed(true)
        setBusy(true)
        try {
          await onConfirm()
        } finally {
          setBusy(false)
        }
      }}
    >
      {armed ? 'Toque de novo para confirmar' : label}
    </button>
  )
}

export function Odometer({ value }: { value: number }) {
  const digits = Math.round(value).toString().padStart(6, '0').split('')
  return (
    <span className="odometer" aria-label={`${Math.round(value)} quilômetros`}>
      {digits.map((d, i) => (
        <span key={i}>{d}</span>
      ))}
      <span className="unit">km</span>
    </span>
  )
}
