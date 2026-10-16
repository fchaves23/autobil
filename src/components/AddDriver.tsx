import { useState } from 'react'
import { Copy, Mail, MessageCircle, RefreshCw, Send, UserPlus } from 'lucide-react'
import { api } from '../lib/api'
import { inviteLink } from '../lib/pending-code'
import type { Vehicle } from '../lib/types'
import { Field, Sheet } from './ui'

type Way = 'link' | 'email'
type EmailState = { to: string; status: 'sending' | 'sent' | 'failed'; error?: string } | null

export function AddDriverSheet({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [way, setWay] = useState<Way>('link')
  const [code, setCode] = useState(vehicle.invite_code)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<EmailState>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const linkText = `Oi! Te adicionei como motorista do ${vehicle.name} no Autobil. Abra o link, crie sua conta e o carro já aparece: ${inviteLink(code)} (código ${code})`
  const emailFallback = (to: string) =>
    `Oi! Te adicionei como motorista do ${vehicle.name} no Autobil. Abra ${inviteLink(code)} e crie sua conta com o e-mail ${to}. O carro já vai aparecer pra você.`

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMsg('Convite copiado. É só colar na conversa.')
    } catch {
      setMsg('Não deu para copiar automaticamente. Selecione o texto e copie.')
    }
    setTimeout(() => setMsg(''), 2500)
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const to = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(to)) return setError('Digite um e-mail válido.')
    setSent({ to, status: 'sending' })
    try {
      const inviteId = await api.createInvite(vehicle.id, to)
      try {
        await api.sendInviteEmail(inviteId)
        setSent({ to, status: 'sent' })
      } catch (err) {
        setSent({ to, status: 'failed', error: (err as Error).message })
      }
      setEmail('')
    } catch (err) {
      setSent(null)
      setError((err as Error).message)
    }
  }

  return (
    <Sheet title="Adicionar motorista" onClose={onClose}>
      <div className="stack">
        <p className="ink-2" style={{ marginTop: -6 }}>
          O motorista vê o <strong>{vehicle.name}</strong> e lança abastecimentos, despesas e serviços junto com você.
        </p>

        <div className="segmented" role="group" aria-label="Como convidar">
          <button type="button" aria-pressed={way === 'link'} onClick={() => setWay('link')}>
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button type="button" aria-pressed={way === 'email'} onClick={() => setWay('email')}>
            <Mail size={16} /> E-mail
          </button>
        </div>

        {way === 'link' && (
          <>
            <div className="code-box">
              <div>
                <span className="hint" style={{ display: 'block' }}>
                  Código do carro
                </span>
                <strong aria-label="Código de convite">{code}</strong>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Gerar novo código"
                title="Gerar novo código (o atual deixa de valer)"
                onClick={async () => {
                  try {
                    setCode(await api.regenerateCode(vehicle.id))
                    setMsg('Novo código gerado. O anterior não vale mais.')
                  } catch (err) {
                    setError((err as Error).message)
                  }
                }}
              >
                <RefreshCw size={17} />
              </button>
            </div>
            <a className="btn btn-block" href={`https://wa.me/?text=${encodeURIComponent(linkText)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> Enviar convite no WhatsApp
            </a>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => copy(linkText)}>
              <Copy size={17} /> Copiar convite
            </button>
            <p className="hint">
              A pessoa abre o link, cria a conta e o carro já aparece. Também dá para digitar o código em “Tenho um código de convite”, na tela de login.
            </p>
          </>
        )}

        {way === 'email' && (
          <>
            {sent?.status !== 'sent' && sent?.status !== 'failed' && (
              <form className="stack" onSubmit={invite}>
                <Field label="E-mail do motorista">
                  <input
                    id="driver-email"
                    className="input"
                    type="email"
                    autoFocus
                    placeholder="motorista@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <button className="btn btn-block" disabled={sent?.status === 'sending'}>
                  <Send size={17} /> {sent?.status === 'sending' ? 'Enviando…' : 'Enviar convite por e-mail'}
                </button>
                <p className="hint">A pessoa recebe um e-mail do Autobil. Quando criar a conta com este e-mail, o carro aparece pra ela.</p>
              </form>
            )}

            {sent?.status === 'sent' && (
              <div className="invite-box" role="status">
                <span className="label">✓ Convite enviado para {sent.to}</span>
                <p className="hint">Se não chegar em alguns minutos, peça para olhar o spam.</p>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSent(null)}>
                  <UserPlus size={16} /> Convidar outra pessoa
                </button>
              </div>
            )}

            {sent?.status === 'failed' && (
              <div className="invite-box" role="status">
                <span className="label">Convite salvo para {sent.to}</span>
                <p className="hint">O e-mail automático não saiu ({sent.error}). Avise a pessoa por outro caminho:</p>
                <div className="share-actions">
                  <a className="btn btn-sm" href={`https://wa.me/?text=${encodeURIComponent(emailFallback(sent.to))}`} target="_blank" rel="noreferrer">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => copy(emailFallback(sent.to))}>
                    <Copy size={16} /> Copiar
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSent(null)}>
                    <UserPlus size={16} /> Outra pessoa
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {msg && <div className="notice">{msg}</div>}
        {error && <div className="error">{error}</div>}
      </div>
    </Sheet>
  )
}
