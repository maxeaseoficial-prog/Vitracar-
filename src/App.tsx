import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import type { Profile } from './types'
import { Layout } from './components/Layout'
import { ErrorText, Loading } from './components/UI'
import { isConfigured, supabase } from './lib/supabase'
import { demoCompany, demoProfile } from './lib/demo'
import { DataProvider, useStore } from './lib/store'
import { Login, Onboarding } from './pages/Login'
import { loadDashboard, loadClients, loadServices, loadQuotes, loadAgenda, loadFinance, loadLoyalty, loadSettings, preloadRoute } from './lib/page-loaders'

// Cada página é baixada só quando aberta: o 3D (Three.js) e o PDF (jsPDF)
// deixam de pesar na primeira carga.
const Dashboard=lazy(()=>loadDashboard().then(m=>({default:m.Dashboard})))
const Clients=lazy(()=>loadClients().then(m=>({default:m.Clients})))
const ClientProfile=lazy(()=>loadClients().then(m=>({default:m.ClientProfile})))
const VehicleDetail=lazy(()=>loadClients().then(m=>({default:m.VehicleDetail})))
const Services=lazy(()=>loadServices().then(m=>({default:m.Services})))
const Quotes=lazy(()=>loadQuotes().then(m=>({default:m.Quotes})))
const Agenda=lazy(()=>loadAgenda().then(m=>({default:m.Agenda})))
const Finance=lazy(()=>loadFinance().then(m=>({default:m.Finance})))
const Loyalty=lazy(()=>loadLoyalty().then(m=>({default:m.Loyalty})))
const Settings=lazy(()=>loadSettings().then(m=>({default:m.Settings})))

// Última barreira: um erro inesperado mostra uma mensagem em vez de tela branca.
class AppErrorBoundary extends Component<{children:ReactNode},{error:Error|null}>{
  state={error:null as Error|null}
  static getDerivedStateFromError(error:Error){return {error}}
  render(){
    if(!this.state.error)return this.props.children
    return <div style={{maxWidth:600,margin:'10vh auto',padding:20}}>
      <h2>Algo deu errado nesta tela</h2>
      <ErrorText message={this.state.error.message}/>
      <button className="btn btn-primary" onClick={()=>{this.setState({error:null});window.location.assign('/')}}>Voltar ao início</button>
    </div>
  }
}
const page=(node:ReactNode)=><Suspense fallback={<Loading label="Abrindo..."/>}>{node}</Suspense>

function InnerRoutes(){
  const {loading,error,refresh,profile}=useStore()
  if(loading)return <div className="app-shell"><div style={{margin:'auto'}}><Loading label="Carregando sua VitraCar..."/></div></div>
  if(error)return <div style={{maxWidth:600,margin:'10vh auto',padding:20}}>
    <h2>Não foi possível carregar os dados</h2><ErrorText message={error}/>
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
  const [profileFor,setProfileFor]=useState<string|null>(null)
  const [profileRevision,setProfileRevision]=useState(0)
  const [error,setError]=useState<string|null>(null)
  const userId=user?.id
  const activeUserId=useRef(userId)
  activeUserId.current=userId
  const profileRequest=useRef(0)
  const loadedFor=useRef<string|null>(null)
  useEffect(()=>{
    if(!supabase)return
    let mounted=true,authChanged=false
    // Keep server validation. A late response must not restore a signed-out user.
    void supabase.auth.getUser().then(({data,error})=>{
      if(!mounted||authChanged)return
      if(error&&error.name!=='AuthSessionMissingError')setError(error.message)
      setUser(data.user||null)
    }).catch(()=>{if(mounted&&!authChanged){setError('Não foi possível verificar o acesso.');setUser(null)}})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(!mounted)return
      if(event!=='INITIAL_SESSION')authChanged=true
      setUser(session?.user||null)
      // Refresh permissions when tokens change, but do not tear down the data store.
      if(event==='TOKEN_REFRESHED'||event==='USER_UPDATED')setProfileRevision(v=>v+1)
    })
    return()=>{mounted=false;subscription.unsubscribe();profileRequest.current++}
  },[])
  const loadProfile=useCallback(async()=>{
    const request=++profileRequest.current
    if(!userId||!supabase){setProfile(null);setProfileFor(null);loadedFor.current=null;setProfileLoading(false);return}
    const first=loadedFor.current!==userId
    if(first)setProfileLoading(true)
    setError(null)
    // Download only the next page's lightweight code while the profile/data load.
    preloadRoute(window.location.pathname)
    try{
      const result=await supabase.from('profiles').select('*').eq('id',userId).maybeSingle()
      if(request!==profileRequest.current||activeUserId.current!==userId)return
      if(result.error)throw result.error
      const next=result.data as Profile|null
      setProfile(previous=>previous?.id===next?.id&&previous?.company_id===next?.company_id&&
        previous?.role===next?.role&&previous?.name===next?.name?previous:next)
      loadedFor.current=userId;setProfileFor(userId)
    }catch(cause){
      if(request===profileRequest.current&&activeUserId.current===userId)setError(cause instanceof Error?cause.message:'Não foi possível carregar seu perfil.')
    }finally{
      if(request===profileRequest.current&&activeUserId.current===userId)setProfileLoading(false)
    }
  },[userId])
  useEffect(()=>{void loadProfile()},[loadProfile,profileRevision])
  if(user===undefined||profileLoading)return <Loading label="Verificando acesso..."/>
  if(error)return <div className="auth-side"><div className="auth-form"><h2>Erro de autenticação</h2>
    <ErrorText message={error}/><button className="btn btn-secondary" onClick={()=>void loadProfile()}>Tentar novamente</button></div></div>
  if(!user)return <Login/>
  // Never render an old account's data during a switch, even before the effect runs.
  if(profileFor!==user.id)return <Loading label="Verificando acesso..."/>
  if(!profile)return <Onboarding onDone={loadProfile}/>
  return <DataProvider key={`${user.id}:${profile.company_id}`} companyId={profile.company_id} profile={profile} demo={false}><InnerRoutes/></DataProvider>
}

export function App(){
  return <AppErrorBoundary>{!isConfigured
    ?<DataProvider companyId={demoCompany.id} profile={demoProfile} demo={true}><InnerRoutes/></DataProvider>
    :<LiveApp/>}</AppErrorBoundary>
}

