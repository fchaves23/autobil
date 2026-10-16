import { createClient, type User } from '@supabase/supabase-js'
import type { Api, VehicleWithRole } from './api'
import type { Entry, Member, Profile, Reminder, Vehicle } from './types'

// Converte erros do Supabase em mensagens que fazem sentido para quem usa o app.
function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (m.includes('user already registered')) return 'Já existe uma conta com este e-mail. Tente entrar.'
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('rate limit')) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  if (m.includes('failed to fetch')) return 'Sem conexão com o servidor. Verifique sua internet.'
  if (m.includes('duplicate key') && m.includes('vehicle_invites')) return 'Este e-mail já foi convidado.'
  return message
}

function check<R extends { data: unknown; error: { message: string } | null }>(res: R): NonNullable<R['data']> {
  if (res.error) throw new Error(friendly(res.error.message))
  return (res.data ?? []) as NonNullable<R['data']>
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key)

  // O link de "Esqueci a senha" dispara PASSWORD_RECOVERY logo na abertura,
  // às vezes antes de a tela se inscrever; guardamos o aviso para entregar depois.
  let recoveryPending = /type=recovery/.test(window.location.hash)
  const recoveryListeners = new Set<() => void>()
  sb.auth.onAuthStateChange((event) => {
    if (event !== 'PASSWORD_RECOVERY') return
    recoveryPending = true
    setTimeout(() => recoveryListeners.forEach((l) => l()), 0)
  })

  async function toProfile(user: User | null): Promise<Profile | null> {
    if (!user) return null
    const { data } = await sb.from('profiles').select('id,name,email').eq('id', user.id).maybeSingle()
    return {
      id: user.id,
      email: user.email ?? '',
      name: data?.name || (user.user_metadata?.name as string) || (user.email ?? '').split('@')[0],
    }
  }

  async function uid(): Promise<string> {
    const { data } = await sb.auth.getUser()
    if (!data.user) throw new Error('Sua sessão expirou. Entre de novo.')
    return data.user.id
  }

  return {
    mode: 'supabase',

    async getUser() {
      const { data } = await sb.auth.getSession()
      return toProfile(data.session?.user ?? null)
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          // Fora do callback para não travar o cliente do Supabase
          setTimeout(() => toProfile(session?.user ?? null).then(cb), 0)
        }
      })
      return () => data.subscription.unsubscribe()
    },

    async signIn(email, password) {
      check(await sb.auth.signInWithPassword({ email, password }))
    },

    async signUp(name, email, password) {
      const data = check(
        await sb.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: window.location.origin },
        }),
      )
      return { needsConfirmation: !data.session }
    },

    async resetPassword(email) {
      check(await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }))
    },

    async updatePassword(password) {
      check(await sb.auth.updateUser({ password }))
      recoveryPending = false
    },

    onPasswordRecovery(cb) {
      recoveryListeners.add(cb)
      if (recoveryPending) setTimeout(cb, 0)
      return () => recoveryListeners.delete(cb)
    },

    async signOut() {
      await sb.auth.signOut()
    },

    async updateProfileName(name) {
      const id = await uid()
      check(await sb.from('profiles').update({ name }).eq('id', id))
    },

    async listVehicles() {
      const id = await uid()
      const rows = check(
        await sb.from('vehicle_members').select('role, vehicles(*)').eq('user_id', id),
      ) as unknown as { role: VehicleWithRole['role']; vehicles: Vehicle | null }[]
      return rows
        .filter((r) => r.vehicles)
        .map((r) => ({ ...(r.vehicles as Vehicle), initial_odometer: Number(r.vehicles!.initial_odometer), role: r.role }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    },

    async createVehicle(input) {
      return check(await sb.from('vehicles').insert(input).select().single()) as Vehicle
    },

    async updateVehicle(id, input) {
      check(await sb.from('vehicles').update(input).eq('id', id))
    },

    async deleteVehicle(id) {
      check(await sb.from('vehicles').delete().eq('id', id))
    },

    async listMembers(vehicleId) {
      const rows = check(
        await sb.from('vehicle_members').select('user_id, role, profiles(name,email)').eq('vehicle_id', vehicleId),
      ) as unknown as { user_id: string; role: Member['role']; profiles: { name: string; email: string } | null }[]
      return rows
        .map((r) => ({ user_id: r.user_id, role: r.role, name: r.profiles?.name ?? '', email: r.profiles?.email ?? '' }))
        .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'owner' ? -1 : 1))
    },

    async removeMember(vehicleId, userId) {
      check(await sb.from('vehicle_members').delete().eq('vehicle_id', vehicleId).eq('user_id', userId))
    },

    async setMemberRole(vehicleId, userId, role) {
      check(await sb.rpc('set_member_role', { vid: vehicleId, uid: userId, new_role: role }))
    },

    async joinByCode(code) {
      return check(await sb.rpc('join_vehicle_by_code', { code })) as string
    },

    async regenerateCode(vehicleId) {
      return check(await sb.rpc('regenerate_invite_code', { vid: vehicleId })) as string
    },

    async listInvites(vehicleId) {
      return check(
        await sb.from('vehicle_invites').select('id,vehicle_id,email,created_at').eq('vehicle_id', vehicleId).order('created_at'),
      )
    },

    async createInvite(vehicleId, email) {
      const row = check(
        await sb.from('vehicle_invites').insert({ vehicle_id: vehicleId, email: email.trim().toLowerCase() }).select('id').single(),
      ) as { id: string }
      return row.id
    },

    async sendInviteEmail(inviteId) {
      const { data, error } = await sb.functions.invoke('send-invite', { body: { invite_id: inviteId } })
      if (error) {
        // Tenta extrair a mensagem que a função devolveu
        let message = 'Não foi possível enviar o e-mail agora.'
        try {
          const body = await (error as { context?: Response }).context?.json()
          if (body?.error) message = body.error
        } catch {
          /* mantém a mensagem padrão */
        }
        throw new Error(message)
      }
      if (!data?.sent) throw new Error('Não foi possível enviar o e-mail agora.')
    },

    async deleteInvite(id) {
      check(await sb.from('vehicle_invites').delete().eq('id', id))
    },

    async acceptPendingInvites() {
      return (check(await sb.rpc('accept_pending_invites')) as number) ?? 0
    },

    async listEntries(vehicleId) {
      const rows = check(
        await sb
          .from('entries')
          .select('*, profiles(name)')
          .eq('vehicle_id', vehicleId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
      ) as unknown as (Entry & { profiles: { name: string } | null })[]
      return rows.map(({ profiles, ...e }) => ({
        ...e,
        user_name: profiles?.name ?? '',
        amount: Number(e.amount),
        odometer: num(e.odometer),
        liters: num(e.liters),
        price_per_liter: num(e.price_per_liter),
      }))
    },

    async saveEntry(input, id) {
      if (id) check(await sb.from('entries').update(input).eq('id', id))
      else check(await sb.from('entries').insert(input))
    },

    async deleteEntry(id) {
      check(await sb.from('entries').delete().eq('id', id))
    },

    async listReminders(vehicleId) {
      const rows = check(
        await sb.from('reminders').select('*').eq('vehicle_id', vehicleId).order('created_at'),
      ) as Reminder[]
      return rows.map((r) => ({ ...r, last_km: num(r.last_km) }))
    },

    async saveReminder(input, id) {
      if (id) check(await sb.from('reminders').update(input).eq('id', id))
      else check(await sb.from('reminders').insert(input))
    },

    async deleteReminder(id) {
      check(await sb.from('reminders').delete().eq('id', id))
    },
  }
}
