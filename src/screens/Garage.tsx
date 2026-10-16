import { useCallback, useEffect, useState } from 'react'
import { CarFront, Crown, KeyRound, LogOut, Mail, Pencil, Plus, Send, UserCog, UserMinus, UserPlus, X } from 'lucide-react'
import { api, type VehicleWithRole } from '../lib/api'
import { km } from '../lib/format'
import { Avatar } from '../components/Avatar'
import { FUEL_TYPES, type Invite, type Member, type Profile } from '../lib/types'
import { DeleteButton } from '../components/ui'
import { DeleteVehicle } from '../components/Forms'

interface Props {
  user: Profile
  vehicles: VehicleWithRole[]
  currentId: string | null
  odometerOf: (v: VehicleWithRole) => number
  onSelect: (id: string) => void
  onAddVehicle: () => void
  onJoin: () => void
  onEditVehicle: (v: VehicleWithRole) => void
  onEditProfile: () => void
  onAddDriver: (v: VehicleWithRole) => void
  driversVersion: number
  onChanged: (msg: string) => void
  onSignOut: () => void
}

export function Garage(props: Props) {
  const { user, vehicles, currentId, onSelect, onAddVehicle, onJoin, onEditProfile, onSignOut } = props
  const current = vehicles.find((v) => v.id === currentId) ?? null

  return (
    <div className="page">
      <h1 className="page-title">Garagem</h1>

      <section className="stack">
        <div className="section-head">
          <h2 className="section-title">Seus carros</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-ghost" onClick={onJoin}>
              <KeyRound size={16} /> Tenho um código
            </button>
            <button className="btn btn-sm" onClick={onAddVehicle}>
              <Plus size={16} /> Carro
            </button>
          </div>
        </div>
        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
          {vehicles.map((v) => (
            <button
              key={v.id}
              className="stat"
              onClick={() => onSelect(v.id)}
              style={{
                border: v.id === currentId ? '2px solid var(--primary)' : '2px solid transparent',
                textAlign: 'left',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span className="row-icon k-primary">
                <CarFront size={20} />
              </span>
              <span className="row-main">
                <span className="row-title" style={{ display: 'block' }}>
                  {v.name}
                </span>
                <span className="row-sub" style={{ display: 'block' }}>
                  {[v.plate, km(props.odometerOf(v))].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className={`badge ${v.role === 'owner' ? 'ok' : 'neutral'}`}>{v.role === 'owner' ? 'Dono' : 'Motorista'}</span>
            </button>
          ))}
        </div>
      </section>

      {current && <VehicleDetails key={current.id} {...props} vehicle={current} />}

      <section className="card stack">
        <h2 className="section-title">Sua conta</h2>
        <div className="row" style={{ borderBottom: 0, padding: 0 }}>
          <Avatar name={user.name} url={user.avatar_url} />
          <span className="row-main">
            <span className="row-title" style={{ display: 'block' }}>
              {user.name}
            </span>
            <span className="row-sub" style={{ display: 'block' }}>
              {user.email}
            </span>
          </span>
          <button className="icon-btn" onClick={onEditProfile} aria-label="Editar nome">
            <Pencil size={17} />
          </button>
        </div>
        <button className="btn btn-ghost" onClick={onSignOut}>
          <LogOut size={17} /> Sair
        </button>
      </section>
    </div>
  )
}

function VehicleDetails({ user, vehicle, onEditVehicle, onAddDriver, onChanged, driversVersion }: Props & { vehicle: VehicleWithRole }) {
  const isOwner = vehicle.role === 'owner'
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [error, setError] = useState('')
  const [resending, setResending] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const otherOwners = members.some((m) => m.role === 'owner' && m.user_id !== user.id)

  async function act(userId: string, fn: () => Promise<void>) {
    setBusy(userId)
    setError('')
    try {
      await fn()
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const load = useCallback(async () => {
    setMembers(await api.listMembers(vehicle.id))
    if (isOwner) setInvites(await api.listInvites(vehicle.id))
  }, [vehicle.id, isOwner])

  useEffect(() => {
    load().catch((e) => setError((e as Error).message))
  }, [load, driversVersion])

  return (
    <>
      <section className="card stack">
        <div className="section-head">
          <div>
            <h2 className="section-title">{vehicle.name}</h2>
            <p className="hint">
              {[vehicle.brand, vehicle.model, vehicle.year, FUEL_TYPES[vehicle.fuel_type]].filter(Boolean).join(' · ') || 'Sem detalhes'}
            </p>
          </div>
          {isOwner && (
            <button className="btn btn-sm btn-ghost" onClick={() => onEditVehicle(vehicle)}>
              <Pencil size={15} /> Editar
            </button>
          )}
        </div>
      </section>

      <section className="card stack">
        <div className="section-head">
          <h2 className="section-title">Pessoas do carro</h2>
          <span className="hint">{members.length} com acesso</span>
        </div>
        <p className="hint" style={{ marginTop: -8 }}>
          <strong>Donos</strong> editam o carro e gerenciam as pessoas. <strong>Motoristas</strong> lançam gastos e veem relatórios e lembretes.
        </p>

        <div className="list">
          {members.map((m) => (
            <div key={m.user_id} className="member">
            <div className="row" style={{ borderBottom: 0 }}>
              <Avatar name={m.name || m.email} url={m.avatar_url} small />
              <span className="row-main">
                <span className="row-title" style={{ display: 'block' }}>
                  {m.name || m.email}
                  {m.user_id === user.id ? ' (você)' : ''}
                </span>
                <span className="row-sub" style={{ display: 'block' }}>
                  {m.email}
                </span>
              </span>
              <span className={`badge ${m.role === 'owner' ? 'ok' : 'neutral'}`}>{m.role === 'owner' ? 'Dono' : 'Motorista'}</span>
            </div>
              {isOwner && m.user_id !== user.id && (
                <div className="member-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={busy === m.user_id}
                    onClick={() =>
                      act(m.user_id, async () => {
                        const role = m.role === 'owner' ? 'driver' : 'owner'
                        await api.setMemberRole(vehicle.id, m.user_id, role)
                        onChanged(role === 'owner' ? `${m.name || 'Pessoa'} agora é dono` : `${m.name || 'Pessoa'} agora é motorista`)
                      })
                    }
                  >
                    {m.role === 'owner' ? <UserCog size={15} /> : <Crown size={15} />}
                    {m.role === 'owner' ? 'Tornar motorista' : 'Tornar dono'}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={busy === m.user_id}
                    onClick={() =>
                      act(m.user_id, async () => {
                        await api.removeMember(vehicle.id, m.user_id)
                        onChanged(`${m.name || 'Pessoa'} removido do carro`)
                      })
                    }
                  >
                    <UserMinus size={15} /> Remover
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isOwner ? (
          <button className="btn btn-block" onClick={() => onAddDriver(vehicle)}>
            <UserPlus size={18} /> Adicionar motorista
          </button>
        ) : (
          <p className="hint">Para adicionar outro motorista, peça ao dono do carro.</p>
        )}

        {isOwner && invites.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            <span className="label">Convites aguardando cadastro</span>
            <div className="list">
              {invites.map((i) => (
                <div key={i.id} className="row">
                  <span className="row-icon k-amber">
                    <Mail size={17} />
                  </span>
                  <span className="row-main">
                    <span className="row-title" style={{ display: 'block' }}>
                      {i.email}
                    </span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      {resending === i.id ? 'Enviando e-mail…' : 'Ainda não criou a conta'}
                    </span>
                  </span>
                  <button
                    className="icon-btn"
                    aria-label={`Reenviar convite para ${i.email}`}
                    title="Reenviar e-mail"
                    disabled={resending !== null}
                    onClick={async () => {
                      setResending(i.id)
                      try {
                        await api.sendInviteEmail(i.id)
                        onChanged(`Convite reenviado para ${i.email}`)
                      } catch (err) {
                        setError((err as Error).message)
                      } finally {
                        setResending(null)
                      }
                    }}
                  >
                    <Send size={17} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Cancelar convite de ${i.email}`}
                    onClick={async () => {
                      await api.deleteInvite(i.id)
                      await load()
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </section>

      <section className="card stack">
        <h2 className="section-title">Zona de risco</h2>
        {isOwner && (
          <>
            <p className="hint">Excluir o carro apaga todos os lançamentos e lembretes dele, para todas as pessoas.</p>
            <DeleteVehicle vehicle={vehicle} onDeleted={() => onChanged('Carro excluído')} />
          </>
        )}
        {(!isOwner || otherOwners) && (
          <>
            <p className="hint">Ao sair, você deixa de ver este carro. Os lançamentos que você fez continuam lá.</p>
            <DeleteButton
              label="Sair deste carro"
              onConfirm={async () => {
                try {
                  await api.removeMember(vehicle.id, user.id)
                  onChanged('Você saiu do carro')
                } catch (err) {
                  setError((err as Error).message)
                }
              }}
            />
          </>
        )}
        {isOwner && !otherOwners && <p className="hint">Você é o único dono. Para sair do carro, torne outra pessoa dona antes.</p>}
      </section>
    </>
  )
}
