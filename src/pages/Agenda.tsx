import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Pencil, Plus } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Button, Empty, ErrorText, Field, Input, PageHeading, Panel, Select, Status, TableWrap, Textarea } from '../components/UI'
import { useStore } from '../lib/store'
import { dateTime, dateToLocalInput, money, sum } from '../lib/utils'
import type { Appointment } from '../types'

const localKey=(v:string)=>{const d=new Date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const dayKey=(year:number,month:number,day:number)=>`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`

export function Agenda(){
  const {data,save,completeAppointment}=useStore()
  const [params]=useSearchParams()
  const [month,setMonth]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1))
  const [selected,setSelected]=useState(localKey(new Date().toISOString()))
  const [view,setView]=useState<'calendar'|'list'>('calendar')
  const [open,setOpen]=useState(Boolean(params.get('vehicle'))),[editing,setEditing]=useState<Appointment|null>(null)
  const [clientId,setClientId]=useState(params.get('client')||''),[vehicleId,setVehicleId]=useState(params.get('vehicle')||'')
  const [starts,setStarts]=useState(dateToLocalInput(new Date(Date.now()+86400000).toISOString()))
  const [address,setAddress]=useState('Na unidade'),[notes,setNotes]=useState('')
  const [services,setServices]=useState<string[]>([]),[error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false)
  const [filterStatus,setFilterStatus]=useState('all')
  const y=month.getFullYear(),m=month.getMonth()
  const count=new Date(y,m+1,0).getDate()
  const offset=(new Date(y,m,1).getDay()+6)%7
  const weeks=Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>i-offset+1)
  const upcoming=useMemo(()=>[...data.appointments]
    .filter(a=>filterStatus==='all'||a.status===filterStatus)
    .sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),[data.appointments,filterStatus])
  const selectedAppointments=upcoming.filter(a=>localKey(a.starts_at)===selected)
  const filteredMonth=upcoming.filter(a=>new Date(a.starts_at).getMonth()===m&&new Date(a.starts_at).getFullYear()===y)
  const cars=data.vehicles.filter(v=>v.client_id===clientId)
  const available=data.services.filter(s=>s.active)
  const selectedServices=available.filter(s=>services.includes(s.id))
  function newAppointment(){
    setEditing(null);setClientId('');setVehicleId('');setStarts(dateToLocalInput(new Date(Date.now()+86400000).toISOString()))
    setAddress('Na unidade');setNotes('');setServices([]);setError(null);setOpen(true)
  }
  function editAppointment(a:Appointment){
    setEditing(a);setClientId(a.client_id);setVehicleId(a.vehicle_id);setStarts(dateToLocalInput(a.starts_at))
    setAddress(a.address||'');setNotes(a.notes||'')
    setServices(data.appointment_items.filter(i=>i.appointment_id===a.id).map(i=>i.service_id).filter((id):id is string=>Boolean(id)))
    setError(null);setOpen(true)
  }
  async function submit(e:FormEvent){
    e.preventDefault();setSaving(true);setError(null)
    try{
      if(!clientId||!vehicleId||!starts)throw new Error('Preencha cliente, veículo e data.')
      const when=new Date(starts)
      if(isNaN(when.getTime()))throw new Error('Data inválida.')
      if(!editing&&!selectedServices.length)throw new Error('Selecione pelo menos um serviço.')
      if(editing){
        if(editing.status==='completed'||editing.status==='cancelled')throw new Error('Agendamento finalizado não pode ser editado.')
        await save('appointments',{starts_at:when.toISOString(),address:address||null,notes:notes||null},editing.id)
      }else{
        const a=await save('appointments',{client_id:clientId,vehicle_id:vehicleId,
          starts_at:when.toISOString(),address:address||null,notes:notes||null,status:'scheduled',quote_id:null})
        for(const s of selectedServices)await save('appointment_items',{appointment_id:a.id,
          service_id:s.id,description:s.name,price_cents:s.price_cents,coins:s.coins})
      }
      setSelected(localKey(when.toISOString()));setMonth(new Date(when.getFullYear(),when.getMonth(),1));setOpen(false)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSaving(false)}
  }
  async function status(id:string,newStatus:'scheduled'|'in_progress'|'cancelled'){
    try{await save('appointments',{status:newStatus},id)}catch(e){alert(e instanceof Error?e.message:String(e))}
  }
  async function complete(id:string){
    if(!window.confirm('Concluir o atendimento e registrar o histórico do veículo?'))return
    try{await completeAppointment(id)}catch(e){alert(e instanceof Error?e.message:String(e))}
  }
  function shift(v:number){setMonth(new Date(y,m+v,1))}
  const title=month.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
  function appointmentRow(a:Appointment){
    const client=data.clients.find(c=>c.id===a.client_id)
    const vehicle=data.vehicles.find(v=>v.id===a.vehicle_id)
    const items=data.appointment_items.filter(i=>i.appointment_id===a.id)
    return <div className="list-item-row" key={a.id}>
      <div className="list-icon"><Clock3 size={18}/></div>
      <div style={{flex:1,minWidth:0}}><div className="list-item-title">{client?.name} · {vehicle?.brand} {vehicle?.model}</div>
        <div className="list-item-subtitle">{dateTime(a.starts_at)} · {vehicle?.plate} · {items.map(i=>i.description).join(', ')}</div>
        {a.address&&<div className="list-item-subtitle"><MapPin size={12} style={{display:'inline-block',verticalAlign:'middle'}}/> {a.address}</div>}
      </div>
      <div className="list-item-right"><Status status={a.status}/>
        <div style={{marginTop:7,display:'flex',gap:5,justifyContent:'flex-end'}}>
          {a.status==='scheduled'&&<Button size="small" variant="ghost" onClick={()=>void status(a.id,'in_progress')}>Iniciar</Button>}
          {a.status!=='cancelled'&&a.status!=='completed'&&<Button size="small" variant="ghost" onClick={()=>editAppointment(a)}><Pencil size={13}/></Button>}
          {(a.status==='scheduled'||a.status==='in_progress')&&<Button size="small" variant="secondary" onClick={()=>void complete(a.id)}><CheckCircle2 size={13}/> Concluir</Button>}
        </div>
      </div>
    </div>
  }
  return <>
    <PageHeading eyebrow="OPERAÇÃO" title="Agenda de serviços" subtitle="Organize horários, endereços e atendimentos."
      actions={<Button onClick={newAppointment}><Plus size={16}/> Novo agendamento</Button>}/>
    <div className="filter-bar"><div className="period-tabs">
      <button className={`period-tab ${view==='calendar'?'active':''}`} onClick={()=>setView('calendar')}>Calendário</button>
      <button className={`period-tab ${view==='list'?'active':''}`} onClick={()=>setView('list')}>Lista</button>
    </div><div className="filter-right"><Select style={{width:170}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
      <option value="all">Todos os status</option><option value="scheduled">Agendados</option><option value="in_progress">Em andamento</option>
      <option value="completed">Concluídos</option><option value="cancelled">Cancelados</option>
    </Select><span className="tag">{upcoming.length} agendamentos</span></div></div>
    {view==='calendar'?<div className="dashboard-grid">
      <Panel title={title.charAt(0).toUpperCase()+title.slice(1)} action={<div style={{display:'flex',gap:5}}>
        <Button variant="ghost" size="small" onClick={()=>shift(-1)}><ChevronLeft size={16}/></Button>
        <Button variant="ghost" size="small" onClick={()=>shift(1)}><ChevronRight size={16}/></Button></div>}>
        <div style={{overflowX:'auto'}}><div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',minWidth:430}}>
          {['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'#9aa8b8',fontWeight:800,padding:10}}>{d}</div>)}
          {weeks.map((d,i)=>{
            const key=dayKey(y,m,d),visible=d>=1&&d<=count,n=filteredMonth.filter(a=>localKey(a.starts_at)===key).length
            return <button key={i} disabled={!visible} onClick={()=>setSelected(key)} style={{
              height:70,border:'1px solid #f0f2f7',background:selected===key?'#e9f2ff':visible?'#fff':'#f8fafc',
              borderRadius:8,color:selected===key?'#1565d8':visible?'#26394f':'#c7ced8',fontSize:12,
              fontWeight:800,margin:2,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6
            }}>{visible?d:''}{n>0&&<span style={{borderRadius:30,background:selected===key?'#1565d8':'#e5f0fe',color:selected===key?'#fff':'#286fca',padding:'3px 7px',fontSize:9}}>{n} atendimento{n>1?'s':''}</span>}</button>
          })}
        </div></div>
      </Panel>
      <Panel title={new Date(selected+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long'})}
        action={<span className="tag">{selectedAppointments.length} serviços</span>}>
        {selectedAppointments.length?selectedAppointments.map(appointmentRow):
          <Empty title="Nenhum agendamento neste dia" description="Selecione outra data ou registre um novo horário."/>}
      </Panel>
    </div>:<Panel title="Todos os agendamentos">
      {upcoming.length?<TableWrap><thead><tr><th>CLIENTE / VEÍCULO</th><th>DATA / HORA</th><th>STATUS</th><th>VALOR PREVISTO</th><th></th></tr></thead>
        <tbody>{upcoming.map(a=>{
          const c=data.clients.find(c=>c.id===a.client_id),v=data.vehicles.find(v=>v.id===a.vehicle_id)
          return <tr key={a.id}><td><strong>{c?.name}</strong><div className="small-note">{v?.brand} {v?.model} · {v?.plate}</div></td>
            <td>{dateTime(a.starts_at)}</td><td><Status status={a.status}/></td>
            <td>{money(sum(data.appointment_items.filter(i=>i.appointment_id===a.id).map(i=>i.price_cents)))}</td>
            <td className="actions-cell">{a.status!=='completed'&&a.status!=='cancelled'&&<>
              <Button variant="ghost" size="small" onClick={()=>editAppointment(a)}>Editar</Button>
              <Button variant="secondary" size="small" onClick={()=>void complete(a.id)}>Concluir</Button>
              <Button variant="ghost" size="small" onClick={()=>void status(a.id,'cancelled')}>Cancelar</Button>
            </>}</td></tr>
        })}</tbody>
      </TableWrap>:<Empty title="Nenhum agendamento registrado"/>}
    </Panel>}
    {open&&<Modal title={editing?'Editar agendamento':'Novo agendamento'} wide onClose={()=>setOpen(false)}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Cliente"><Select required disabled={Boolean(editing)} value={clientId}
            onChange={e=>{setClientId(e.target.value);setVehicleId('')}}><option value="">Selecione</option>
            {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Veículo"><Select required disabled={Boolean(editing)} value={vehicleId} onChange={e=>setVehicleId(e.target.value)}>
            <option value="">Selecione</option>{cars.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}</Select></Field>
          <Field label="Data e horário"><Input required type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)}/></Field>
          <Field label="Endereço do atendimento"><Input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Na unidade ou endereço informado"/></Field>
        </div>
        {!editing&&<Field label="Serviços do atendimento"><div className="item-picker">
          {available.map(s=><label key={s.id} className="picker-row">
            <input type="checkbox" checked={services.includes(s.id)} onChange={e=>setServices(prev=>
              e.target.checked?[...prev,s.id]:prev.filter(id=>id!==s.id))}/>
            <span>{s.name}</span><strong>{money(s.price_cents)}</strong></label>)}
        </div></Field>}
        {editing&&<p className="small-note">Os serviços são preservados conforme o agendamento original. Para alterar, crie um novo agendamento.</p>}
        <Field label="Observações"><Textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
        {!editing&&<div className="modal-summary"><span>Total estimado</span><strong>{money(sum(selectedServices.map(s=>s.price_cents)))}</strong></div>}
        <ErrorText message={error}/>
        <div className="form-actions"><Button type="button" variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={saving}><CalendarDays size={15}/>{saving?'Salvando...':'Salvar agendamento'}</Button></div>
      </form>
    </Modal>}
  </>
}
