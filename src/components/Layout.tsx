import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, CarFront, ChevronRight, CircleDollarSign, Coins, FileText,
  LayoutDashboard, Menu, Wrench, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { date } from '../lib/utils'

const menus=[
  {to:'/',label:'Dashboard',icon:LayoutDashboard},
  {to:'/clientes',label:'Clientes e veículos',icon:CarFront},
  {to:'/servicos',label:'Serviços',icon:Wrench},
  {to:'/orcamentos',label:'Orçamentos',icon:FileText},
  {to:'/agenda',label:'Agenda',icon:CalendarDays},
  {to:'/financeiro',label:'Financeiro',icon:CircleDollarSign},
  {to:'/fidelidade',label:'Fidelidade',icon:Coins}
]
export function Layout(){
  const {company,profile,isDemo}=useStore()
  const [open,setOpen]=useState(false)
  const {pathname}=useLocation()
  const current=menus.find(m=>m.to===pathname)||menus[0]
  return <div className="app-shell">
    {open&&<div className="mobile-overlay" onClick={()=>setOpen(false)}/>}
    <aside className={`sidebar ${open?'sidebar-open':''}`}>
      <div className="sidebar-logo">
        <div className="brand-symbol"><CarFront size={22} strokeWidth={2.3}/></div>
        <div className="brand-wordmark">VITRA<span>CAR</span><small>GESTÃO AUTOMOTIVA</small></div>
        <button className="sidebar-close" onClick={()=>setOpen(false)} aria-label="Fechar menu"><X size={20}/></button>
      </div>
      <div className="menu-caption">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Menu principal">
        {menus.map(m=><NavLink to={m.to} key={m.to} onClick={()=>setOpen(false)}
          end={m.to==='/'} className={({isActive})=>`nav-item ${isActive?'active':''}`}>
          <m.icon size={18} strokeWidth={1.85}/><span>{m.label}</span>{m.to===current.to&&<ChevronRight className="nav-arrow" size={15}/>}
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
        </div>
      </header>
      <main className="content-container"><Outlet/></main>
      <footer className="app-footer"><span>VitraCar © {new Date().getFullYear()}</span><span>Gestão automotiva com elegância.</span></footer>
    </div>
  </div>
}
