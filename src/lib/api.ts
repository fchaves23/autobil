import type { Entry, EntryInput, Invite, Member, Profile, Reminder, ReminderInput, Role, Settlement, SettlementInput, Trip, TripInput, Vehicle, VehicleInput } from './types'
import type { AdminOverview, AdminUser, AdminVehicle } from './admin-types'
import { createSupabaseApi } from './api-supabase'
import { createDemoApi } from './api-demo'

export interface VehicleWithRole extends Vehicle {
  role: Role
}

export interface Api {
  mode: 'supabase' | 'demo'
  // Conta
  getUser(): Promise<Profile | null>
  onAuthChange(cb: (user: Profile | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }>
  resetPassword(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  onPasswordRecovery(cb: () => void): () => void
  signOut(): Promise<void>
  updateProfileName(name: string): Promise<void>
  uploadAvatar(image: Blob): Promise<string>
  removeAvatar(): Promise<void>
  // Veículos e motoristas
  listVehicles(): Promise<VehicleWithRole[]>
  createVehicle(input: VehicleInput): Promise<Vehicle>
  updateVehicle(id: string, input: Partial<VehicleInput>): Promise<void>
  deleteVehicle(id: string): Promise<void>
  listMembers(vehicleId: string): Promise<Member[]>
  removeMember(vehicleId: string, userId: string): Promise<void>
  setMemberRole(vehicleId: string, userId: string, role: Role): Promise<void>
  joinByCode(code: string): Promise<string>
  regenerateCode(vehicleId: string): Promise<string>
  listInvites(vehicleId: string): Promise<Invite[]>
  createInvite(vehicleId: string, email: string): Promise<string>
  sendInviteEmail(inviteId: string): Promise<void>
  deleteInvite(id: string): Promise<void>
  acceptPendingInvites(): Promise<number>
  // Lançamentos e lembretes
  listEntries(vehicleId: string): Promise<Entry[]>
  // Com id: cria com esse id ou atualiza (permite lançar sem internet e enviar depois)
  saveEntry(input: EntryInput, id?: string): Promise<void>
  deleteEntry(id: string): Promise<void>
  listReminders(vehicleId: string): Promise<Reminder[]>
  saveReminder(input: ReminderInput, id?: string): Promise<void>
  deleteReminder(id: string): Promise<void>
  // Viagens
  listTrips(vehicleId: string): Promise<Trip[]>
  saveTrip(input: TripInput, id?: string): Promise<string>
  deleteTrip(id: string): Promise<void>
  // Acerto de contas
  listSettlements(vehicleId: string): Promise<Settlement[]>
  saveSettlement(input: SettlementInput): Promise<void>
  deleteSettlement(id: string): Promise<void>
  // Painel do administrador (só funciona para e-mails em app_admins)
  isAdmin(): Promise<boolean>
  adminOverview(): Promise<AdminOverview>
  adminUsers(): Promise<AdminUser[]>
  adminVehicles(): Promise<AdminVehicle[]>
  adminSetUserDisabled(userId: string, disabled: boolean): Promise<void>
  adminDeleteUser(userId: string): Promise<void>
}

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const api: Api = url && key ? createSupabaseApi(url, key) : createDemoApi()
