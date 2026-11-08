import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import type { Profile } from './types'
import { Layout } from './components/Layout'
import { Loading } from './components/UI'
import { isConfigured, supabase } from './lib/supabase'
import { demoCompany, demoProfile } from './lib/demo'
import { DataProvider, useStore } from './lib/store'
import { Login, Onboarding } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Clients, ClientProfile, VehicleDetail } from './pages/Clients'
import { Services } from './pages/Services'
import { Quotes } from './pages/Quotes'
import { Agenda } from './pages/Agenda'
import { Finance } from './pages/Finance'
import { Loyalty } from './pages/Loyalty'
import { Settings } from './pages/Settings'

function InnerRoutes(){
  const {loading,error,refresh}=useStore()
  if(loading)return <div className="app-shell"><div style={{margin:'auto'}}><Loading label="Carregando sua VitraCar..."/></div></div>
  if(error)return <div style={{maxWidth:600,margin:'10vh auto',padding:20}}>
    <h2>Não foi possível carregar os dados</h2><p className="muted">{error}</p>
    <button className="btn btn-primary" onClick={()=>void refresh()}>Tentar novamente</button>
  </div>
  return <Routes><Route element={<Layout/>}>
    <Route index element={<Dashboard/>}/>
    <Route path="/clientes" element={<Clients/>}/>
    <Route path="/clientes/:id" element={<ClientProfile/>}/>
    <Route path="/veiculos/:id" element={<VehicleDetail/>}/>
    <Route path="/servicos" element={<Services/>}/>
    <Route path="/orcamentos" element={<Quotes/>}/>
    <Route path="/agenda" element={<Agenda/>}/>
    <Route path="/financeiro" element={<Finance/>}/>
    <Route path="/fidelidade" element={<Loyalty/>}/>
    <Route path="/configuracoes" element={<Settings/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route></Routes>
}
function LiveApp(){
  const [user,setUser]=useState<User|null|undefined>(undefined)
  const [profile,setProfile]=useState<Profile|null>(null)
  const [profileLoading,setProfileLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{
    if(!supabase)return
    let mounted=true
    void supabase.auth.getUser().then(({data,error})=>{
      if(!mounted)return
      if(error&&error.name!=='AuthSessionMissingError')setError(error.message)
      setUser(data.user||null)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(mounted)setUser(session?.user||null)
    })
    return()=>{mounted=false;subscription.unsubscribe()}
  },[])
  const loadProfile=useCallback(async()=>{
    if(!user||!supabase){setProfile(null);setProfileLoading(false);return}
    setProfileLoading(true);setError(null)
    const result=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle()
    if(result.error)setError(result.error.message)
    else setProfile(result.data as Profile|null)
    setProfileLoading(false)
  },[user])
  useEffect(()=>{void loadProfile()},[loadProfile])
  if(user===undefined||profileLoading)return <Loading label="Verificando acesso..."/>
  if(error)return <div className="auth-side"><div className="auth-form"><h2>Erro de autenticação</h2>
    <p>{error}</p><button className="btn btn-secondary" onClick={()=>void loadProfile()}>Tentar novamente</button></div></div>
  if(!user)return <Login/>
  if(!profile)return <Onboarding onDone={loadProfile}/>
  return <DataProvider key={profile.company_id} companyId={profile.company_id} profile={profile} demo={false}><InnerRoutes/></DataProvider>
}
export function App(){
  if(!isConfigured)return <DataProvider companyId={demoCompany.id} profile={demoProfile} demo={true}><InnerRoutes/></DataProvider>
  return <LiveApp/>
}
