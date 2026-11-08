import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Company, Dataset, Profile, TableName, Appointment, ServiceOrder, Payment, LoyaltyRedemption, LoyaltyLedger, ServiceOrderItem } from '../types'
import { isConfigured, supabase } from './supabase'
import { demoCompany, makeDemoData } from './demo'
import { uuid } from './utils'

const names: TableName[] = ['clients','vehicles','services','quotes','quote_items',
  'appointments','appointment_items','service_orders','service_order_items','payments',
  'expenses','loyalty_ledger','loyalty_rewards','loyalty_redemptions']

const emptyData = (): Dataset => ({
  clients:[],vehicles:[],services:[],quotes:[],quote_items:[],
  appointments:[],appointment_items:[],service_orders:[],service_order_items:[],
  payments:[],expenses:[],loyalty_ledger:[],loyalty_rewards:[],loyalty_redemptions:[]
})

type Changes = Record<string, unknown>
interface Store {
  data: Dataset
  company: Company
  profile: Profile
  isDemo: boolean
  loading: boolean
  error: string | null
  refresh(): Promise<void>
  save(table:TableName,changes:Changes,id?:string):Promise<Record<string,any>>
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
  const [loading,setLoading]=useState(!demo)
  const [error,setError]=useState<string|null>(null)

  const refresh=useCallback(async()=>{
    if(demo) return
    if(!isConfigured||!supabase) return
    const db = supabase
    setLoading(true);setError(null)
    try {
      const [business,...tables]=await Promise.all([
        db.from('company_settings').select('*').eq('id',companyId).single(),
        ...names.map(name=>db.from(name).select('*').eq('company_id',companyId).limit(5000))
      ])
      if(business.error) throw business.error
      setCompany(business.data as Company)
      const next=emptyData()
      for(let i=0;i<names.length;i++){
        if(tables[i].error) throw tables[i].error
        ;(next[names[i]] as unknown[])=tables[i].data||[]
      }
      setData(next)
    } catch(e) {setError(e instanceof Error?e.message:String(e))}
    finally{setLoading(false)}
  },[companyId,demo])

  useEffect(()=>{void refresh()},[refresh])

  const save=useCallback(async(table:TableName,changes:Changes,id?:string):Promise<Record<string,any>>=>{
    const payload={...changes,company_id:companyId}
    if(demo) {
      const row={id:id||uuid(),created_at:new Date().toISOString(),...payload}
      setData(prev=>{
        const old=prev[table] as unknown as Record<string,unknown>[]
        const rows=id?old.map(r=>r.id===id?{...r,...row}:r):[row,...old]
        return {...prev,[table]:rows}
      })
      return row
    }
    if(!supabase) throw new Error('Banco de dados não configurado')
    const query=id?supabase.from(table).update(changes).eq('id',id).eq('company_id',companyId)
      :supabase.from(table).insert(payload)
    const response=await query.select('*').single()
    if(response.error) throw response.error
    await refresh()
    return response.data as Record<string,any>
  },[companyId,demo,refresh])

  const updateCompany=useCallback(async(changes:Partial<Company>)=>{
    if(demo){setCompany(c=>({...c,...changes}));return}
    if(!supabase)throw new Error('Banco indisponível')
    const response=await supabase.from('company_settings').update(changes).eq('id',companyId)
    if(response.error)throw response.error
    await refresh()
  },[companyId,demo,refresh])

  const completeAppointment=useCallback(async(id:string)=>{
    if(demo){
      let orderId=''
      setData(prev=>{
        const ap=prev.appointments.find(a=>a.id===id)
        if(!ap) throw new Error('Agendamento não encontrado')
        if(ap.status==='cancelled')throw new Error('Agendamento cancelado')
        const existing=prev.service_orders.find(o=>o.appointment_id===id)
        if(existing){orderId=existing.id;return prev}
        const items=prev.appointment_items.filter(a=>a.appointment_id===id)
        if(!items.length)throw new Error('Adicione um serviço antes de concluir')
        orderId=uuid()
        const now=new Date().toISOString()
        const order:ServiceOrder={id:orderId,company_id:companyId,client_id:ap.client_id,
          vehicle_id:ap.vehicle_id,appointment_id:id,status:'completed',total_cents:items.reduce((sum,i)=>sum+i.price_cents,0),
          completed_at:now,created_at:now}
        const orderItems:ServiceOrderItem[]=items.map(item=>({
          id:uuid(),company_id:companyId,order_id:orderId,description:item.description,
          service_id:item.service_id,price_cents:item.price_cents,coins:item.coins
        }))
        return {...prev,appointments:prev.appointments.map(a=>a.id===id?{...a,status:'completed' as const}:a),
          service_orders:[order,...prev.service_orders],service_order_items:[...orderItems,...prev.service_order_items]}
      })
      return orderId
    }
    if(!supabase)throw new Error('Banco indisponível')
    const result=await supabase.rpc('complete_appointment',{p_appointment_id:id})
    if(result.error)throw result.error
    await refresh()
    return result.data as string
  },[companyId,demo,refresh])

  const recordPayment=useCallback(async(orderId:string,amount:number,method:Payment['method'])=>{
    if(!Number.isInteger(amount)||amount<=0)throw new Error('Valor inválido')
    if(demo){
      setData(prev=>{
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
        return {...prev,payments:[payment,...prev.payments],loyalty_ledger:[...ledger,...prev.loyalty_ledger]}
      })
      return
    }
    await save('payments',{order_id:orderId,amount_cents:amount,method,paid_at:new Date().toISOString()})
  },[companyId,demo,save])

  const redeem=useCallback(async(clientId:string,rewardId:string)=>{
    if(demo){
      setData(prev=>{
        const client=prev.clients.find(c=>c.id===clientId)
        const reward=prev.loyalty_rewards.find(r=>r.id===rewardId&&r.active)
        if(!client||!reward)throw new Error('Cliente ou recompensa inválida')
        const balance=prev.loyalty_ledger.filter(l=>l.client_id===clientId).reduce((s,l)=>s+l.change,0)
        if(balance<reward.cost)throw new Error('Saldo insuficiente')
        const rid=uuid(),now=new Date().toISOString()
        const redemption:LoyaltyRedemption={id:rid,company_id:companyId,client_id:clientId,reward_id:rewardId,cost:reward.cost,created_at:now}
        const ledger:LoyaltyLedger={id:uuid(),company_id:companyId,client_id:clientId,change:-reward.cost,kind:'redeem',
          source_id:rid,description:'Resgate: '+reward.name,created_at:now}
        return {...prev,loyalty_redemptions:[redemption,...prev.loyalty_redemptions],loyalty_ledger:[ledger,...prev.loyalty_ledger]}
      })
      return
    }
    if(!supabase)throw new Error('Banco indisponível')
    const response=await supabase.rpc('redeem_loyalty',{p_client_id:clientId,p_reward_id:rewardId})
    if(response.error)throw response.error
    await refresh()
  },[companyId,demo,refresh])

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
    save,updateCompany,completeAppointment,recordPayment,redeem,uploadClientPhoto,uploadLogo}}>
    {children}
  </Context.Provider>
}
export function useStore(){
  const ctx=useContext(Context)
  if(!ctx)throw new Error('DataProvider ausente')
  return ctx
}
