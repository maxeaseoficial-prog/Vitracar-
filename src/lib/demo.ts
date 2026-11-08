import type { Company, Dataset, Profile } from '../types'
import { uuid } from './utils'

export const demoCompany: Company = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'VitraCar Studio',
  phone: '(65) 99999-0000',
  email: 'contato@exemplo.com',
  address: 'Cuiabá, MT',
  tax_id: null,
  logo_url: null,
  timezone: 'America/Cuiaba'
}
export const demoProfile: Profile = {
  id: '00000000-0000-4000-8000-000000000002',
  company_id: demoCompany.id,
  name: 'Administrador',
  role: 'admin'
}

const days = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString()
const shared = (id: string) => ({ id, company_id: demoCompany.id, created_at: days(-60) })

export function makeDemoData(): Dataset {
  const people = [
    ['Marcos Oliveira','male'],
    ['Camila Ferreira','female'],
    ['Ricardo Almeida','male'],
    ['Juliana Costa','female'],
    ['André Martins','male'],
    ['Beatriz Souza','female'],
  ] as const
  const clients = people.map(([name,kind]) => ({
    ...shared(uuid()), name, avatar_kind:kind,
    whatsapp:'(65) 99999-0000', birth_date:null, photo_path:null, notes:null
  }))
  const catalog = [
    [0,'Chevrolet','Onix','RAA1A23','Prata','hatchback','Tecido','chevrolet-onix'],
    [1,'Honda','Civic','QWE2B34','Preto','sedan','Couro','honda-civic'],
    [2,'Fiat','Strada','ABC1D55','Branco','pickup','Tecido','fiat-strada'],
    [3,'Volkswagen','Gol','KLM3E66','Azul','hatchback','Tecido','volkswagen-gol'],
    [4,'Chevrolet','S10','PQR4F77','Cinza','pickup','Couro','chevrolet-s10'],
    [5,'Fiat','Uno','FGH5G88','Vermelho','hatchback','Tecido','fiat-uno'],
  ] as const
  const vehicles = catalog.map(([index,brand,model,plate,color,category,upholstery,model_3d_id]) => ({
    ...shared(uuid()), client_id:clients[index].id, brand, model, plate, color, category,
    upholstery, model_3d_id, year:2022, notes:null
  }))
  const catalogServices = [
    ['Lavagem completa',12000,100,75],
    ['Higienização interna',28000,180,180],
    ['Polimento técnico',45000,250,240],
    ['Vitrificação de pintura',89000,500,360],
    ['Lavagem simples',6000,50,40],
    ['Higienização de bancos',20000,140,120],
    ['Limpeza de motor',16000,120,80]
  ] as const
  const services = catalogServices.map(([name,price_cents,coins,duration_minutes])=>({
    ...shared(uuid()),name,price_cents,coins,duration_minutes,description:null,active:true
  }))
  const appointments = [
    { ...shared(uuid()), client_id:clients[0].id,vehicle_id:vehicles[0].id,quote_id:null,starts_at:days(1),
      address:'Na unidade',notes:null,status:'scheduled' as const },
    { ...shared(uuid()), client_id:clients[1].id,vehicle_id:vehicles[1].id,quote_id:null,starts_at:days(2),
      address:'Av. do CPA, Cuiabá',notes:null,status:'scheduled' as const },
    { ...shared(uuid()), client_id:clients[2].id,vehicle_id:vehicles[2].id,quote_id:null,starts_at:days(3),
      address:'Na unidade',notes:null,status:'in_progress' as const }
  ]
  const appointment_items = appointments.map((a,i)=>({
    id:uuid(),company_id:demoCompany.id,appointment_id:a.id,service_id:services[i].id,
    description:services[i].name,price_cents:services[i].price_cents,coins:services[i].coins
  }))
  const service_orders = [0,1,2,3].map((_,i)=>({
    ...shared(uuid()), client_id:clients[i].id,vehicle_id:vehicles[i].id,appointment_id:null,
    status:'completed' as const,total_cents:services[i].price_cents,completed_at:days(-(i+2)*4)
  }))
  const service_order_items = service_orders.map((o,i)=>({
    id:uuid(),company_id:demoCompany.id,order_id:o.id,service_id:services[i].id,
    description:services[i].name,price_cents:services[i].price_cents,coins:services[i].coins
  }))
  const payments = service_orders.map((o,i)=>({
    ...shared(uuid()),order_id:o.id,amount_cents:o.total_cents,paid_at:days(-(i+2)*4),
    method:(i%2?'credit_card':'pix') as 'credit_card'|'pix'
  }))
  const expenses = [
    { ...shared(uuid()), description:'Shampoo automotivo concentrado',category:'Produtos',amount_cents:13500,occurred_on:days(-4).slice(0,10),method:'pix' as const,supplier:'Fornecedor exemplo',notes:null },
    { ...shared(uuid()), description:'Panos de microfibra',category:'Materiais',amount_cents:7800,occurred_on:days(-8).slice(0,10),method:'pix' as const,supplier:null,notes:null },
    { ...shared(uuid()), description:'Manutenção de equipamentos',category:'Operacional',amount_cents:19000,occurred_on:days(-15).slice(0,10),method:'cash' as const,supplier:null,notes:null }
  ]
  const loyalty_ledger = service_orders.map((o,i)=>({
    ...shared(uuid()),client_id:clients[i].id,change:services[i].coins,kind:'earn' as const,
    source_id:o.id,description:'Moedas por serviço quitado'
  }))
  const loyalty_rewards=[
    { ...shared(uuid()),name:'Lavagem simples gratuita',description:'Resgate disponível na unidade.',cost:500,active:true },
    { ...shared(uuid()),name:'Lavagem completa gratuita',description:'Resgate disponível na unidade.',cost:1000,active:true },
    { ...shared(uuid()),name:'Higienização de bancos',description:'Resgate disponível na unidade.',cost:1500,active:true }
  ]
  const quotes=[
    { ...shared(uuid()),quote_number:1001,client_id:clients[4].id,vehicle_id:vehicles[4].id,status:'sent' as const,discount_cents:0,notes:null },
    { ...shared(uuid()),quote_number:1002,client_id:clients[5].id,vehicle_id:vehicles[5].id,status:'approved' as const,discount_cents:2500,notes:'Atendimento na unidade.' }
  ]
  const quote_items=quotes.map((q,i)=>({
    id:uuid(),company_id:demoCompany.id,quote_id:q.id,service_id:services[i+2].id,
    description:services[i+2].name,quantity:1,unit_cents:services[i+2].price_cents
  }))
  return {clients,vehicles,services,quotes,quote_items,appointments,appointment_items,
    service_orders,service_order_items,payments,expenses,loyalty_ledger,
    loyalty_rewards,loyalty_redemptions:[]}
}
