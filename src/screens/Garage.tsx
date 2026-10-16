import { useCallback, useEffect, useState } from 'react'
import { CarFront, Copy, KeyRound, LogOut, Mail, MessageCircle, Pencil, Plus, RefreshCw, Send, UserMinus, X } from 'lucide-react'
import { api, type VehicleWithRole } from '../lib/api'
import { initials, km } from '../lib/format'
import { FUEL_TYPES, type Invite, type Member, type Profile } from '../lib/types'
import { DeleteButton } from '../components/ui'
import { inviteLink } from '../lib/pending-code'
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
          <span className="avatar">{initials(user.name)}</span>
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

function VehicleDetails({ user, vehicle, onEditVehicle, onChanged }: Props & { vehicle: VehicleWithRole }) {
  const isOwner = vehicle.role === 'owner'
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [code, setCode] = useState(vehicle.invite_code)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [share, setShare] = useState<{ email: string; status: 'sending' | 'sent' | 'failed'; error?: string } | null>(null)
  const shareTo = share?.email ?? null

  const load = useCallback(async () => {
    setMembers(await api.listMembers(vehicle.id))
    if (isOwner) setInvites(await api.listInvites(vehicle.id))
  }, [vehicle.id, isOwner])

  useEffect(() => {
    load().catch((e) => setError((e as Error).message))
  }, [load])

  useEffect(() => setCode(vehicle.invite_code), [vehicle.invite_code])

  const shareText = `Você foi convidado para o ${vehicle.name} no Autobil. Abra o link, crie sua conta e o carro já aparece: ${inviteLink(code)} (código ${code})`

  // Mensagem para avisar também por WhatsApp (ou quando o e-mail automático falhar)
  const emailText = (addr: string) =>
    `Oi! Te adicionei como motorista do ${vehicle.name} no Autobil. Abra ${inviteLink(code)} e crie sua conta com o e-mail ${addr}. O carro já vai aparecer pra você.`

  async function sendEmail(inviteId: string, to: string) {
    setShare({ email: to, status: 'sending' })
    try {
      await api.sendInviteEmail(inviteId)
      setShare({ email: to, status: 'sent' })
    } catch (err) {
      setShare({ email: to, status: 'failed', error: (err as Error).message })
    }
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMsg(done)
    } catch {
      setMsg('Não deu para copiar automaticamente. Selecione o código e copie.')
    }
    setTimeout(() => setMsg(''), 2500)
  }

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
          <button className="btn btn-sm btn-ghost" onClick={() => onEditVehicle(vehicle)}>
            <Pencil size={15} /> Editar
          </button>
        </div>
      </section>

      <section className="card stack">
        <div className="section-head">
          <h2 className="section-title">Motoristas</h2>
          <span className="hint">{members.length} com acesso</span>
        </div>
        <p className="hint" style={{ marginTop: -8 }}>
          Todos os motoristas veem e lançam abastecimentos, despesas e serviços deste carro.
        </p>

        <div className="list">
          {members.map((m) => (
            <div key={m.user_id} className="row">
              <span className="avatar avatar-sm">{initials(m.name)}</span>
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
              {isOwner && m.role !== 'owner' && (
                <button
                  className="icon-btn"
                  aria-label={`Remover ${m.name}`}
                  onClick={async () => {
                    await api.removeMember(vehicle.id, m.user_id)
                    await load()
                    onChanged(`${m.name || 'Motorista'} removido`)
                  }}
                >
                  <UserMinus size={17} />
                </button>
              )}
            </div>
          ))}
        </div>

        {isOwner ? (
          <>
            <div className="stack" style={{ gap: 8 }}>
              <span className="label">Convidar com código</span>
              <div className="code-box">
                <strong aria-label="Código de convite">{code}</strong>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="icon-btn" aria-label="Copiar convite" onClick={() => copy(shareText, 'Convite copiado. Cole no WhatsApp.')}>
                    <Copy size={17} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Gerar novo código"
                    title="Gerar novo código (o atual deixa de valer)"
                    onClick={async () => {
                      setCode(await api.regenerateCode(vehicle.id))
                      onChanged('Novo código gerado')
                    }}
                  >
                    <RefreshCw size={17} />
                  </button>
                </div>
              </div>
              <span className="hint">Copie e mande pelo WhatsApp: o link já leva o código. Ou a pessoa digita o código na tela de login.</span>
            </div>

            <form
              className="stack"
              style={{ gap: 8 }}
              onSubmit={async (e) => {
                e.preventDefault()
                setError('')
                if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Digite um e-mail válido.')
                try {
                  const to = email.trim().toLowerCase()
                  const inviteId = await api.createInvite(vehicle.id, to)
                  setEmail('')
                  await load()
                  await sendEmail(inviteId, to)
                } catch (err) {
                  setError((err as Error).message)
                }
              }}
            >
              <label className="label" htmlFor="invite-email">
                Convidar por e-mail
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="invite-email" className="input" type="email" placeholder="motorista@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="btn" aria-label="Convidar">
                  <Mail size={17} />
                </button>
              </div>
              <span className="hint">A pessoa recebe um e-mail com o link. Quando criar a conta com este e-mail, o carro aparece pra ela.</span>
            </form>

            {share && shareTo && (
              <div className="invite-box" role="status">
                <div className="section-head" style={{ alignItems: 'center' }}>
                  <span className="label">
                    {share.status === 'sending' && `Enviando e-mail para ${shareTo}…`}
                    {share.status === 'sent' && `✓ Convite enviado para ${shareTo}`}
                    {share.status === 'failed' && `Avise ${shareTo}`}
                  </span>
                  <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Fechar" onClick={() => setShare(null)}>
                    <X size={16} />
                  </button>
                </div>
                {share.status === 'failed' && (
                  <p className="hint">O e-mail automático não saiu ({share.error}). Mande a mensagem abaixo por outro caminho:</p>
                )}
                {share.status === 'sent' && <p className="hint">Se não chegar em alguns minutos, peça para olhar o spam ou avise também pelo WhatsApp:</p>}
                {share.status === 'failed' && <p style={{ fontSize: 14 }}>{emailText(shareTo)}</p>}
                {share.status !== 'sending' && (
                <div className="share-actions">
                  <a className="btn btn-sm" href={`https://wa.me/?text=${encodeURIComponent(emailText(shareTo))}`} target="_blank" rel="noreferrer">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                  <a
                    className="btn btn-sm btn-ghost"
                    href={`mailto:${shareTo}?subject=${encodeURIComponent(`Convite para o ${vehicle.name} no Autobil`)}&body=${encodeURIComponent(emailText(shareTo))}`}
                  >
                    <Mail size={16} /> E-mail
                  </a>
                  <button className="btn btn-sm btn-ghost" onClick={() => copy(emailText(shareTo), 'Mensagem copiada.')}>
                    <Copy size={16} /> Copiar
                  </button>
                </div>
                )}
              </div>
            )}

            {invites.length > 0 && (
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
                        Aguardando cadastro
                      </span>
                    </span>
                    <button
                      className="icon-btn"
                      aria-label={`Reenviar convite para ${i.email}`}
                      title="Reenviar e-mail"
                      disabled={share?.status === 'sending'}
                      onClick={() => sendEmail(i.id, i.email)}
                    >
                      <Send size={17} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Cancelar convite"
                      onClick={async () => {
                        await api.deleteInvite(i.id)
                        if (shareTo === i.email) setShare(null)
                        await load()
                      }}
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {msg && <div className="notice">{msg}</div>}
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card stack">
        <h2 className="section-title">Zona de risco</h2>
        {isOwner ? (
          <>
            <p className="hint">Excluir o carro apaga todos os lançamentos e lembretes dele, para todos os motoristas.</p>
            <DeleteVehicle vehicle={vehicle} onDeleted={() => onChanged('Carro excluído')} />
          </>
        ) : (
          <>
            <p className="hint">Ao sair, você deixa de ver este carro. Os lançamentos que você fez continuam lá.</p>
            <DeleteButton
              label="Sair deste carro"
              onConfirm={async () => {
                await api.removeMember(vehicle.id, user.id)
                onChanged('Você saiu do carro')
              }}
            />
          </>
        )}
      </section>
    </>
  )
}
