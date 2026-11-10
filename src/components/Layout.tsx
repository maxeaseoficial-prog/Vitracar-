import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Boxes, Calculator, CalendarDays, CarFront, ChevronRight, CircleDollarSign, Coins, FileText,
  LayoutDashboard, LogOut, Menu, Settings2, Wrench, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { date } from '../lib/utils'
import { preloadRoute, warmNavigation } from '../lib/page-loaders'
import './sidebar-brand.css'
import { ErrorText } from './UI'

const menus=[
  {to:'/',label:'Dashboard',icon:LayoutDashboard},
  {to:'/agenda',label:'Agenda',icon:CalendarDays},
  {to:'/clientes',label:'Clientes e veículos',icon:CarFront},
  {to:'/servicos',label:'Serviços',icon:Wrench},
  {to:'/calcular-preco',label:'Calcular preço',icon:Calculator},
  {to:'/estoque',label:'Estoque',icon:Boxes},
  {to:'/orcamentos',label:'Orçamentos',icon:FileText},
  {to:'/financeiro',label:'Financeiro',icon:CircleDollarSign},
  {to:'/fidelidade',label:'Fidelidade',icon:Coins}
]
export function Layout(){
  const {company,profile,isDemo}=useStore()
  const [open,setOpen]=useState(false)
  const {pathname}=useLocation()
  useEffect(()=>warmNavigation(window.location.pathname),[])
  const navigate=useNavigate()
  const current=pathname==='/configuracoes'?{label:'Configurações'}:menus.find(m=>m.to===pathname)||menus[0]
  const [leaving,setLeaving]=useState(false),[logoutError,setLogoutError]=useState<string|null>(null)
  async function logout(){
    if(!supabase||leaving)return
    setLeaving(true);setLogoutError(null)
    const {error}=await supabase.auth.signOut()
    if(error){setLeaving(false);setLogoutError(error.message)}
  }
  return <div className="app-shell">
    {open&&<div className="mobile-overlay" onClick={()=>setOpen(false)}/>}
    <aside className={`sidebar ${open?'sidebar-open':''}`}>
      <div className="sidebar-logo sidebar-logo-official">
        <img src="/logo-lavoo-white.png" alt="Lavoo" className="sidebar-brand-image"
          loading="eager" decoding="async"/>
        <button className="sidebar-close" onClick={()=>setOpen(false)} aria-label="Fechar menu"><X size={20}/></button>
      </div>
      <div className="menu-caption">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Menu principal">
        {menus.map(m=><NavLink to={m.to} key={m.to} onClick={()=>setOpen(false)}
          onMouseEnter={()=>preloadRoute(m.to)} onFocus={()=>preloadRoute(m.to)} onTouchStart={()=>preloadRoute(m.to)}
          end={m.to==='/'} className={({isActive})=>`nav-item ${isActive?'active':''}`}>
          <m.icon size={18} strokeWidth={1.85}/><span>{m.label}</span>{m.label===current.label&&<ChevronRight className="nav-arrow" size={15}/>}
        </NavLink>)}
      </nav>
      {!isDemo&&<div className="sidebar-bottom">
        <div className="user-compact"><div className="user-letter">{(profile.name||'A')[0]}</div><div><strong>{profile.name||'Administrador'}</strong><small>{profile.role==='admin'?'Administrador':'Colaborador'}</small></div></div>
      </div>}
    </aside>
    <div className="app-main">
      {isDemo&&<div className="demo-banner"><span className="demo-chip">PRÉVIA</span><strong>Modo de demonstração</strong><span>Nenhum dado de exemplo cadastrado. Sem banco conectado, alterações são temporárias.</span></div>}
      <header className="topbar">
        <div className="topbar-left"><button className="menu-toggle" onClick={()=>setOpen(true)} aria-label="Abrir menu"><Menu size={20}/></button>
          <span className="breadcrumb-root">Workspace</span><ChevronRight size={14}/><span>{current.label}</span></div>
        <div className="topbar-right">
          <span className="today-top">{date(new Date().toISOString())}</span>
          <div className="top-separator"/>
          <div className="company-badge"><span className="company-initial">{company.name[0]||'V'}</span><span>{company.name}</span></div>
          {profile.role==='admin'&&<button className="icon-button" onClick={()=>navigate('/configuracoes')}
            aria-label="Configurações" title="Configurações"><Settings2 size={18}/></button>}
          {!isDemo&&<button className="icon-button" onClick={()=>void logout()} disabled={leaving}
            aria-label="Sair da conta" title="Sair da conta"><LogOut size={18}/></button>}
        </div>
      </header>
      <main className="content-container"><ErrorText message={logoutError}/><Outlet/></main>
      <footer className="app-footer"><span>VitraCar © {new Date().getFullYear()}</span><span>Gestão automotiva com elegância.</span></footer>
    </div>
  </div>
}
