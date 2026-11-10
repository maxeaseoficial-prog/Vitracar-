import { useState, type DragEvent, type PointerEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarCheck2, CarFront, Check, Clock3, Droplets, GripVertical, KeyRound, LoaderCircle, Sparkles, WalletCards } from 'lucide-react'
import { Avatar } from '../UI'
import { AppointmentContact } from './AppointmentContact'
import { formatPlate, money } from '../../lib/utils'
import { STAGES, STAGE_LABELS, dateLabel, dayInZone, timeInZone, type WashJob, type WashStage } from '../../lib/wash-flow'
export const STAGE_ICONS={scheduled:CalendarCheck2,washing:Droplets,finished:Sparkles,delivered:KeyRound,paid:WalletCards}
export function VehiclePhoto({job}:{job:WashJob}){
  const [failed,setFailed]=useState(false)
  return <div className="wash-vehicle-photo" aria-hidden="true">{job.vehicle?.model_3d_id&&!failed?
    <img src={`/car-thumbs/${encodeURIComponent(job.vehicle.model_3d_id)}.webp`} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<CarFront size={38} strokeWidth={1.4}/>}</div>
}
type Props={job:WashJob;zone:string;date:string;busy:boolean;dragging:boolean;onDetails:()=>void;onMove:(stage:WashStage)=>void;onDragStart:(event:DragEvent)=>void;onDragEnd:()=>void;onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>void;onPointerMove:(event:PointerEvent<HTMLButtonElement>)=>void;onPointerUp:(event:PointerEvent<HTMLButtonElement>)=>void}
export function WashCard({job,zone,date,busy,dragging,onDetails,onMove,onDragStart,onDragEnd,onPointerDown,onPointerMove,onPointerUp}:Props){
  const position=STAGES.indexOf(job.stage),previous=STAGES[position-1],next=STAGES[position+1]
  const plate=job.vehicle?.plate?formatPlate(job.vehicle.plate):'Sem placa',when=dayInZone(job.appointment.starts_at,zone)
  return <article className={`wash-card ${dragging?'is-dragging':''} ${busy?'is-busy':''}`} data-job-id={job.appointment.id} draggable={!busy} onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label={`${plate}, ${STAGE_LABELS[job.stage]}`} aria-busy={busy}>
    <div className="wash-card-top"><span className="wash-time"><Clock3 size={12}/>{timeInZone(job.appointment.starts_at,zone)}</span>
      <button type="button" className="wash-drag-handle" disabled={busy} title="Arraste para outra coluna ou use as setas" aria-label={`Arrastar atendimento ${plate}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onDragEnd}
        onKeyDown={e=>{if(e.key==='ArrowLeft'&&previous){e.preventDefault();onMove(previous)}if(e.key==='ArrowRight'&&next){e.preventDefault();onMove(next)}}}><GripVertical size={16}/></button></div>
    <button type="button" className="wash-car-button" onClick={onDetails} disabled={busy} aria-label={`Ver atendimento ${plate}`}>
      <VehiclePhoto key={job.vehicle?.model_3d_id||'generic'} job={job}/><span><strong>{plate}</strong><small>{job.vehicle?.brand} {job.vehicle?.model||'Veículo'}</small></span>
    </button>
    {when!==date&&<span className="wash-previous-day">{dateLabel(when,{day:'2-digit',month:'short'})} · pendente</span>}
    <div className="wash-card-client">{job.client&&<Avatar client={job.client} size="tiny"/>}<span>{job.client?.name||'Cliente'}</span></div>
    <p className="wash-card-services" title={job.items.map(i=>i.description).join(' · ')}>{job.items.map(i=>i.description).join(' · ')||'Serviço não informado'}</p>
    <AppointmentContact address={job.appointment.address} phone={job.client?.whatsapp}/>
    <div className="wash-card-value"><strong>{money(job.total)}</strong>{job.settled?<span className="wash-paid-badge"><Check size={11}/>{job.total===0?'Sem cobrança':'Pago'}</span>:job.received>0?<span className="wash-partial-badge">Parcial</span>:null}</div>
    <footer className="wash-card-footer"><button type="button" disabled={busy||!previous} aria-label={previous?`Voltar ${plate} para ${STAGE_LABELS[previous]}`:'Primeira etapa'} title={previous?`Voltar para ${STAGE_LABELS[previous]}`:'Primeira etapa'} onClick={()=>previous&&onMove(previous)}><ArrowLeft size={15}/></button>
      <span>{busy?<><LoaderCircle size={12} className="spin"/> Salvando</>:next?`Próximo: ${STAGE_LABELS[next]}`:'Tudo concluído'}</span>
      <button type="button" className="wash-next" disabled={busy||!next} aria-label={next?`Mover ${plate} para ${STAGE_LABELS[next]}`:'Última etapa'} title={next?`Mover para ${STAGE_LABELS[next]}`:'Última etapa'} onClick={()=>next&&onMove(next)}><ArrowRight size={15}/></button>
    </footer>
  </article>
}

