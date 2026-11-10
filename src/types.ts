export type Id = string
export type StatusQuote = 'draft' | 'sent' | 'approved' | 'declined' | 'cancelled'
export type StatusAppointment = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type StatusOrder = 'in_progress' | 'completed' | 'cancelled'
export type PaymentMethod = 'pix' | 'cash' | 'credit_card' | 'debit_card' | 'other'
export type AvatarKind = 'male' | 'male-2' | 'female' | 'female-2'

export interface Company {
  id: Id
  name: string
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  logo_url: string | null
  timezone: string
  created_at?: string
}
export interface Profile {
  id: Id
  company_id: Id
  name: string | null
  role: 'admin' | 'staff'
}
export interface Client {
  id: Id
  company_id: Id
  name: string
  whatsapp: string | null
  birth_date: string | null
  photo_path: string | null
  avatar_kind: AvatarKind
  notes: string | null
  /** Preenchido quando o cliente é excluído da lista. O histórico financeiro é mantido. */
  archived_at?: string | null
  created_at: string
}
export interface Vehicle {
  id: Id
  company_id: Id
  client_id: Id
  plate: string
  brand: string
  model: string
  year: number | null
  color: string
  category: string | null
  upholstery: string | null
  model_3d_id: string | null
  notes: string | null
  created_at: string
}
export interface Service {
  id: Id
  company_id: Id
  name: string
  description: string | null
  price_cents: number
  duration_minutes: number | null
  coins: number
  active: boolean
  created_at: string
}
export interface Quote {
  id: Id
  company_id: Id
  quote_number: number
  client_id: Id
  vehicle_id: Id
  status: StatusQuote
  discount_cents: number
  notes: string | null
  created_at: string
}
export interface QuoteItem {
  product_id?: Id | null
  item_kind?: 'service' | 'product'
  id: Id
  company_id: Id
  quote_id: Id
  service_id: Id | null
  description: string
  quantity: number
  unit_cents: number
}
export interface Appointment {
  id: Id
  company_id: Id
  client_id: Id
  vehicle_id: Id
  quote_id: Id | null
  starts_at: string
  address: string | null
  notes: string | null
  status: StatusAppointment
  created_at: string
}
export interface AppointmentItem {
  id: Id
  company_id: Id
  appointment_id: Id
  service_id: Id | null
  description: string
  price_cents: number
  coins: number
}
export interface ServiceOrder {
  id: Id
  company_id: Id
  client_id: Id
  vehicle_id: Id
  appointment_id: Id | null
  status: StatusOrder
  total_cents: number
  completed_at: string | null
  created_at: string
}
export interface ServiceOrderItem {
  id: Id
  company_id: Id
  order_id: Id
  service_id: Id | null
  description: string
  price_cents: number
  coins: number
}
export interface Payment {
  id: Id
  company_id: Id
  order_id: Id
  amount_cents: number
  method: PaymentMethod
  paid_at: string
  created_at: string
}
export interface Expense {
  id: Id
  company_id: Id
  description: string
  category: string
  amount_cents: number
  occurred_on: string
  method: PaymentMethod | null
  supplier: string | null
  notes: string | null
  created_at: string
}
export interface LoyaltyLedger {
  id: Id
  company_id: Id
  client_id: Id
  change: number
  kind: 'earn' | 'redeem' | 'reversal'
  source_id: Id
  description: string
  created_at: string
}
export interface LoyaltyReward {
  id: Id
  company_id: Id
  name: string
  description: string | null
  cost: number
  active: boolean
  created_at: string
}
export interface LoyaltyRedemption {
  id: Id
  company_id: Id
  client_id: Id
  reward_id: Id
  cost: number
  created_at: string
}
export interface Dataset {
  clients: Client[]
  vehicles: Vehicle[]
  services: Service[]
  quotes: Quote[]
  quote_items: QuoteItem[]
  appointments: Appointment[]
  appointment_items: AppointmentItem[]
  service_orders: ServiceOrder[]
  service_order_items: ServiceOrderItem[]
  payments: Payment[]
  expenses: Expense[]
  loyalty_ledger: LoyaltyLedger[]
  loyalty_rewards: LoyaltyReward[]
  loyalty_redemptions: LoyaltyRedemption[]
}
export type TableName = keyof Dataset
