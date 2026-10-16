// Modo demonstração: tudo fica no navegador (localStorage), com dados de exemplo.
// Usado quando o .env.local não tem as chaves do Supabase.
import type { Api, VehicleWithRole } from './api'
import type { Entry, Invite, Profile, Reminder, Role, Settlement, Trip, Vehicle } from './types'
import { addDays, toISODate } from './format'

interface Store {
  user: Profile | null
  profiles: Profile[]
  vehicles: Vehicle[]
  members: { vehicle_id: string; user_id: string; role: Role }[]
  invites: Invite[]
  entries: Entry[]
  reminders: Reminder[]
  trips: Trip[]
  settlements: Settlement[]
}

const KEY = 'autobil-demo-v1'
const empty = (): Store => ({ user: null, profiles: [], vehicles: [], members: [], invites: [], entries: [], reminders: [], trips: [], settlements: [] })

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty()
  } catch {
    return empty()
  }
}

let store = load()
const listeners = new Set<(u: Profile | null) => void>()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* sem armazenamento: segue só na memória */
  }
}

const id = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
const now = () => new Date().toISOString()
const wait = () => new Promise((r) => setTimeout(r, 120))
function code() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function me(): Profile {
  if (!store.user) throw new Error('Entre para continuar.')
  return store.user
}
function isOwner(vid: string) {
  return store.members.some((m) => m.vehicle_id === vid && m.user_id === me().id && m.role === 'owner')
}
function otherOwner(vid: string, uid: string) {
  return store.members.some((m) => m.vehicle_id === vid && m.user_id !== uid && m.role === 'owner')
}
function isMember(vid: string) {
  return store.members.some((m) => m.vehicle_id === vid && m.user_id === me().id)
}

// Gera ~8 meses de histórico realista para um carro de exemplo
function seed(user: Profile) {
  let s = 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const driver: Profile = { id: 'demo-driver', name: 'Marina (exemplo)', email: 'marina@exemplo.com' }
  store.profiles.push(driver)

  const v: Vehicle = {
    id: id(), owner_id: user.id, name: 'Onix', brand: 'Chevrolet', model: 'Onix LT 1.0 Turbo', year: 2021,
    plate: 'RIO2A21', fuel_type: 'flex', initial_odometer: 38200, invite_code: code(), created_at: now(),
  }
  store.vehicles.push(v)
  store.members.push({ vehicle_id: v.id, user_id: user.id, role: 'owner' }, { vehicle_id: v.id, user_id: driver.id, role: 'driver' })

  const start = addDays(new Date(), -240)
  let odo = v.initial_odometer
  const add = (e: Partial<Entry> & Pick<Entry, 'kind' | 'date' | 'amount'>) => {
    const who = rnd() > 0.7 ? driver.id : user.id
    store.entries.push({
      id: id(), vehicle_id: v.id, user_id: who, paid_by: who, split: true, odometer: null, liters: null,
      price_per_liter: null, fuel_type: null, full_tank: true, category: '', description: '', trip_id: null, created_at: now(), ...e,
    })
  }

  for (let d = 0; d <= 240; d += 8 + Math.floor(rnd() * 5)) {
    const date = toISODate(addDays(start, d))
    const driven = 330 + Math.round(rnd() * 140)
    odo += driven
    const etanol = rnd() > 0.65
    const price = etanol ? 4.09 + rnd() * 0.3 : 5.89 + rnd() * 0.35
    const liters = driven / ((etanol ? 9.2 : 12.6) + (rnd() - 0.5) * 1.2)
    add({
      kind: 'fuel', date, odometer: odo, liters: +liters.toFixed(2), price_per_liter: +price.toFixed(2),
      amount: +(liters * price).toFixed(2), fuel_type: etanol ? 'etanol' : 'gasolina', category: etanol ? 'Etanol' : 'Gasolina',
    })
    if (rnd() > 0.55) add({ kind: 'expense', date, amount: 35 + Math.round(rnd() * 20), category: 'Lavagem' })
    if (rnd() > 0.6) add({ kind: 'expense', date, amount: 12 + Math.round(rnd() * 28), category: rnd() > 0.5 ? 'Estacionamento' : 'Pedágio' })
  }
  add({ kind: 'expense', date: toISODate(addDays(start, 20)), amount: 2184.4, category: 'Seguro', description: 'Renovação anual' })
  add({ kind: 'expense', date: toISODate(addDays(start, 95)), amount: 195.23, category: 'Multa', description: 'Velocidade até 20%' })
  add({ kind: 'service', date: toISODate(addDays(start, 60)), odometer: 41050, amount: 389.9, category: 'Troca de óleo', description: 'Óleo 5W30 + filtro' })
  add({ kind: 'service', date: toISODate(addDays(start, 150)), odometer: 44500, amount: 160, category: 'Alinhamento e balanceamento' })
  add({ kind: 'service', date: toISODate(addDays(start, 200)), odometer: 46100, amount: 1240, category: 'Pneus', description: '2 pneus dianteiros' })

  const r = (title: string, interval_km: number | null, interval_months: number | null, last_km: number | null, last: number) =>
    store.reminders.push({ id: id(), vehicle_id: v.id, title, interval_km, interval_months, last_km, last_date: toISODate(addDays(start, last)), created_at: now() })
  r('Troca de óleo', 10000, 12, 41050, 60)
  r('Rodízio de pneus', 10000, null, 38200, 0)
  r('Revisão anual', null, 12, null, -100)
  r('Licenciamento', null, 12, null, -130)
}

export function createDemoApi(): Api {
  return {
    mode: 'demo',

    async getUser() {
      return store.user
    },

    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },

    async signIn(email) {
      await wait()
      let p = store.profiles.find((x) => x.email === email.toLowerCase())
      if (!p) {
        p = { id: id(), name: email.split('@')[0], email: email.toLowerCase() }
        store.profiles.push(p)
      }
      store.user = p
      if (!store.vehicles.length) seed(p)
      save()
      listeners.forEach((l) => l(p!))
    },

    async signUp(name, email) {
      await wait()
      const p: Profile = { id: id(), name, email: email.toLowerCase() }
      store.profiles.push(p)
      store.user = p
      if (!store.vehicles.length) seed(p)
      save()
      listeners.forEach((l) => l(p))
      return { needsConfirmation: false }
    },

    async resetPassword() {
      await wait()
    },

    async updatePassword() {
      await wait()
    },

    onPasswordRecovery() {
      return () => {}
    },

    async signOut() {
      store.user = null
      save()
      listeners.forEach((l) => l(null))
    },

    async updateProfileName(name) {
      const u = me()
      u.name = name
      const p = store.profiles.find((x) => x.id === u.id)
      if (p) p.name = name
      save()
    },

    async uploadAvatar(image) {
      const url = await new Promise<string>((res) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result))
        r.readAsDataURL(image)
      })
      const u = me()
      u.avatar_url = url
      const p = store.profiles.find((x) => x.id === u.id)
      if (p) p.avatar_url = url
      save()
      return url
    },

    async removeAvatar() {
      const u = me()
      u.avatar_url = null
      const p = store.profiles.find((x) => x.id === u.id)
      if (p) p.avatar_url = null
      save()
    },

    async listVehicles() {
      await wait()
      const uid = me().id
      return store.members
        .filter((m) => m.user_id === uid)
        .map((m) => ({ ...store.vehicles.find((v) => v.id === m.vehicle_id)!, role: m.role }) as VehicleWithRole)
        .filter((v) => v.id)
    },

    async createVehicle(input) {
      const v: Vehicle = { ...input, id: id(), owner_id: me().id, invite_code: code(), created_at: now() }
      store.vehicles.push(v)
      store.members.push({ vehicle_id: v.id, user_id: me().id, role: 'owner' })
      save()
      return v
    },

    async updateVehicle(vid, input) {
      if (!isOwner(vid)) throw new Error('Só os donos do carro podem editar os dados dele.')
      Object.assign(store.vehicles.find((v) => v.id === vid)!, input)
      save()
    },

    async deleteVehicle(vid) {
      store.vehicles = store.vehicles.filter((v) => v.id !== vid)
      store.members = store.members.filter((m) => m.vehicle_id !== vid)
      store.entries = store.entries.filter((e) => e.vehicle_id !== vid)
      store.reminders = store.reminders.filter((r) => r.vehicle_id !== vid)
      save()
    },

    async listMembers(vid) {
      return store.members
        .filter((m) => m.vehicle_id === vid)
        .map((m) => {
          const p = store.profiles.find((x) => x.id === m.user_id)
          return { user_id: m.user_id, role: m.role, name: p?.name ?? '', email: p?.email ?? '', avatar_url: p?.avatar_url ?? null }
        })
        .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.name.localeCompare(b.name)))
    },

    async removeMember(vid, uid) {
      const m = store.members.find((x) => x.vehicle_id === vid && x.user_id === uid)
      if (m?.role === 'owner' && !otherOwner(vid, uid)) throw new Error('O carro precisa de pelo menos um dono. Torne outra pessoa dono antes.')
      store.members = store.members.filter((m) => !(m.vehicle_id === vid && m.user_id === uid))
      save()
    },

    async setMemberRole(vid, uid, role) {
      if (!isOwner(vid)) throw new Error('Só um dono do carro pode mudar quem é dono.')
      const m = store.members.find((x) => x.vehicle_id === vid && x.user_id === uid)
      if (!m) throw new Error('Essa pessoa não está neste carro.')
      if (m.role === 'owner' && role === 'driver' && !otherOwner(vid, uid)) throw new Error('O carro precisa de pelo menos um dono. Torne outra pessoa dono antes.')
      m.role = role
      save()
    },

    async joinByCode(c) {
      await wait()
      const v = store.vehicles.find((x) => x.invite_code === c.trim().toUpperCase())
      if (!v) throw new Error('Código não encontrado. Confira as letras com o dono do carro.')
      if (!isMember(v.id)) store.members.push({ vehicle_id: v.id, user_id: me().id, role: 'driver' })
      save()
      return v.id
    },

    async regenerateCode(vid) {
      const v = store.vehicles.find((x) => x.id === vid)!
      v.invite_code = code()
      save()
      return v.invite_code
    },

    async listInvites(vid) {
      return store.invites.filter((i) => i.vehicle_id === vid)
    },

    async createInvite(vid, email) {
      const e = email.trim().toLowerCase()
      if (store.invites.some((i) => i.vehicle_id === vid && i.email === e)) throw new Error('Este e-mail já foi convidado.')
      const iid = id()
      store.invites.push({ id: iid, vehicle_id: vid, email: e, created_at: now() })
      save()
      return iid
    },

    async sendInviteEmail() {
      throw new Error('No modo demonstração nenhum e-mail é enviado.')
    },

    async deleteInvite(iid) {
      store.invites = store.invites.filter((i) => i.id !== iid)
      save()
    },

    async acceptPendingInvites() {
      return 0
    },

    async listEntries(vid) {
      await wait()
      return store.entries
        .filter((e) => e.vehicle_id === vid)
        .map((e) => ({ ...e, user_name: store.profiles.find((p) => p.id === e.user_id)?.name ?? '' }))
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    },

    async saveEntry(input, eid) {
      const found = eid ? store.entries.find((e) => e.id === eid) : undefined
      if (found) Object.assign(found, input)
      else store.entries.push({ ...input, id: eid ?? id(), user_id: me().id, created_at: now() })
      save()
    },

    async isAdmin() {
      return false
    },
    async adminOverview() {
      throw new Error('Painel indisponível no modo demonstração.')
    },
    async adminUsers() {
      throw new Error('Painel indisponível no modo demonstração.')
    },
    async adminVehicles() {
      throw new Error('Painel indisponível no modo demonstração.')
    },
    async adminSetUserDisabled() {
      throw new Error('Painel indisponível no modo demonstração.')
    },
    async adminDeleteUser() {
      throw new Error('Painel indisponível no modo demonstração.')
    },

    async listSettlements(vid) {
      return store.settlements.filter((x) => x.vehicle_id === vid).sort((a, b) => b.date.localeCompare(a.date))
    },

    async saveSettlement(input) {
      store.settlements.push({ ...input, id: id(), created_at: now() })
      save()
    },

    async deleteSettlement(sid) {
      store.settlements = store.settlements.filter((x) => x.id !== sid)
      save()
    },

    async deleteEntry(eid) {
      store.entries = store.entries.filter((e) => e.id !== eid)
      save()
    },

    async listReminders(vid) {
      return store.reminders.filter((r) => r.vehicle_id === vid)
    },

    async saveReminder(input, rid) {
      if (rid) Object.assign(store.reminders.find((r) => r.id === rid)!, input)
      else store.reminders.push({ ...input, id: id(), created_at: now() })
      save()
    },

    async deleteReminder(rid) {
      store.reminders = store.reminders.filter((r) => r.id !== rid)
      save()
    },

    async listTrips(vid) {
      return store.trips.filter((t) => t.vehicle_id === vid).sort((a, b) => b.start_date.localeCompare(a.start_date))
    },

    async saveTrip(input, tid) {
      if (tid) {
        Object.assign(store.trips.find((t) => t.id === tid)!, input)
        save()
        return tid
      }
      const t: Trip = { ...input, id: id(), created_at: now() }
      store.trips.push(t)
      save()
      return t.id
    },

    async deleteTrip(tid) {
      store.trips = store.trips.filter((t) => t.id !== tid)
      store.entries.forEach((e) => {
        if (e.trip_id === tid) e.trip_id = null
      })
      save()
    },
  }
}
