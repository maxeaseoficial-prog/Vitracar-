import type { Company, Dataset, Profile } from '../types'

// A prévia começa vazia: nenhum cliente, veículo, serviço, orçamento ou
// lançamento financeiro é criado automaticamente.
export const demoCompany: Company = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'VitraCar',
  phone: null,
  email: null,
  address: null,
  tax_id: null,
  logo_url: null,
  timezone: 'America/Sao_Paulo'
}

export const demoProfile: Profile = {
  id: '00000000-0000-4000-8000-000000000002',
  company_id: demoCompany.id,
  name: null,
  role: 'admin'
}

export function makeDemoData(): Dataset {
  return {
    clients: [],
    vehicles: [],
    services: [],
    quotes: [],
    quote_items: [],
    appointments: [],
    appointment_items: [],
    service_orders: [],
    service_order_items: [],
    payments: [],
    expenses: [],
    loyalty_ledger: [],
    loyalty_rewards: [],
    loyalty_redemptions: []
  }
}
