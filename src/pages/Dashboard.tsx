import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, CarFront, ChevronRight,
  CircleDollarSign, Coins, CreditCard, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Empty, PageHeading, Panel, Status } from '../components/UI'
import { useStore } from '../lib/store'
import { dateTime, money, sum } from '../lib/utils'

type Period=7|30|90
function inRange(value:string,days:number){return new Date(value).getTime()>=Date.now()-days*86400000}
export function Dashboard(){
  const {data,company}=useStore()
  const navigate=useNavigate()
  const [period,setPeriod]=useState<Period>(30)
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
        <div className="chart-container"><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart} margin={{top:10,right:12,left:-18,bottom:0}}>
            <defs><linearGradient id="blueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0131cd" stopOpacity={.18}/><stop offset="100%" stopColor="#0131cd" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke="#eef0f3" strokeDasharray="3 5" vertical={false}/>
            <XAxis dataKey="name" tick={{fill:'#9ca3af',fontSize:10}} axisLine={false} tickLine={false} dy={9}/>
            <YAxis tick={{fill:'#9ca3af',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${Math.round(Number(v)/100)}`} width={55}/>
            <Tooltip formatter={(v,name)=>[money(Number(v)),name==='income'?'Recebimentos':'Despesas']}
              contentStyle={{borderRadius:12,border:'1px solid #e7edf5',boxShadow:'0 8px 26px #13274210',fontSize:11}}/>
            <Legend verticalAlign="bottom" height={22} formatter={v=>v==='income'?'Recebimentos':'Despesas'} wrapperStyle={{fontSize:10,paddingTop:14}}/>
            <Area type="monotone" dataKey="income" stroke="#0131cd" strokeWidth={2.5} fill="url(#blueArea)" dot={false}/>
            <Area type="monotone" dataKey="cost" stroke="#0b0d12" strokeWidth={2} strokeDasharray="5 5" fill="transparent" dot={false}/>
          </AreaChart>
        </ResponsiveContainer></div>
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
          <div className="mini-stat"><small>Clientes</small><strong>{data.clients.length}</strong></div>
          <div className="mini-stat"><small>Veículos</small><strong>{data.vehicles.length}</strong></div>
          <div className="mini-stat"><small>Serviços</small><strong>{data.services.filter(s=>s.active).length}</strong></div>
        </div>
        <div className="detail-line"><span><Users size={15} style={{display:'inline-block',verticalAlign:'middle',marginRight:5}}/> Clientes ativos</span><strong>{data.clients.length}</strong></div>
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
  </>
}
