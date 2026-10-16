import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { api, type VehicleWithRole } from '../lib/api'
import { initials } from '../lib/format'
import type { Member } from '../lib/types'

// Quadro do Início: quem dirige este carro + atalho para adicionar motorista
export function DriversCard({ vehicle, version, onAdd }: { vehicle: VehicleWithRole; version: number; onAdd: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null)

  useEffect(() => {
    let alive = true
    api
      .listMembers(vehicle.id)
      .then((m) => alive && setMembers(m))
      .catch(() => alive && setMembers([]))
    return () => {
      alive = false
    }
  }, [vehicle.id, version])

  const isOwner = vehicle.role === 'owner'
  const drivers = members?.filter((m) => m.role === 'driver') ?? []

  return (
    <section className="card stack">
      <div className="section-head" style={{ alignItems: 'center' }}>
        <h2 className="section-title">Motoristas</h2>
        {isOwner && (
          <button className="btn btn-sm" onClick={onAdd}>
            <UserPlus size={16} /> Adicionar
          </button>
        )}
      </div>
      {members === null ? (
        <p className="hint">Carregando…</p>
      ) : (
        <div className="drivers">
          {members.map((m) => (
            <div key={m.user_id} className="driver">
              <span className="avatar">{initials(m.name)}</span>
              <span className="driver-name">{m.name || m.email}</span>
              <span className="hint">{m.role === 'owner' ? 'Dono' : 'Motorista'}</span>
            </div>
          ))}
          {isOwner && (
            <button className="driver driver-add" onClick={onAdd} aria-label="Adicionar motorista">
              <span className="avatar">
                <UserPlus size={18} />
              </span>
              <span className="driver-name">Adicionar</span>
            </button>
          )}
        </div>
      )}
      {isOwner && members !== null && drivers.length === 0 && (
        <p className="hint">Divida o carro com quem também dirige: cada um lança os próprios abastecimentos e gastos.</p>
      )}
    </section>
  )
}
