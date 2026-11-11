import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Loader2, Lock, LogOut, PartyPopper, ShieldCheck } from 'lucide-react'
import { BillingProvider, type BillingStatus } from '../../lib/billing'
import { supabase } from '../../lib/supabase'
import { Loading } from '../UI'
import './billing.css'

const PAID_FLAG='assinatura'

/** Envolve o sistema: libera durante o teste/assinatura e bloqueia (fosco + cadeado) depois. */
export function BillingGate({children}:{children:ReactNode}){
  return <BillingProvider fallback={<Loading label="Verificando acesso..."/>}>
    {({billing,refresh,subscribe,markWelcomeSeen})=><GateView billing={billing} refresh={refresh}
      subscribe={subscribe} markWelcomeSeen={markWelcomeSeen}>{children}</GateView>}
  </BillingProvider>
}

export function GateView({billing,refresh,subscribe,markWelcomeSeen,children}:{billing:BillingStatus|null;refresh:()=>Promise<BillingStatus|null>
  subscribe:(action?:'checkout'|'portal')=>Promise<void>;markWelcomeSeen:()=>Promise<void>;children:ReactNode}){
  const appRef=useRef<HTMLDivElement>(null)
  const [confirming,setConfirming]=useState(()=>new URLSearchParams(window.location.search).get(PAID_FLAG)==='sucesso')
  const locked=!!billing&&!billing.allowed

  // Voltando da Stripe: o webhook pode levar alguns segundos. Consulta de novo até liberar (máx. ~40 s).
  useEffect(()=>{
    if(!confirming)return
    const url=new URL(window.location.href);url.searchParams.delete(PAID_FLAG)
    window.history.replaceState(null,'',url.pathname+url.search+url.hash)
    let tries=0,stop=false
    const tick=async()=>{
      const next=await refresh()
      if(stop)return
      if(next?.paid||++tries>=13){setConfirming(false);return}
      window.setTimeout(()=>void tick(),3000)
    }
    void tick()
    return()=>{stop=true}
  },[confirming,refresh])
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get(PAID_FLAG)==='cancelada'){
      const url=new URL(window.location.href);url.searchParams.delete(PAID_FLAG)
      window.history.replaceState(null,'',url.pathname+url.search+url.hash)
    }
  },[])
  // Conteúdo bloqueado não recebe foco, clique nem leitor de tela.
  useEffect(()=>{appRef.current?.toggleAttribute('inert',locked)},[locked])

  return <>
    <div ref={appRef} className={locked?'billing-locked-app':undefined} aria-hidden={locked||undefined}>{children}</div>
    {locked&&<Paywall billing={billing!} confirming={confirming} subscribe={subscribe}/>}
    {billing&&!locked&&!billing.welcome_seen&&!billing.paid&&<Welcome days={billing.trial_days_total} onClose={()=>void markWelcomeSeen()}/>}
  </>
}

function Paywall({billing,confirming,subscribe}:{billing:BillingStatus;confirming:boolean;subscribe:(action?:'checkout'|'portal')=>Promise<void>}){
  const [working,setWorking]=useState(false),[error,setError]=useState<string|null>(null)
  const pastDue=billing.status==='unpaid'||billing.status==='canceled'&&billing.has_customer
  async function go(){
    setWorking(true);setError(null)
    try{await subscribe('checkout')}catch(e){setError(e instanceof Error?e.message:String(e));setWorking(false)}
  }
  return <div className="billing-overlay" role="dialog" aria-modal="true" aria-labelledby="billing-title">
    <section className="billing-card">
      <img src="/logo-lavoo-color.png" alt="Lavoo" className="billing-logo"/>
      <div className="billing-lock" aria-hidden><Lock size={26} strokeWidth={2.2}/></div>
      <h2 id="billing-title">{pastDue?'Sua assinatura está inativa':'Seu período de teste terminou'}</h2>
      <p>Assine nosso plano para continuar com a nossa plataforma. Seus clientes, agenda e financeiro continuam salvos e voltam assim que a assinatura for confirmada.</p>
      {confirming?<div className="billing-confirming"><Loader2 size={18} className="billing-spin"/> Confirmando seu pagamento...</div>
      :billing.is_admin?<button className="btn btn-primary billing-cta" onClick={()=>void go()} disabled={working}>
          {working?<><Loader2 size={18} className="billing-spin"/> Abrindo pagamento...</>:<>Assinar agora <ArrowRight size={18}/></>}
        </button>
      :<p className="billing-note">Peça ao administrador da conta para assinar o plano.</p>}
      {error&&<p className="billing-error" role="alert">{error}</p>}
      <p className="billing-secure"><ShieldCheck size={14}/> Pagamento seguro processado pela Stripe</p>
      {supabase&&<button className="billing-logout" onClick={()=>void supabase!.auth.signOut()}><LogOut size={14}/> Sair da conta</button>}
    </section>
  </div>
}

function Welcome({days,onClose}:{days:number;onClose:()=>void}){
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()}
    window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)
  },[onClose])
  return <div className="billing-overlay billing-overlay-soft" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <section className="billing-card">
      <img src="/logo-lavoo-color.png" alt="Lavoo" className="billing-logo"/>
      <div className="billing-lock billing-party" aria-hidden><PartyPopper size={26} strokeWidth={2.2}/></div>
      <h2 id="welcome-title">Parabéns!</h2>
      <p>Você tem <strong>{days} dias</strong> para testar a nossa plataforma e reportar qualquer tipo de problema.</p>
      <button className="btn btn-primary billing-cta" autoFocus onClick={onClose}>Começar a usar <ArrowRight size={18}/></button>
    </section>
  </div>
}
