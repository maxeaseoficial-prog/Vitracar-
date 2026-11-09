import { Component, Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import type { Profile } from './types'
import { Layout } from './components/Layout'
import { Loading } from './components/UI'
import { isConfigured, supabase } from './lib/supabase'
import { demoCompany, demoProfile } from './lib/demo'
import { DataProvider, useStore } from './lib/store'
import { Login, Onboarding } from './pages/Login'

// Cada página é baixada só quando aberta: o 3D (Three.js) e o PDF (jsPDF)
// deixam de pesar na primeira carga.
const Dashboard=lazy(()=>import('./pages/Dashboard').then(m=>({default:m.Dashboard})))
const Clients=lazy(()=>import('./pages/Clients').then(m=>({default:m.Clients})))
const ClientProfile=lazy(()=>import('./pages/Clients').then(m=>({default:m.ClientProfile})))
const VehicleDetail=lazy(()=>import('./pages/Clients').then(m=>({default:m.VehicleDetail})))
const Services=lazy(()=>import('./pages/Services').then(m=>({default:m.Services})))
const Quotes=lazy(()=>import('./pages/Quotes').then(m=>({default:m.Quotes})))
const Agenda=lazy(()=>import('./pages/Agenda').then(m=>({default:m.Agenda})))
const Finance=lazy(()=>import('./pages/Finance').then(m=>({default:m.Finance})))
const Loyalty=lazy(()=>import('./pages/Loyalty').then(m=>({default:m.Loyalty})))
const Settings=lazy(()=>import('./pages/Settings').then(m=>({default:m.Settings})))

// Última barreira: um erro inesperado mostra uma mensagem em vez de tela branca.
class AppErrorBoundary extends Component<{children:ReactNode},{error:Error|null}>{
  state={error:null as Error|null}
  static getDerivedStateFromError(error:Error){return {error}}
  render(){
    if(!this.state.error)return this.props.children
    return <div style={{maxWidth:600,margin:'10vh auto',padding:20}}>
      <h2>Algo deu errado nesta tela</h2>
      <p className="muted">{this.state.error.message}</p>
      <button className="btn btn-primary" onClick={()=>{this.setState({error:null});window.location.assign('/')}}>Voltar ao início</button>
    </div>
  }
}
const page=(node:ReactNode)=><Suspense fallback={<Loading label="Abrindo..."/>}>{node}</Suspense>

function InnerRoutes(){
  const {loading,error,refresh,profile}=useStore()
  if(loading)return <div className="app-shell"><div style={{margin:'auto'}}><Loading label="Carregando sua VitraCar..."/></div></div>
  if(error)return <div style={{maxWidth:600,margin:'10vh auto',padding:20}}>
    <h2>Não foi possível carregar os dados</h2><p className="muted">{error}</p>
    <button className="btn btn-primary" onClick={()=>void refresh()}>Tentar novamente</button>
  </div>
  return <Routes><Route element={<Layout/>}>
    <Route index element={page(<Dashboard/>)}/>
    <Route path="/clientes" element={page(<Clients/>)}/>
    <Route path="/clientes/:id" element={page(<ClientProfile/>)}/>
    <Route path="/veiculos/:id" element={page(<VehicleDetail/>)}/>
    <Route path="/servicos" element={page(<Services/>)}/>
    <Route path="/orcamentos" element={page(<Quotes/>)}/>
    <Route path="/agenda" element={page(<Agenda/>)}/>
    <Route path="/financeiro" element={page(<Finance/>)}/>
    <Route path="/fidelidade" element={page(<Loyalty/>)}/>
    <Route path="/configuracoes" element={profile.role==='admin'?page(<Settings/>):<Navigate to="/" replace/>}/>
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
  return <AppErrorBoundary>{!isConfigured
    ?<DataProvider companyId={demoCompany.id} profile={demoProfile} demo={true}><InnerRoutes/></DataProvider>
    :<LiveApp/>}</AppErrorBoundary>
}
