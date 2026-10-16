export interface AdminOverview {
  users: number
  users_30d: number
  active_7d: number
  vehicles: number
  entries: number
  entries_30d: number
  trips: number
  total_spent: number
}

export interface AdminUser {
  id: string
  name: string
  email: string
  avatar_url: string | null
  created_at: string
  last_sign_in_at: string | null
  disabled: boolean
  is_admin: boolean
  vehicles: number
  entries: number
}

export interface AdminVehicle {
  id: string
  name: string
  plate: string
  brand: string
  model: string
  created_at: string
  owners: string
  people: number
  entries: number
  total_spent: number
  last_entry: string | null
}
