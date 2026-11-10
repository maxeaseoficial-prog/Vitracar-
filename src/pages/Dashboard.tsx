import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, CarFront, ChevronRight,
  CircleDollarSign, Coins, CreditCard, Droplets, MessageCircle, Users } from 'lucide-react'
import { Avatar, Empty, Loading, PageHeading, Panel, Status } from '../components/UI'
import { useStore } from '../lib/store'
import { sinceLabel, washGaps } from '../lib/last-wash'
import { date, dateTime, formatPlate, money, sum, whatsappLink } from '../lib/utils'

const FinancialChart=lazy(()=>import('../components/FinancialChart').then(m=>({default:m.FinancialChart})))

type Period=7|30|90
function inRange(value:string,days:number){return new Date(value).getTime()>=Date.now()-days*86400000}
export function Dashboard(){
  const {data,company}=useStore()
  const navigate=useNavigate()
  const [period,setPeriod]=useState<Period>(30)
  const [showAllGaps,setShowAllGaps]=useState(false)
  const gaps=useMemo(()=>washGaps(data.clients,data.service_orders),[data.clients,data.service_orders])
  const shownGaps=showAllGaps?gaps:gaps.slice(0,5)
  const sold=sum(data.service_orders.filter(o=>o.status==='completed'&&inRange(o.completed_at||o.created_at,period)).map(o=>o.total_cents))
  const received=sum(data.payments.filter(p=>inRange(p.paid_at,period)).map(p=>p.amount_cents))
  const expenses=sum(data.expenses.filter(e=>inRange(e.occurred_on+'T12:00:00',period)).map(e=>e.amount_cents))
  const totalSold=sum(data.service_orders.filter(o=>o.status==='completed').map(o=>o.total_cents))
  const totalPaid=sum(data.payments.map(p=>p.amount_cents))
  const outstanding=Math.max(0,totalSold-totalPaid)
  const chart=useMemo(()=>{
    const count=period===7?7:period===30?10:12
    const step=period/count
    return Array.from({length:count},(_,i)=>{
      const start=Date.now()-(period-i*step)*86400000
      const end=Date.now()-(period-(i+1)*step)*86400000
      const income=sum(data.payments.filter(p=>new Date(p.paid_at).getTime()>=start&&new Date(p.paid_at).getTime()<end).map(p=>p.amount_cents))
      const cost=sum(data.expenses.filter(e=>new Date(e.occurred_on+'T12:00:00').getTime()>=start&&new Date(e.occurred_on+'T12:00:00').getTime()<end).map(e=>e.amount_cents))
      return {name:new Date(start).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),income,cost}
    })
  },[data.payments,data.expenses,period])
  const upcoming=data.appointments.filter(a=>a.status!=='cancelled'&&a.status!=='completed')
    .sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,4)
  const latest=data.service_orders.filter(o=>o.status==='completed')
    .sort((a,b)=>(b.completed_at||'').localeCompare(a.completed_at||'')).slice(0,5)
  const kpis=[
    {label:'Faturamento',value:money(sold),icon:CircleDollarSign,foot:'Serviços concluídos no período',tone:''},
    {label:'Recebimentos',value:money(received),icon:CreditCard,foot:'Valores efetivamente recebidos',tone:'green'},
    {label:'Despesas',value:money(expenses),icon:ArrowDownRight,foot:'Saídas registradas no período',tone:'red'},
    {label:'Saldo estimado',value:money(received-expenses),icon:Banknote,foot:'Recebimentos menos despesas',tone:'dark'}
  ]
  return <>
    <PageHeading eyebrow="VISÃO GERAL" title={`Bom trabalho! Bem-vindo à ${company.name}.`}
      subtitle="Acompanhe os indicadores do seu estabelecimento em tempo real."
      actions={<div className="period-tabs">{([7,30,90] as Period[]).map(days=><button key={days}
        className={`period-tab ${period===days?'active':''}`} onClick={()=>setPeriod(days)}>
        {days===7?'7 dias':days===30?'30 dias':'90 dias'}</button>)}</div>}/>
    <div className="kpi-grid">{kpis.map(k=><div key={k.label} className="kpi-card">
      <div className="kpi-head"><span className="kpi-label">{k.label}</span><div className={`kpi-icon ${k.tone}`}><k.icon size={18}/></div></div>
      <div className="kpi-value">{k.value}</div><div className="kpi-foot">{k.foot}</div>
    </div>)}</div>
    <div className="dashboard-grid">
      <Panel title="Evolução financeira" action={<span className="tag">Últimos {period} dias</span>}>
        <div className="chart-container"><Suspense fallback={<Loading label="Carregando gráfico..."/>}><FinancialChart chart={chart}/></Suspense></div>
      </Panel>
      <Panel title="Próximos agendamentos" action={<button className="text-action" onClick={()=>navigate('/agenda')}>Ver agenda <ChevronRight size={14}/></button>}>
        {upcoming.length?upcoming.map(a=>{
          const vehicle=data.vehicles.find(v=>v.id===a.vehicle_id)
          const client=data.clients.find(c=>c.id===a.client_id)
          return <div className="list-item-row" key={a.id}><div className="list-icon"><CalendarDays size={17}/></div>
            <div style={{minWidth:0}}><div className="list-item-title">{client?.name||'Cliente'}</div>
              <div className="list-item-subtitle">{vehicle?.brand} {vehicle?.model} · {dateTime(a.starts_at)}</div></div>
            <div className="list-item-right"><Status status={a.status}/></div>
          </div>
        }):<Empty title="Sem agendamentos pendentes" description="Os próximos horários aparecerão aqui."/>}
      </Panel>
    </div>
    <div className="dashboard-grid dashboard-grid-secondary">
      <Panel title="Serviços realizados recentemente" action={<button className="text-action" onClick={()=>navigate('/financeiro')}>Ver financeiro <ChevronRight size={14}/></button>}>
        {latest.length?latest.map(order=>{
          const client=data.clients.find(c=>c.id===order.client_id)
          const vehicle=data.vehicles.find(v=>v.id===order.vehicle_id)
          const paid=sum(data.payments.filter(p=>p.order_id===order.id).map(p=>p.amount_cents))
          return <div key={order.id} className="list-item-row"><div className="list-icon"><CarFront size={18}/></div>
            <div><div className="list-item-title">{vehicle?.brand} {vehicle?.model} <span className="muted">· {client?.name}</span></div>
              <div className="list-item-subtitle">{dateTime(order.completed_at)} · {paid>=order.total_cents?'Recebido':'Pagamento pendente'}</div></div>
            <strong className="list-item-right list-item-value">{money(order.total_cents)}</strong>
          </div>
        }):<Empty title="Nenhum serviço concluído" description="Conclua um agendamento para iniciar o histórico."/>}
      </Panel>
      <Panel title="Seu negócio em números">
        <div className="mini-stats-grid" style={{marginBottom:20}}>
          <div className="mini-stat"><small>Clientes</small><strong>{data.clients.filter(c=>!c.archived_at).length}</strong></div>
          <div className="mini-stat"><small>Veículos</small><strong>{data.vehicles.filter(v=>data.clients.some(c=>c.id===v.client_id&&!c.archived_at)).length}</strong></div>
          <div className="mini-stat"><small>Serviços</small><strong>{data.services.filter(s=>s.active).length}</strong></div>
        </div>
        <div className="detail-line"><span><Users size={15} style={{display:'inline-block',verticalAlign:'middle',marginRight:5}}/> Clientes ativos</span><strong>{data.clients.filter(c=>!c.archived_at).length}</strong></div>
        <div className="detail-line"><span><Coins size={15} style={{display:'inline-block',verticalAlign:'middle',marginRight:5}}/> Moedas distribuídas</span>
          <strong>{sum(data.loyalty_ledger.filter(l=>l.kind==='earn').map(l=>l.change))}</strong></div>
        <div className="detail-line"><span><Activity size={15} style={{display:'inline-block',verticalAlign:'middle',marginRight:5}}/> Valores a receber</span>
          <strong>{money(outstanding)}</strong></div>
        <div style={{display:'flex',gap:9,marginTop:18,flexWrap:'wrap'}}>
          <button className="btn btn-secondary btn-small" onClick={()=>navigate('/clientes')}><Users size={14}/> Clientes</button>
          <button className="btn btn-secondary btn-small" onClick={()=>navigate('/agenda')}><ArrowUpRight size={14}/> Nova agenda</button>
        </div>
      </Panel>
    </div>
    <div style={{marginTop:19}}>
      <Panel title="Clientes há mais tempo sem lavar" action={gaps.length>5?<button className="text-action" onClick={()=>setShowAllGaps(v=>!v)} aria-expanded={showAllGaps}>
        {showAllGaps?'Ver menos':`Ver todos (${gaps.length})`}</button>:undefined}>
        {gaps.length?<div className={showAllGaps?'gap-list gap-list-scroll':'gap-list'}>{shownGaps.map(({client,last,days},i)=>{
          const car=last?data.vehicles.find(v=>v.id===last.vehicleId):undefined
          const wa=whatsappLink(client.whatsapp)
          return <div className="list-item-row" key={client.id}>
            <span className="gap-rank">{i+1}</span><Avatar client={client} size="tiny"/>
            <div style={{minWidth:0}}><div className="list-item-title">{client.name}</div>
              <div className="list-item-subtitle">{last?`Última lavagem ${date(last.at)}${car?` · ${car.brand} ${car.model}${car.plate?' '+formatPlate(car.plate):''}`:''}`:`Sem lavagem registrada · cliente desde ${date(client.created_at)}`}</div></div>
            <div className="list-item-right gap-days"><strong>{days===0?'hoje':`${days} ${days===1?'dia':'dias'}`}</strong><small>{last?sinceLabel(days):'sem lavagem'}</small></div>
            {wa&&<a className="icon-button" href={wa} target="_blank" rel="noreferrer" aria-label={`Chamar ${client.name} no WhatsApp`} title="Chamar no WhatsApp"><MessageCircle size={16}/></a>}
          </div>})}</div>
        :<Empty title="Nenhum cliente cadastrado" description="Cadastre clientes para acompanhar quem está há mais tempo sem lavar."/>}
      </Panel>
    </div>
  </>
}
