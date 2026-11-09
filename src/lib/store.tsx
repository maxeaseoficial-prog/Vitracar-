import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Company, Dataset, Profile, TableName, Payment, LoyaltyRedemption, LoyaltyLedger,
  ServiceOrder, ServiceOrderItem, Quote, QuoteItem, Appointment, AppointmentItem } from '../types'
import { isConfigured, supabase } from './supabase'
import { demoCompany, makeDemoData } from './demo'
import { uuid } from './utils'

const names: TableName[] = ['clients','vehicles','services','quotes','quote_items',
  'appointments','appointment_items','service_orders','service_order_items','payments',
  'expenses','loyalty_ledger','loyalty_rewards','loyalty_redemptions']

const PAGE = 1000

const emptyData = (): Dataset => ({
  clients:[],vehicles:[],services:[],quotes:[],quote_items:[],
  appointments:[],appointment_items:[],service_orders:[],service_order_items:[],
  payments:[],expenses:[],loyalty_ledger:[],loyalty_rewards:[],loyalty_redemptions:[]
})

type Changes = Record<string, unknown>
export type NewQuote = Pick<Quote,'client_id'|'vehicle_id'|'discount_cents'|'notes'>
export type NewQuoteItem = Pick<QuoteItem,'service_id'|'description'|'quantity'|'unit_cents'>
export type NewAppointment = Pick<Appointment,'client_id'|'vehicle_id'|'starts_at'|'address'|'notes'|'quote_id'>
export type NewAppointmentItem = Pick<AppointmentItem,'service_id'|'description'|'price_cents'|'coins'>

interface Store {
  data: Dataset
  company: Company
  profile: Profile
  isDemo: boolean
  loading: boolean
  error: string | null
  refresh(): Promise<void>
  save(table:TableName,changes:Changes,id?:string):Promise<Record<string,any>>
  createQuote(quote:NewQuote,items:NewQuoteItem[]):Promise<string>
  createAppointment(appointment:NewAppointment,items:NewAppointmentItem[]):Promise<string>
  updateCompany(changes:Partial<Company>):Promise<void>
  completeAppointment(id:string):Promise<string>
  recordPayment(orderId:string,amount:number,method:Payment['method']):Promise<void>
  redeem(clientId:string,rewardId:string):Promise<void>
  uploadClientPhoto(clientId:string,file:File):Promise<string>
  uploadLogo(file:File):Promise<string>
}
const Context=createContext<Store|null>(null)

export function DataProvider({companyId,profile,demo,children}:{
  companyId:string;profile:Profile;demo:boolean;children:ReactNode
}) {
  const [data,setData]=useState<Dataset>(()=>demo?makeDemoData():emptyData())
  const [company,setCompany]=useState<Company>(demoCompany)
  // `loading` só é verdadeiro na primeira carga. Recargas depois de uma
  // gravação acontecem em segundo plano, sem desmontar telas e modais.
  const [loading,setLoading]=useState(!demo)
  const [error,setError]=useState<string|null>(null)
  // Cópia síncrona do estado: as validações do modo demonstração leem daqui
  // e lançam erros ANTES de chamar setData (erros dentro do updater do React
  // derrubariam a aplicação inteira).
  const dataRef=useRef(data)
  const commit=useCallback((next:Dataset)=>{dataRef.current=next;setData(next)},[])

  const fetchTable=useCallback(async(name:TableName)=>{
    if(!supabase)throw new Error('Banco indisponível')
    const rows:unknown[]=[]
    for(let from=0;;from+=PAGE){
      const result=await supabase.from(name).select('*').eq('company_id',companyId).range(from,from+PAGE-1)
      if(result.error)throw result.error
      rows.push(...(result.data||[]))
      if(!result.data||result.data.length<PAGE)break
    }
    return rows
  },[companyId])

  const reload=useCallback(async(tables:TableName[])=>{
    if(demo||!isConfigured||!supabase)return
    const results=await Promise.all(tables.map(fetchTable))
    setData(prev=>{
      const next={...prev}
      tables.forEach((name,i)=>{(next[name] as unknown[])=results[i]})
      dataRef.current=next
      return next
    })
  },[demo,fetchTable])

  const refresh=useCallback(async()=>{
    if(demo||!isConfigured||!supabase)return
    setError(null)
    try {
      const business=await supabase.from('company_settings').select('*').eq('id',companyId).single()
      if(business.error)throw business.error
      setCompany(business.data as Company)
      await reload(names)
    } catch(e) {setError(e instanceof Error?e.message:String(e))}
    finally{setLoading(false)}
  },[companyId,demo,reload])

  useEffect(()=>{void refresh()},[refresh])

  const save=useCallback(async(table:TableName,changes:Changes,id?:string):Promise<Record<string,any>>=>{
    const payload={...changes,company_id:companyId}
    if(demo) {
      const prev=dataRef.current
      const old=prev[table] as unknown as Record<string,unknown>[]
      const existing=id?old.find(r=>r.id===id):undefined
      if(id&&!existing)throw new Error('Registro não encontrado')
      const row=existing?{...existing,...payload}:{id:uuid(),created_at:new Date().toISOString(),...payload}
      const rows=existing?old.map(r=>r.id===id?row:r):[row,...old]
      commit({...prev,[table]:rows})
      return row
    }
    if(!supabase) throw new Error('Banco de dados não configurado')
    const query=id?supabase.from(table).update(changes).eq('id',id).eq('company_id',companyId)
      :supabase.from(table).insert(payload)
    const response=await query.select('*').single()
    if(response.error) throw response.error
    await reload([table])
    return response.data as Record<string,any>
  },[commit,companyId,demo,reload])

  const createQuote=useCallback(async(quote:NewQuote,items:NewQuoteItem[])=>{
    if(!items.length)throw new Error('Selecione pelo menos um serviço.')
    if(demo){
      const prev=dataRef.current
      const id=uuid(),now=new Date().toISOString()
      const number=prev.quotes.reduce((max,q)=>Math.max(max,q.quote_number||0),0)+1
      const header:Quote={id,company_id:companyId,quote_number:number,status:'draft',created_at:now,...quote}
      const rows:QuoteItem[]=items.map(item=>({id:uuid(),company_id:companyId,quote_id:id,...item}))
      commit({...prev,quotes:[header,...prev.quotes],quote_items:[...rows,...prev.quote_items]})
      return id
    }
    if(!supabase)throw new Error('Banco indisponível')
    const result=await supabase.rpc('create_quote',{p_quote:quote,p_items:items})
    if(result.error)throw result.error
    await reload(['quotes','quote_items'])
    return result.data as string
  },[commit,companyId,demo,reload])

  const createAppointment=useCallback(async(appointment:NewAppointment,items:NewAppointmentItem[])=>{
    if(!items.length)throw new Error('Selecione pelo menos um serviço.')
    if(demo){
      const prev=dataRef.current
      const id=uuid(),now=new Date().toISOString()
      const header:Appointment={id,company_id:companyId,status:'scheduled',created_at:now,...appointment}
      const rows:AppointmentItem[]=items.map(item=>({id:uuid(),company_id:companyId,appointment_id:id,...item}))
      commit({...prev,appointments:[header,...prev.appointments],appointment_items:[...rows,...prev.appointment_items]})
      return id
    }
    if(!supabase)throw new Error('Banco indisponível')
    const result=await supabase.rpc('create_appointment',{p_appointment:appointment,p_items:items})
    if(result.error)throw result.error
    await reload(['appointments','appointment_items'])
    return result.data as string
  },[commit,companyId,demo,reload])

  const updateCompany=useCallback(async(changes:Partial<Company>)=>{
    if(demo){setCompany(c=>({...c,...changes}));return}
    if(!supabase)throw new Error('Banco indisponível')
    const response=await supabase.from('company_settings').update(changes).eq('id',companyId).select('*').single()
    if(response.error)throw response.error
    setCompany(response.data as Company)
  },[companyId,demo])

  const completeAppointment=useCallback(async(id:string)=>{
    if(demo){
      const prev=dataRef.current
      const ap=prev.appointments.find(a=>a.id===id)
      if(!ap) throw new Error('Agendamento não encontrado')
      if(ap.status==='cancelled')throw new Error('Agendamento cancelado')
      const existing=prev.service_orders.find(o=>o.appointment_id===id)
      if(existing)return existing.id
      const items=prev.appointment_items.filter(a=>a.appointment_id===id)
      if(!items.length)throw new Error('Adicione um serviço antes de concluir')
      const orderId=uuid()
      const now=new Date().toISOString()
      const order:ServiceOrder={id:orderId,company_id:companyId,client_id:ap.client_id,
        vehicle_id:ap.vehicle_id,appointment_id:id,status:'completed',total_cents:items.reduce((sum,i)=>sum+i.price_cents,0),
        completed_at:now,created_at:now}
      const orderItems:ServiceOrderItem[]=items.map(item=>({
        id:uuid(),company_id:companyId,order_id:orderId,description:item.description,
        service_id:item.service_id,price_cents:item.price_cents,coins:item.coins
      }))
      commit({...prev,appointments:prev.appointments.map(a=>a.id===id?{...a,status:'completed' as const}:a),
        service_orders:[order,...prev.service_orders],service_order_items:[...orderItems,...prev.service_order_items]})
      return orderId
    }
    if(!supabase)throw new Error('Banco indisponível')
    const result=await supabase.rpc('complete_appointment',{p_appointment_id:id})
    if(result.error)throw result.error
    await reload(['appointments','service_orders','service_order_items'])
    return result.data as string
  },[commit,companyId,demo,reload])

  const recordPayment=useCallback(async(orderId:string,amount:number,method:Payment['method'])=>{
    if(!Number.isInteger(amount)||amount<=0)throw new Error('Valor inválido')
    if(demo){
      const prev=dataRef.current
      const order=prev.service_orders.find(o=>o.id===orderId)
      if(!order||order.status!=='completed')throw new Error('Ordem não concluída')
      const paid=prev.payments.filter(p=>p.order_id===orderId).reduce((s,p)=>s+p.amount_cents,0)
      if(paid+amount>order.total_cents)throw new Error('Valor maior que o saldo pendente')
      const now=new Date().toISOString()
      const payment:Payment={id:uuid(),company_id:companyId,order_id:orderId,amount_cents:amount,method,paid_at:now,created_at:now}
      const earnedAlready=prev.loyalty_ledger.some(l=>l.kind==='earn'&&l.source_id===orderId)
      const coins=prev.service_order_items.filter(i=>i.order_id===orderId).reduce((s,i)=>s+i.coins,0)
      const ledger:LoyaltyLedger[]=paid+amount===order.total_cents&&!earnedAlready&&coins>0
        ? [{id:uuid(),company_id:companyId,client_id:order.client_id,change:coins,kind:'earn',source_id:orderId,description:'Moedas por serviço quitado',created_at:now}]
        : []
      commit({...prev,payments:[payment,...prev.payments],loyalty_ledger:[...ledger,...prev.loyalty_ledger]})
      return
    }
    if(!supabase)throw new Error('Banco indisponível')
    const response=await supabase.from('payments').insert({company_id:companyId,order_id:orderId,amount_cents:amount,
      method,paid_at:new Date().toISOString()})
    if(response.error)throw response.error
    await reload(['payments','loyalty_ledger'])
  },[commit,companyId,demo,reload])

  const redeem=useCallback(async(clientId:string,rewardId:string)=>{
    if(demo){
      const prev=dataRef.current
      const client=prev.clients.find(c=>c.id===clientId)
      const reward=prev.loyalty_rewards.find(r=>r.id===rewardId&&r.active)
      if(!client||!reward)throw new Error('Cliente ou recompensa inválida')
      const balance=prev.loyalty_ledger.filter(l=>l.client_id===clientId).reduce((s,l)=>s+l.change,0)
      if(balance<reward.cost)throw new Error('Saldo insuficiente')
      const rid=uuid(),now=new Date().toISOString()
      const redemption:LoyaltyRedemption={id:rid,company_id:companyId,client_id:clientId,reward_id:rewardId,cost:reward.cost,created_at:now}
      const ledger:LoyaltyLedger={id:uuid(),company_id:companyId,client_id:clientId,change:-reward.cost,kind:'redeem',
        source_id:rid,description:'Resgate: '+reward.name,created_at:now}
      commit({...prev,loyalty_redemptions:[redemption,...prev.loyalty_redemptions],loyalty_ledger:[ledger,...prev.loyalty_ledger]})
      return
    }
    if(!supabase)throw new Error('Banco indisponível')
    const response=await supabase.rpc('redeem_loyalty',{p_client_id:clientId,p_reward_id:rewardId})
    if(response.error)throw response.error
    await reload(['loyalty_redemptions','loyalty_ledger'])
  },[commit,companyId,demo,reload])

  const uploadClientPhoto=useCallback(async(clientId:string,file:File)=>{
    if(demo)throw new Error('Upload de fotos só está disponível com banco conectado')
    if(!supabase)throw new Error('Banco indisponível')
    if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Imagem inválida: JPG, PNG ou WEBP até 5 MB')
    const path=`${companyId}/${clientId}/${uuid()}.${file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}`
    const result=await supabase.storage.from('client-photos').upload(path,file,{contentType:file.type})
    if(result.error)throw result.error
    return path
  },[companyId,demo])

  const uploadLogo=useCallback(async(file:File)=>{
    if(demo)throw new Error('Logo só pode ser alterada com banco conectado')
    if(!supabase)throw new Error('Banco indisponível')
    if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Formato inválido ou imagem maior que 5 MB')
    const path=`${companyId}/${uuid()}.${file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}`
    const result=await supabase.storage.from('company-logos').upload(path,file,{contentType:file.type})
    if(result.error)throw result.error
    const {data}=supabase.storage.from('company-logos').getPublicUrl(path)
    await updateCompany({logo_url:data.publicUrl})
    return data.publicUrl
  },[companyId,demo,updateCompany])

  return <Context.Provider value={{data,company,profile,isDemo:demo,loading,error,refresh,
    save,createQuote,createAppointment,updateCompany,completeAppointment,recordPayment,redeem,uploadClientPhoto,uploadLogo}}>
    {children}
  </Context.Provider>
}
export function useStore(){
  const ctx=useContext(Context)
  if(!ctx)throw new Error('DataProvider ausente')
  return ctx
}
