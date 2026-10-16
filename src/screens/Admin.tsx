import { useCallback, useEffect, useMemo, useState } from 'react'
import { CarFront, RefreshCw, Search, ShieldCheck, UserX, UserCheck } from 'lucide-react'
import { api } from '../lib/api'
import type { AdminOverview, AdminUser, AdminVehicle } from '../lib/admin-types'
import { brl, num } from '../lib/format'
import { Avatar } from '../components/Avatar'
import { DeleteButton, Spinner } from '../components/ui'

const when = (iso: string | null) => {
  if (!iso) return 'nunca'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`
  return d.toLocaleDateString('pt-BR')
}

export function Admin({ currentUserId, onToast }: { currentUserId: string; onToast: (m: string) => void }) {
  const [tab, setTab] = useState<'users' | 'vehicles'>('users')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [vehicles, setVehicles] = useState<AdminVehicle[] | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [o, u, v] = await Promise.all([api.adminOverview(), api.adminUsers(), api.adminVehicles()])
      setOverview(o)
      setUsers(u)
      setVehicles(v)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const term = q.trim().toLowerCase()
  const shownUsers = useMemo(() => (users ?? []).filter((u) => !term || `${u.name} ${u.email}`.toLowerCase().includes(term)), [users, term])
  const shownVehicles = useMemo(
    () => (vehicles ?? []).filter((v) => !term || `${v.name} ${v.plate} ${v.brand} ${v.model} ${v.owners}`.toLowerCase().includes(term)),
    [vehicles, term],
  )

  async function act(id: string, fn: () => Promise<void>, msg: string) {
    setBusy(id)
    try {
      await fn()
      onToast(msg)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (error && !overview) return <div className="page"><h1 className="page-title">Painel do administrador</h1><div className="error">{error}</div></div>
  if (!overview || !users || !vehicles) return <Spinner />

  return (
    <div className="page">
      <div className="section-head">
        <h1 className="page-title">
          <ShieldCheck size={24} style={{ verticalAlign: -3, color: 'var(--primary)' }} /> Administrador
        </h1>
        <button className="icon-btn" onClick={load} aria-label="Atualizar">
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">Usuários</span>
          <span className="stat-value">{num(overview.users)}</span>
          <span className="hint">+{overview.users_30d} em 30 dias · {overview.active_7d} ativos na semana</span>
        </div>
        <div className="stat">
          <span className="stat-label">Carros</span>
          <span className="stat-value">{num(overview.vehicles)}</span>
          <span className="hint">{overview.trips} viagens</span>
        </div>
        <div className="stat">
          <span className="stat-label">Lançamentos</span>
          <span className="stat-value">{num(overview.entries)}</span>
          <span className="hint">+{overview.entries_30d} em 30 dias</span>
        </div>
        <div className="stat">
          <span className="stat-label">Gasto registrado</span>
          <span className="stat-value">{brl(overview.total_spent)}</span>
          <span className="hint">soma de todos os carros</span>
        </div>
      </div>

      <section className="card stack">
        <div className="filter-row">
          <div className="segmented" role="group" aria-label="Lista">
            <button aria-pressed={tab === 'users'} onClick={() => setTab('users')}>
              Usuários ({users.length})
            </button>
            <button aria-pressed={tab === 'vehicles'} onClick={() => setTab('vehicles')}>
              Carros ({vehicles.length})
            </button>
          </div>
          <div className="input-wrap" style={{ flex: '1 1 200px' }}>
            <Search size={17} className="prefix" style={{ left: 14 }} />
            <input id="admin-search" className="input has-prefix" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {tab === 'users' && (
          <div className="list">
            {shownUsers.length === 0 && <p className="hint">Nenhum usuário encontrado.</p>}
            {shownUsers.map((u) => (
              <div key={u.id} className="member">
                <div className="row" style={{ borderBottom: 0 }}>
                  <Avatar name={u.name || u.email} url={u.avatar_url} small />
                  <span className="row-main">
                    <span className="row-title" style={{ display: 'block' }}>
                      {u.name || '(sem nome)'}
                      {u.id === currentUserId ? ' (você)' : ''}
                    </span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      {u.email}
                    </span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      Entrou {when(u.created_at)} · último acesso {when(u.last_sign_in_at)} · {u.vehicles} carros · {u.entries} lançamentos
                    </span>
                  </span>
                  {u.is_admin && <span className="badge ok">Admin</span>}
                  {u.disabled && <span className="badge overdue">Desativada</span>}
                </div>
                {u.id !== currentUserId && (
                  <div className="member-actions">
                    <button
                      className="btn btn-sm btn-ghost"
                      disabled={busy === u.id}
                      onClick={() =>
                        act(u.id, () => api.adminSetUserDisabled(u.id, !u.disabled), u.disabled ? `${u.email} reativada` : `${u.email} desativada`)
                      }
                    >
                      {u.disabled ? <UserCheck size={15} /> : <UserX size={15} />} {u.disabled ? 'Reativar' : 'Desativar'}
                    </button>
                    <DeleteButton label="Excluir conta" onConfirm={() => act(u.id, () => api.adminDeleteUser(u.id), `${u.email} excluída`)} />
                  </div>
                )}
              </div>
            ))}
            <p className="hint">
              Desativar impede a pessoa de entrar (o acesso atual expira em até 1 hora). Excluir apaga a conta e os carros em que ela é a única dona.
            </p>
          </div>
        )}

        {tab === 'vehicles' && (
          <div className="list">
            {shownVehicles.length === 0 && <p className="hint">Nenhum carro encontrado.</p>}
            {shownVehicles.map((v) => (
              <div key={v.id} className="row">
                <span className="row-icon k-primary">
                  <CarFront size={19} />
                </span>
                <span className="row-main">
                  <span className="row-title" style={{ display: 'block' }}>
                    {v.name}
                    {v.plate ? ` · ${v.plate}` : ''}
                  </span>
                  <span className="row-sub" style={{ display: 'block' }}>
                    {[v.brand, v.model].filter(Boolean).join(' ') || 'Sem modelo'} · dono: {v.owners || '—'} · {v.people} pessoas
                  </span>
                  <span className="row-sub" style={{ display: 'block' }}>
                    {v.entries} lançamentos · último {v.last_entry ? new Date(v.last_entry + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                  </span>
                </span>
                <span className="row-amount">{brl(v.total_spent)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
