import { useEffect, useState } from 'react'
import { HandCoins, UserPlus } from 'lucide-react'
import { api, type VehicleWithRole } from '../lib/api'
import { Avatar } from './Avatar'
import type { Member } from '../lib/types'

// Quadro do Início: quem dirige este carro + atalho para adicionar motorista
export function DriversCard({ vehicle, version, onAdd, onSettle }: { vehicle: VehicleWithRole; version: number; onAdd: () => void; onSettle: () => void }) {
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
              <Avatar name={m.name || m.email} url={m.avatar_url} />
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
      {members !== null && members.length > 1 && (
        <button className="btn btn-sm btn-ghost" onClick={onSettle} style={{ alignSelf: 'flex-start' }}>
          <HandCoins size={16} /> Acerto de contas
        </button>
      )}
      {isOwner && members !== null && drivers.length === 0 && (
        <p className="hint">Divida o carro com quem também dirige: cada um lança os próprios abastecimentos e gastos.</p>
      )}
    </section>
  )
}
