import { useState } from 'react'
import { KeyRound, X } from 'lucide-react'
import { api } from '../lib/api'
import { getPendingCode, normalizeCode, setPendingCode } from '../lib/pending-code'
import { Field, Logo } from '../components/ui'

type Mode = 'signin' | 'signup' | 'reset'

export function Auth() {
  const [code, setCode] = useState(() => getPendingCode() ?? '')
  const [showCode, setShowCode] = useState(() => !!getPendingCode())
  // Quem chega com código geralmente é motorista novo: abre direto em "Criar conta"
  const [mode, setMode] = useState<Mode>(() => (getPendingCode() ? 'signup' : 'signin'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const demo = api.mode === 'demo'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (showCode && mode !== 'reset') {
      if (code.length !== 6) return setError('O código de convite tem 6 caracteres.')
      setPendingCode(code)
    }
    setBusy(true)
    try {
      if (mode === 'signin') await api.signIn(email.trim(), password)
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Digite seu nome.')
        const { needsConfirmation } = await api.signUp(name.trim(), email.trim(), password)
        if (needsConfirmation) {
          setInfo('Conta criada! Enviamos um link para seu e-mail. Confirme e depois entre aqui.')
          setMode('signin')
        }
      }
      if (mode === 'reset') {
        await api.resetPassword(email.trim())
        setInfo('Se houver uma conta com este e-mail, você vai receber um link para criar nova senha.')
        setMode('signin')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <aside className="auth-side">
        <Logo size={40} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1>As contas do seu carro, no automático.</h1>
          <p>Abastecimentos, despesas, manutenções e consumo num só lugar. Divida o carro com outros motoristas e todo mundo lança.</p>
        </div>
        <svg className="auth-gauge" viewBox="0 0 512 512" aria-hidden="true">
          <path d="M126.1 361 A150 150 0 1 1 385.9 361" fill="none" stroke="#fff" strokeWidth="44" strokeLinecap="round" />
          <path d="M256 286 L340 202" fill="none" stroke="#FFB224" strokeWidth="40" strokeLinecap="round" />
          <circle cx="256" cy="286" r="34" fill="#fff" />
        </svg>
      </aside>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div className="topbar-brand" style={{ marginBottom: 12 }}>
            <Logo size={38} />
          </div>
          <div>
            <h2>{mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Recuperar senha'}</h2>
            <p className="ink-2" style={{ marginTop: 4 }}>
              {mode === 'signin'
                ? 'Bom te ver de novo.'
                : mode === 'signup'
                  ? 'Grátis. Leva menos de um minuto.'
                  : 'Enviamos um link para você criar uma nova senha.'}
            </p>
          </div>

          {demo && (
            <div className="notice">Modo demonstração: use qualquer e-mail e senha. Os dados ficam só neste navegador, com um carro de exemplo.</div>
          )}

          {showCode && mode !== 'reset' && (
            <div className="invite-box">
              <div className="section-head" style={{ alignItems: 'center' }}>
                <label className="label" htmlFor="auth-code">
                  Código de convite
                </label>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 32, height: 32 }}
                  aria-label="Remover código"
                  onClick={() => {
                    setShowCode(false)
                    setCode('')
                    setPendingCode(null)
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <input
                id="auth-code"
                className="input num code-input"
                value={code}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="BYD8PT"
                onChange={(e) => setCode(normalizeCode(e.target.value))}
              />
              <span className="hint">
                {mode === 'signup' ? 'Crie sua conta' : 'Entre na sua conta'} e o carro aparece pra você na hora.
              </span>
            </div>
          )}

          {mode === 'signup' && (
            <Field label="Seu nome">
              <input id="auth-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como os motoristas vão te ver" />
            </Field>
          )}
          <Field label="E-mail">
            <input id="auth-email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </Field>
          {mode !== 'reset' && (
            <Field label="Senha" hint={mode === 'signup' ? 'Mínimo de 6 caracteres.' : undefined}>
              <input
                id="auth-password"
                className="input"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required={!demo}
                minLength={demo ? undefined : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}

          {error && <div className="error">{error}</div>}
          {info && <div className="notice">{info}</div>}

          <button className="btn btn-block" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            {mode === 'signin' ? (
              <>
                <button type="button" className="link" onClick={() => setMode('signup')}>
                  Criar conta
                </button>
                {!demo && (
                  <button type="button" className="link" style={{ color: 'var(--muted)' }} onClick={() => setMode('reset')}>
                    Esqueci a senha
                  </button>
                )}
              </>
            ) : (
              <button type="button" className="link" onClick={() => setMode('signin')}>
                Já tenho conta
              </button>
            )}
          </div>

          {!showCode && mode !== 'reset' && (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setShowCode(true)}>
              <KeyRound size={18} /> Tenho um código de convite
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
