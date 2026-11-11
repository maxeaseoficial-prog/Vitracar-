import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export interface BillingStatus {
  status: 'trialing'|'active'|'past_due'|'canceled'|'unpaid'|'incomplete'
  allowed: boolean
  paid: boolean
  trial_ends_at: string
  trial_days_left: number
  trial_days_total: number
  current_period_end: string|null
  has_customer: boolean
  welcome_seen: boolean
  is_admin: boolean
}
interface BillingContextValue {
  billing: BillingStatus|null
  refresh: ()=>Promise<BillingStatus|null>
  subscribe: (action?: 'checkout'|'portal')=>Promise<void>
  markWelcomeSeen: ()=>Promise<void>
}
const BillingContext=createContext<BillingContextValue>({billing:null,refresh:async()=>null,subscribe:async()=>{},markWelcomeSeen:async()=>{}})
export const useBilling=()=>useContext(BillingContext)

// Enquanto billing.sql não foi aplicado no banco, o sistema segue liberado (não derruba quem já usa).
const missingFunction=(code?:string)=>code==='PGRST202'||code==='42883'||code==='PGRST205'||code==='42P01'

export async function fetchBillingStatus():Promise<BillingStatus|null>{
  if(!supabase)return null
  const {data,error}=await supabase.rpc('billing_status')
  if(error){
    if(missingFunction(error.code))return null
    throw error
  }
  return data as BillingStatus
}

export async function startSubscription(action:'checkout'|'portal'='checkout'){
  if(!supabase)throw new Error('Conexão indisponível')
  const {data,error}=await supabase.functions.invoke('stripe-checkout',{body:{action}})
  if(error){
    let message='Não foi possível abrir o pagamento agora. Tente novamente em instantes.'
    try{const body=await (error as {context?:Response}).context?.json();if(body?.message)message=body.message}catch{/* mensagem padrão */}
    throw new Error(message)
  }
  if(!data?.url)throw new Error('Não foi possível abrir o pagamento agora.')
  window.location.assign(data.url)
}

export function BillingProvider({children,fallback}:{children:(value:BillingContextValue&{ready:boolean})=>ReactNode;fallback?:ReactNode}){
  const [billing,setBilling]=useState<BillingStatus|null>(null)
  const [ready,setReady]=useState(false)
  const refresh=useCallback(async()=>{
    try{const next=await fetchBillingStatus();setBilling(next);return next}
    catch{return null} // erro de rede: mantém o último estado conhecido
    finally{setReady(true)}
  },[])
  useEffect(()=>{
    void refresh()
    // Revalida ao voltar para a aba (ex.: depois de pagar na Stripe) e a cada 10 minutos.
    const onFocus=()=>{if(document.visibilityState==='visible')void refresh()}
    document.addEventListener('visibilitychange',onFocus)
    const timer=window.setInterval(()=>void refresh(),10*60*1000)
    return()=>{document.removeEventListener('visibilitychange',onFocus);window.clearInterval(timer)}
  },[refresh])
  const markWelcomeSeen=useCallback(async()=>{
    setBilling(b=>b?{...b,welcome_seen:true}:b)
    if(supabase)await supabase.rpc('billing_mark_welcome_seen')
  },[])
  const value={billing,refresh,subscribe:startSubscription,markWelcomeSeen}
  if(!ready&&fallback)return <>{fallback}</>
  return <BillingContext.Provider value={value}>{children({...value,ready})}</BillingContext.Provider>
}
