import { useMemo, useState, type FormEvent } from 'react'
import { CalendarCheck2, Check, Clock3, Plus } from 'lucide-react'
import { Modal } from '../Modal'
import { Button, ErrorText, Field, Input, Textarea } from '../UI'
import { ClientVehiclePicker } from '../commerce/CommerceControls'
import { useStore } from '../../lib/store'
import { readableError, durationLabel } from '../../lib/commerce'
import { money } from '../../lib/utils'
import { localDateTime, toInstant, type WashJob } from '../../lib/wash-flow'
import '../../commerce.css'
type Props={zone:string;initialSlot:string;seedClient?:string;seedVehicle?:string;job?:WashJob;onClose:()=>void;onSaved:(instant:string)=>void}
export function WashEditor({zone,initialSlot,seedClient='',seedVehicle='',job,onClose,onSaved}:Props){
  const {data,createAppointment,save}=useStore()
  const [clientId,setClientId]=useState(job?.appointment.client_id||seedClient),[vehicleId,setVehicleId]=useState(job?.appointment.vehicle_id||seedVehicle)
  const [starts,setStarts]=useState(job?localDateTime(job.appointment.starts_at,zone):initialSlot)
  const [address,setAddress]=useState(job?.appointment.address||'Na unidade'),[notes,setNotes]=useState(job?.appointment.notes||'')
  const [selected,setSelected]=useState<string[]>([]),[duration,setDuration]=useState(job?String(job.duration):'')
  const [error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false)
  const services=useMemo(()=>data.services.filter(s=>s.active).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),[data.services])
  const included=services.filter(s=>selected.includes(s.id)),estimated=included.reduce((n,s)=>n+(s.duration_minutes||0),0)||60
  const total=job?.total??included.reduce((n,s)=>n+s.price_cents,0)
  const car=data.vehicles.find(v=>v.id===vehicleId),client=data.clients.find(c=>c.id===clientId)
  function chooseClient(id:string){setClientId(id);const cars=data.vehicles.filter(v=>v.client_id===id);setVehicleId(cars.length===1?cars[0].id:'')}
  async function submit(event:FormEvent){
    event.preventDefault();if(saving)return;setError(null)
    try{
      if(!client||!car||car.client_id!==client.id)throw new Error('Selecione um cliente e um veículo dele.')
      if(!job&&!included.length)throw new Error('Escolha pelo menos um serviço.')
      const instant=toInstant(starts,zone),minutes=Number(duration||estimated)
      if(!Number.isInteger(minutes)||minutes<5||minutes>1440)throw new Error('Informe uma duração entre 5 e 1440 minutos.')
      setSaving(true)
      const payload={client_id:clientId,vehicle_id:vehicleId,starts_at:instant,address:address.trim()||null,notes:notes.trim()||null,quote_id:null,duration_minutes:minutes}
      if(job){if(job.appointment.status==='completed'||job.appointment.status==='cancelled')throw new Error('Este atendimento já tem histórico encerrado.');await save('appointments',{starts_at:instant,address:payload.address,notes:payload.notes,duration_minutes:minutes},job.appointment.id)}
      else await createAppointment(payload,included.map(s=>({service_id:s.id,description:s.name,price_cents:s.price_cents,coins:s.coins})))
      onSaved(instant)
    }catch(cause){setError(readableError(cause))}finally{setSaving(false)}
  }
  return <Modal title={job?'Editar horário':'Marcar lavagem'} onClose={()=>{if(!saving)onClose()}} className="wash-editor-modal"><form className="wash-editor" onSubmit={submit}>
    <aside className="wash-booking-summary"><span><CalendarCheck2 size={22}/> PRÓXIMO CUIDADO</span><h3>{car?`${car.brand} ${car.model}`:'Uma nova lavagem começa aqui.'}</h3><p>{client?.name||'Escolha o cliente, o carro e o melhor horário.'}</p>{car&&<strong className="wash-summary-plate">{car.plate}</strong>}
      <div className="wash-summary-bottom"><small>Valor do atendimento</small><strong>{money(total)}</strong><span><Clock3 size={14}/>{durationLabel(Number(duration||job?.duration||estimated))} previstos</span></div></aside>
    <div className="wash-editor-fields"><ClientVehiclePicker clients={data.clients} vehicles={data.vehicles} clientId={clientId} vehicleId={vehicleId} onClient={chooseClient} onVehicle={setVehicleId} disabled={saving||Boolean(job)}/>
      <div className="form-grid"><Field label="Data e horário" hint={`Horário do estabelecimento (${zone.replace('America/','').replaceAll('_',' ')})`}><Input required type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)} disabled={saving}/></Field><Field label="Duração (minutos)"><Input required type="number" min={5} max={1440} value={duration||job?.duration||estimated} onChange={e=>setDuration(e.target.value)} disabled={saving}/></Field></div>
      {!job?<section className="wash-service-selection"><h3>O que vamos fazer?</h3>{services.length?services.map(s=><button type="button" key={s.id} disabled={saving} className={selected.includes(s.id)?'selected':''} aria-pressed={selected.includes(s.id)} onClick={()=>setSelected(prev=>prev.includes(s.id)?prev.filter(id=>id!==s.id):[...prev,s.id])}><i>{selected.includes(s.id)?<Check size={15}/>:<Plus size={15}/>}</i><span><strong>{s.name}</strong><small>{s.duration_minutes?durationLabel(s.duration_minutes):'Duração personalizável'}</small></span><b>{money(s.price_cents)}</b></button>):<p>Cadastre um serviço ativo em Serviços antes de marcar a lavagem.</p>}</section>:<p className="wash-note">Serviços e valores são preservados conforme o agendamento original: {job.items.map(i=>i.description).join(', ')}.</p>}
      <Field label="Local do atendimento"><Input value={address} onChange={e=>setAddress(e.target.value)} disabled={saving}/></Field><Field label="Observações"><Textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} disabled={saving} placeholder="Preferências do cliente, detalhes do carro..."/></Field>
      <ErrorText message={error}/><div className="form-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving||(!job&&!included.length)||!clientId||!vehicleId}><CalendarCheck2 size={16}/>{saving?'Salvando...':job?'Salvar horário':'Marcar lavagem'}</Button></div>
    </div></form></Modal>
}
