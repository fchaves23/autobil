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
  trip_id: string | null
  created_at: string
}

export interface Trip {
  id: string
  vehicle_id: string
  name: string
  start_date: string
  end_date: string | null
  notes: string
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
export type TripInput = Omit<Trip, 'id' | 'created_at'>
export type VehicleInput = Pick<Vehicle, 'name' | 'brand' | 'model' | 'year' | 'plate' | 'fuel_type' | 'initial_odometer'>

// Tipo de motor do carro (cadastro do veículo)
export const FUEL_TYPES: Record<string, string> = {
  gasolina: 'Gasolina',
  etanol: 'Etanol',
  flex: 'Flex',
  diesel: 'Diesel',
  gnv: 'GNV',
  eletrico: 'Elétrico',
}

// O que foi colocado no tanque em cada abastecimento
export const FUEL_KINDS: Record<string, string> = {
  etanol: 'Etanol',
  gasolina: 'Gasolina comum',
  gasolina_aditivada: 'Gasolina aditivada',
  gnv: 'GNV',
  diesel_s10: 'Diesel S10',
  diesel_s500: 'Diesel S500',
  diesel: 'Diesel',
  arla: 'Arla 32',
  eletrico: 'Recarga elétrica',
}

// Opções sugeridas por tipo de motor (as primeiras aparecem primeiro)
export const FUEL_KINDS_BY_ENGINE: Record<string, string[]> = {
  flex: ['gasolina', 'etanol', 'gasolina_aditivada', 'gnv'],
  gasolina: ['gasolina', 'gasolina_aditivada', 'gnv', 'etanol'],
  etanol: ['etanol', 'gnv'],
  diesel: ['diesel_s10', 'diesel_s500', 'arla'],
  gnv: ['gnv', 'gasolina', 'etanol', 'gasolina_aditivada'],
  eletrico: ['eletrico'],
}

// Arla 32 entra no custo, mas não é combustível: fica fora do km/l e dos litros
export const NOT_FUEL = new Set(['arla'])

export const fuelLabel = (k: string | null | undefined) => (k ? FUEL_KINDS[k] ?? FUEL_TYPES[k] ?? k : 'Combustível')

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
