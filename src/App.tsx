import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, CarFront, ChartColumn, ChevronDown, House, KeyRound, List, LogOut, Plus, Warehouse } from 'lucide-react'
import { api, type VehicleWithRole } from './lib/api'
import { currentOdometer } from './lib/calc'
import { initials } from './lib/format'
import { getPendingCode, setPendingCode } from './lib/pending-code'
import type { Entry, EntryKind, Profile, Reminder } from './lib/types'
import { EntryForm } from './components/EntryForm'
import { JoinForm, NewPasswordForm, ProfileForm, ReminderForm, VehicleForm } from './components/Forms'
import { Logo, Spinner } from './components/ui'
import { Auth } from './screens/Auth'
import { Garage } from './screens/Garage'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Reminders } from './screens/Reminders'
import { Reports } from './screens/Reports'

type Tab = 'home' | 'history' | 'reminders' | 'reports' | 'garage'
type SheetState =
  | { type: 'entry'; kind: EntryKind; entry?: Entry }
  | { type: 'reminder'; reminder?: Reminder }
  | { type: 'vehicle'; vehicle?: VehicleWithRole }
  | { type: 'join' }
  | { type: 'profile' }
  | null

const VEHICLE_KEY = 'autobil-current-vehicle'
const readStored = () => {
  try {
    return localStorage.getItem(VEHICLE_KEY)
  } catch {
    return null
  }
}

const NAV: { tab: Tab; label: string; icon: typeof House }[] = [
  { tab: 'home', label: 'Início', icon: House },
  { tab: 'history', label: 'Histórico', icon: List },
  { tab: 'reminders', label: 'Lembretes', icon: BellRing },
  { tab: 'reports', label: 'Relatórios', icon: ChartColumn },
  { tab: 'garage', label: 'Garagem', icon: Warehouse },
]

export default function App() {
  const [user, setUser] = useState<Profile | null | undefined>(undefined)
  const [vehicles, setVehicles] = useState<VehicleWithRole[] | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(readStored)
  const [entries, setEntries] = useState<Entry[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [toast, setToast] = useState('')
  const [menu, setMenu] = useState<'vehicle' | 'user' | null>(null)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => api.onPasswordRecovery(() => setRecovering(true)), [])

  // Sessão
  useEffect(() => {
    api.getUser().then(setUser)
    return api.onAuthChange(setUser)
  }, [])

  const loadVehicles = useCallback(async () => {
    const list = await api.listVehicles()
    setVehicles(list)
    setCurrentId((cur) => (cur && list.some((v) => v.id === cur) ? cur : list[0]?.id ?? null))
    return list
  }, [])

  useEffect(() => {
    if (!user) {
      setVehicles(null)
      return
    }
    ;(async () => {
      try {
        const n = await api.acceptPendingInvites()
        if (n > 0) setToast(n === 1 ? 'Você foi adicionado a um carro' : `Você foi adicionado a ${n} carros`)
      } catch {
        /* segue sem convites por e-mail */
      }
      // Código digitado na tela de login (ou recebido pelo link de convite)
      const pending = getPendingCode()
      if (pending) {
        setPendingCode(null)
        try {
          const vid = await api.joinByCode(pending)
          setCurrentId(vid)
          setTab('home')
          setToast('Pronto! Você entrou no carro.')
        } catch (err) {
          setToast((err as Error).message)
        }
      }
      await loadVehicles()
    })()
  }, [user, loadVehicles])

  const loadVehicleData = useCallback(async () => {
    if (!currentId) {
      setEntries([])
      setReminders([])
      return
    }
    const [e, r] = await Promise.all([api.listEntries(currentId), api.listReminders(currentId)])
    setEntries(e)
    setReminders(r)
  }, [currentId])

  useEffect(() => {
    try {
      if (currentId) localStorage.setItem(VEHICLE_KEY, currentId)
    } catch {
      /* ignora */
    }
    loadVehicleData().catch((err) => setToast((err as Error).message))
  }, [currentId, loadVehicleData])

  // Atualiza ao voltar para o app (outro motorista pode ter lançado algo)
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && user && loadVehicleData().catch(() => {})
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user, loadVehicleData])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const vehicle = vehicles?.find((v) => v.id === currentId) ?? null
  const odometer = useMemo(() => (vehicle ? currentOdometer(vehicle, entries) : 0), [vehicle, entries])

  async function afterSave(message: string, newVehicleId?: string) {
    setSheet(null)
    setToast(message)
    await loadVehicles()
    if (newVehicleId) setCurrentId(newVehicleId)
    await loadVehicleData()
  }

  function go(t: Tab) {
    setTab(t)
    setMenu(null)
    window.scrollTo({ top: 0 })
  }

  if (user === undefined) return <Spinner />
  if (user === null) return <Auth />

  const demoBanner = api.mode === 'demo' && (
    <div className="demo-banner">Modo demonstração · dados salvos só neste navegador</div>
  )

  const sheets = (
    <>
      {sheet?.type === 'entry' && vehicle && (
        <EntryForm
          vehicle={vehicle}
          kind={sheet.kind}
          entry={sheet.entry}
          reminders={reminders}
          odometer={odometer}
          onClose={() => setSheet(null)}
          onSaved={afterSave}
        />
      )}
      {sheet?.type === 'reminder' && vehicle && (
        <ReminderForm vehicleId={vehicle.id} reminder={sheet.reminder} odometer={odometer} onClose={() => setSheet(null)} onSaved={afterSave} />
      )}
      {sheet?.type === 'vehicle' && <VehicleForm vehicle={sheet.vehicle} onClose={() => setSheet(null)} onSaved={afterSave} />}
      {sheet?.type === 'join' && (
        <JoinForm
          onClose={() => setSheet(null)}
          onJoined={(id) => {
            afterSave('Pronto! Você entrou no carro.', id)
            setTab('home')
          }}
        />
      )}
      {sheet?.type === 'profile' && (
        <ProfileForm
          name={user.name}
          onClose={() => setSheet(null)}
          onSaved={async (m) => {
            setSheet(null)
            setToast(m)
            setUser(await api.getUser())
          }}
        />
      )}
      {recovering && (
        <NewPasswordForm
          onCancel={() => setRecovering(false)}
          onDone={() => {
            setRecovering(false)
            setToast('Senha atualizada')
            history.replaceState(null, '', window.location.pathname)
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )

  if (vehicles === null) return <Spinner />

  // Primeiro acesso: sem carros
  if (vehicles.length === 0) {
    return (
      <>
        {demoBanner}
        <div className="container" style={{ maxWidth: 560 }}>
          <div className="page" style={{ paddingTop: 32 }}>
            <Logo size={40} />
            <div>
              <h1 className="page-title">Olá, {user.name.split(' ')[0]}!</h1>
              <p className="ink-2" style={{ marginTop: 6 }}>
                Vamos começar. Cadastre seu carro ou entre num carro que alguém já cadastrou.
              </p>
            </div>
            <button className="quick-btn" style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }} onClick={() => setSheet({ type: 'vehicle' })}>
              <span className="stat-icon k-primary">
                <CarFront size={20} />
              </span>
              <span>
                Cadastrar meu carro
                <span className="hint" style={{ display: 'block', fontWeight: 500 }}>
                  Você vira o dono e pode convidar motoristas.
                </span>
              </span>
            </button>
            <button className="quick-btn" style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }} onClick={() => setSheet({ type: 'join' })}>
              <span className="stat-icon k-amber">
                <KeyRound size={20} />
              </span>
              <span>
                Tenho um código de convite
                <span className="hint" style={{ display: 'block', fontWeight: 500 }}>
                  Para motoristas de um carro que já está no Autobil.
                </span>
              </span>
            </button>
            <button className="btn btn-ghost" onClick={() => api.signOut()}>
              <LogOut size={17} /> Sair
            </button>
          </div>
        </div>
        {sheets}
      </>
    )
  }

  return (
    <>
      {demoBanner}
      <div className="app">
        <nav className="sidebar" aria-label="Menu">
          <Logo />
          {NAV.map(({ tab: t, label, icon: Icon }) => (
            <button key={t} className="side-btn" aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
              <Icon size={19} /> {label}
            </button>
          ))}
          <button className="btn side-new" onClick={() => setSheet({ type: 'entry', kind: 'fuel' })}>
            <Plus size={18} /> Novo lançamento
          </button>
        </nav>

        <div className="main">
          <header className="topbar">
            {menu && <div style={{ position: 'fixed', inset: 0, zIndex: 35 }} onClick={() => setMenu(null)} aria-hidden="true" />}
            <div className="container topbar-inner">
              <div className="brand-mobile">
                <img src="/icon.svg" alt="Autobil" width={34} height={34} style={{ borderRadius: 10 }} />
              </div>
              <div style={{ position: 'relative', minWidth: 0, flex: 1 }}>
                <button className="vehicle-pill" onClick={() => setMenu(menu === 'vehicle' ? null : 'vehicle')} aria-expanded={menu === 'vehicle'} style={{ maxWidth: '100%' }}>
                  <span className="row-icon k-primary">
                    <CarFront size={18} />
                  </span>
                  <span className="vehicle-pill-text">
                    <span>{vehicle?.role === 'owner' ? 'Seu carro' : 'Motorista'}</span>
                    <strong>{vehicle?.name}</strong>
                  </span>
                  <ChevronDown size={16} style={{ flexShrink: 0, color: 'var(--muted)' }} />
                </button>
                {menu === 'vehicle' && (
                  <div className="menu" style={{ left: 0, right: 'auto' }}>
                    {vehicles.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setCurrentId(v.id)
                          setMenu(null)
                        }}
                        style={v.id === currentId ? { color: 'var(--primary)' } : undefined}
                      >
                        <CarFront size={17} /> {v.name}
                        {v.plate && <span className="hint">{v.plate}</span>}
                      </button>
                    ))}
                    <button onClick={() => go('garage')} style={{ borderTop: '1px solid var(--line)', borderRadius: 0, marginTop: 4 }}>
                      <Warehouse size={17} /> Gerenciar garagem
                    </button>
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <button className="avatar" onClick={() => setMenu(menu === 'user' ? null : 'user')} aria-label="Sua conta" aria-expanded={menu === 'user'}>
                  {initials(user.name)}
                </button>
                {menu === 'user' && (
                  <div className="menu">
                    <div className="menu-head">
                      <strong style={{ display: 'block' }}>{user.name}</strong>
                      <span className="hint">{user.email}</span>
                    </div>
                    <button onClick={() => go('reminders')}>
                      <BellRing size={17} /> Lembretes
                    </button>
                    <button onClick={() => go('garage')}>
                      <Warehouse size={17} /> Garagem e motoristas
                    </button>
                    <button onClick={() => api.signOut()}>
                      <LogOut size={17} /> Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="container">
            {vehicle && tab === 'home' && (
              <Home
                vehicle={vehicle}
                entries={entries}
                reminders={reminders}
                odometer={odometer}
                onAdd={(kind) => setSheet({ type: 'entry', kind })}
                onEdit={(entry) => setSheet({ type: 'entry', kind: entry.kind, entry })}
                onGo={go}
                onEditReminder={(reminder) => setSheet({ type: 'reminder', reminder })}
              />
            )}
            {tab === 'history' && (
              <History entries={entries} onEdit={(entry) => setSheet({ type: 'entry', kind: entry.kind, entry })} onAdd={() => setSheet({ type: 'entry', kind: 'fuel' })} />
            )}
            {tab === 'reminders' && (
              <Reminders
                reminders={reminders}
                odometer={odometer}
                onAdd={() => setSheet({ type: 'reminder' })}
                onEdit={(reminder) => setSheet({ type: 'reminder', reminder })}
                onChanged={(m) => afterSave(m)}
              />
            )}
            {tab === 'reports' && <Reports entries={entries} />}
            {tab === 'garage' && (
              <Garage
                user={user}
                vehicles={vehicles}
                currentId={currentId}
                odometerOf={(v) => (v.id === currentId ? odometer : v.initial_odometer)}
                onSelect={setCurrentId}
                onAddVehicle={() => setSheet({ type: 'vehicle' })}
                onJoin={() => setSheet({ type: 'join' })}
                onEditVehicle={(v) => setSheet({ type: 'vehicle', vehicle: v })}
                onEditProfile={() => setSheet({ type: 'profile' })}
                onChanged={(m) => afterSave(m)}
                onSignOut={() => api.signOut()}
              />
            )}
          </main>
        </div>

        <nav className="bottom-nav" aria-label="Menu">
          <div className="bottom-nav-inner">
            {NAV.filter((n) => n.tab !== 'reminders')
              .slice(0, 2)
              .map(({ tab: t, label, icon: Icon }) => (
                <button key={t} className="nav-btn" aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
                  <Icon size={22} />
                  {label}
                </button>
              ))}
            <button className="nav-fab" aria-label="Novo lançamento" onClick={() => setSheet({ type: 'entry', kind: 'fuel' })}>
              <Plus size={26} />
            </button>
            {NAV.filter((n) => n.tab === 'reports' || n.tab === 'garage').map(({ tab: t, label, icon: Icon }) => (
              <button key={t} className="nav-btn" aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
                <Icon size={22} />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </div>
      {sheets}
    </>
  )
}
