export type EntryKind = 'fuel' | 'expense' | 'service'
export type Role = 'owner' | 'driver'

export interface Profile {
  id: string
  name: string
  email: string
}

export interface Vehicle {
  id: string
  owner_id: string
  name: string
  brand: string
  model: string
  year: number | null
  plate: string
  fuel_type: string
  initial_odometer: number
  invite_code: string
  created_at: string
}

export interface Member {
  user_id: string
  role: Role
  name: string
  email: string
}

export interface Invite {
  id: string
  vehicle_id: string
  email: string
  created_at: string
}

export interface Entry {
  id: string
  vehicle_id: string
  user_id: string | null
  user_name?: string
  kind: EntryKind
  date: string // AAAA-MM-DD
  odometer: number | null
  amount: number
  liters: number | null
  price_per_liter: number | null
  fuel_type: string | null
  full_tank: boolean
  category: string
  description: string
  created_at: string
}

export interface Reminder {
  id: string
  vehicle_id: string
  title: string
  interval_km: number | null
  interval_months: number | null
  last_km: number | null
  last_date: string | null
  created_at: string
}

export type EntryInput = Omit<Entry, 'id' | 'created_at' | 'user_id' | 'user_name'>
export type ReminderInput = Omit<Reminder, 'id' | 'created_at'>
export type VehicleInput = Pick<Vehicle, 'name' | 'brand' | 'model' | 'year' | 'plate' | 'fuel_type' | 'initial_odometer'>

export const FUEL_TYPES: Record<string, string> = {
  gasolina: 'Gasolina',
  etanol: 'Etanol',
  flex: 'Flex',
  diesel: 'Diesel',
  gnv: 'GNV',
  eletrico: 'Elétrico',
}

export const EXPENSE_CATEGORIES = [
  'IPVA',
  'Seguro',
  'Licenciamento',
  'Estacionamento',
  'Pedágio',
  'Lavagem',
  'Multa',
  'Financiamento',
  'Outros',
]

export const SERVICE_CATEGORIES = [
  'Troca de óleo',
  'Revisão',
  'Pneus',
  'Alinhamento e balanceamento',
  'Freios',
  'Bateria',
  'Filtros',
  'Mecânica geral',
  'Elétrica',
  'Funilaria e pintura',
  'Outros',
]

export const KIND_LABEL: Record<EntryKind, string> = {
  fuel: 'Abastecimento',
  expense: 'Despesa',
  service: 'Serviço',
}
