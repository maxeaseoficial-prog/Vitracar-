import { lazy, Suspense, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Columns3, Info, MapPin, Pencil, Plus, RefreshCw, Search, WalletCards, X } from 'lucide-react'
import { Modal } from '../components/Modal'
import { AttentionNotice, Avatar, Button, ErrorText, Loading } from '../components/UI'
import { WashCard, STAGE_ICONS, VehiclePhoto } from '../components/agenda/WashCard'
import { AppointmentContact } from '../components/agenda/AppointmentContact'
import { WashEditor } from '../components/agenda/WashEditor'
import { WashPayment } from '../components/agenda/WashPayment'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { formatPlate, money } from '../lib/utils'
import { readableError } from '../lib/commerce'
import { addDays, buildJobs, dateLabel, dayInZone, jobMatches, jobOnDay, safeZone, STAGES, STAGE_HINTS, STAGE_LABELS, suggestedSlot, timeInZone, type WashJob, type WashStage } from '../lib/wash-flow'
import type { CalendarView } from '../components/agenda/WashCalendar'
import type { PaymentMethod } from '../types'
import '../wash-agenda.css'
const WashCalendar=lazy(()=>import('../components/agenda/WashCalendar').then(m=>({default:m.WashCalendar})))
type Editor={slot:string;job?:WashJob;client?:string;vehicle?:string}

export function Agenda(){
  const {data,company,isDemo,refresh,save,completeAppointment,recordPayment}=useStore()
  const zone=safeZone(company.timezone)
  const [params,setParams]=useSearchParams()
  const [today,setToday]=useState(()=>dayInZone(new Date(),zone)),[date,setDate]=useState(()=>dayInZone(new Date(),zone))
  const followsToday=useRef(true)
  const [tab,setTab]=useState<'board'|'calendar'>('board'),[calendarView,setCalendarView]=useState<CalendarView>('month')
  const [search,setSearch]=useState(''),[includePending,setIncludePending]=useState(false),[showCancelled,setShowCancelled]=useState(false)
  const [editor,setEditor]=useState<Editor|null>(()=>params.get('vehicle')?{slot:suggestedSlot(dayInZone(new Date(),zone),zone),client:params.get('client')||'',vehicle:params.get('vehicle')||''}:null)
  const [detailId,setDetailId]=useState<string|null>(null),[payId,setPayId]=useState<string|null>(null)
  const [reopening,setReopening]=useState<{job:WashJob;stage:WashStage}|null>(null)
  const [confirmCancel,setConfirmCancel]=useState(false)
  const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState('')
  const [optimistic,setOptimistic]=useState<{id:string;stage:WashStage}|null>(null)
  const [dragging,setDragging]=useState<string|null>(null),[hovered,setHovered]=useState<WashStage|null>(null)
  const board=useRef<HTMLDivElement>(null),touch=useRef<{id:string;x:number;y:number;active:boolean}|null>(null)
  const operation=useRef(false)
  const jobs=useMemo(()=>buildJobs(data),[data]),jobsRef=useRef(jobs);jobsRef.current=jobs
  const filtered=useMemo(()=>jobs.filter(j=>jobMatches(j,search)),[jobs,search])
  const previous=filtered.filter(j=>j.appointment.status!=='cancelled'&&dayInZone(j.appointment.starts_at,zone)<date&&j.stage!=='paid')
  const daily=filtered.filter(j=>j.appointment.status!=='cancelled'&&(jobOnDay(j,date,zone)||(includePending&&previous.includes(j))))
  const cancelled=filtered.filter(j=>j.appointment.status==='cancelled'&&jobOnDay(j,date,zone))
  const shown=daily.map(j=>optimistic?.id===j.appointment.id?{...j,stage:optimistic.stage}:j)
  const detail=jobs.find(j=>j.appointment.id===detailId),payment=jobs.find(j=>j.appointment.id===payId)
  useEffect(()=>{
    const update=()=>{const next=dayInZone(new Date(),zone);setToday(old=>{if(old!==next&&followsToday.current)setDate(next);return next})}
    update();const timer=window.setInterval(update,30000);document.addEventListener('visibilitychange',update)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update)}
  },[zone])
  function selectDate(next:string){if(!next)return;followsToday.current=next===dayInZone(new Date(),zone);setDate(next);setIncludePending(false)}
  function goToday(){followsToday.current=true;setDate(dayInZone(new Date(),zone));setIncludePending(false)}
  function closeEditor(){setEditor(null);if(params.has('vehicle'))setParams(p=>{const n=new URLSearchParams(p);n.delete('vehicle');n.delete('client');return n},{replace:true})}
  function newBooking(slot?:string){setEditor({slot:slot||suggestedSlot(date,zone)});setError(null)}
  function resetDrag(){setDragging(null);setHovered(null);touch.current=null}
  async function reload(){if(operation.current)return;setBusy('refresh');try{await refresh()}finally{setBusy(null)}}
  async function performMove(job:WashJob,stage:WashStage){
    if(operation.current||job.stage===stage)return
    operation.current=true;setBusy(job.appointment.id);setError(null);setNotice('');setOptimistic({id:job.appointment.id,stage})
    try{
      if(isDemo){
        if(['finished','delivered','paid'].includes(stage))await completeAppointment(job.appointment.id)
        if(stage==='paid'&&!job.settled&&job.total>0)throw new Error('Registre o saldo antes de mover para Pago.')
        const patch:Record<string,unknown>={workflow_stage:stage,workflow_version:(job.appointment.workflow_version||0)+1,workflow_updated_at:new Date().toISOString()}
        if(job.appointment.status!=='completed'&&['scheduled','washing'].includes(stage))patch.status=stage==='washing'?'in_progress':'scheduled'
        await save('appointments',patch,job.appointment.id)
      }else{
        if(!supabase)throw new Error('Conexão indisponível.')
        const result=await supabase.rpc('move_wash_stage',{p_appointment_id:job.appointment.id,p_stage:stage,p_expected_version:job.appointment.workflow_version||0})
        if(result.error)throw result.error
        await refresh()
      }
      setNotice(`Atendimento movido para ${STAGE_LABELS[stage]}.${job.settled&&stage!=='paid'?' O pagamento foi preservado.':''}`)
    }catch(cause){setError(readableError(cause));await refresh()}finally{setOptimistic(null);setBusy(null);operation.current=false}
  }
  function requestMove(id:string,stage:WashStage){
    resetDrag();const job=jobsRef.current.find(j=>j.appointment.id===id)
    if(!job||operation.current||job.appointment.status==='cancelled'||job.stage===stage)return
    if(stage==='paid'){setPayId(id);return}
    if(STAGES.indexOf(stage)<STAGES.indexOf(job.stage)&&job.order){setReopening({job,stage});return}
    void performMove(job,stage)
  }
  async function pay(job:WashJob,amount:number,method:PaymentMethod){
    if(operation.current)throw new Error('Aguarde a gravação em andamento.')
    operation.current=true;setBusy(job.appointment.id);setError(null)
    try{
      if(isDemo){const oid=await completeAppointment(job.appointment.id);if(amount>0)await recordPayment(oid,amount,method);await save('appointments',{workflow_stage:job.received+amount>=job.total?'paid':job.stage==='delivered'?'delivered':'finished',workflow_version:(job.appointment.workflow_version||0)+1},job.appointment.id)}
      else{if(!supabase)throw new Error('Conexão indisponível.');const result=await supabase.rpc('pay_wash_appointment',{p_appointment_id:job.appointment.id,p_amount_cents:amount,p_method:method,p_expected_version:job.appointment.workflow_version||0});if(result.error)throw result.error;await refresh()}
      setNotice(job.received+amount>=job.total?'Atendimento quitado e movido para Pago.':'Recebimento parcial registrado. O saldo continua pendente.')
    }catch(cause){await refresh();throw cause}finally{setBusy(null);operation.current=false}
  }
  async function cancel(job:WashJob){
    if(operation.current)return
    operation.current=true;setBusy(job.appointment.id);setError(null)
    try{await save('appointments',{status:'cancelled'},job.appointment.id);setDetailId(null);setConfirmCancel(false);setNotice('Agendamento cancelado. Ele permanece no histórico da Agenda.')}catch(cause){setError(readableError(cause))}finally{setBusy(null);operation.current=false}
  }
  function nativeDrag(event:DragEvent,id:string){event.dataTransfer.setData('application/vitracar-job',id);event.dataTransfer.effectAllowed='move';setDragging(id)}
  function touchDown(event:PointerEvent<HTMLButtonElement>,id:string){if(event.pointerType==='mouse'||busy)return;event.currentTarget.setPointerCapture(event.pointerId);touch.current={id,x:event.clientX,y:event.clientY,active:false}}
  function touchMove(event:PointerEvent<HTMLButtonElement>){const current=touch.current;if(!current)return;if(!current.active&&Math.hypot(event.clientX-current.x,event.clientY-current.y)<8)return;current.active=true;setDragging(current.id);const column=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-wash-stage]');setHovered((column?.dataset.washStage as WashStage)||null);const rect=board.current?.getBoundingClientRect();if(rect&&board.current){if(event.clientX>rect.right-35)board.current.scrollLeft+=18;if(event.clientX<rect.left+35)board.current.scrollLeft-=18}}
  function touchUp(event:PointerEvent<HTMLButtonElement>){const current=touch.current;const column=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-wash-stage]');const stage=column?.dataset.washStage as WashStage|undefined;if(current?.active&&stage)requestMove(current.id,stage);else resetDrag()}
  return <div className="wash-page">
    <header className="wash-heading"><div><span className="eyebrow">OPERAÇÃO</span><h1>{tab==='board'?'Serviços do dia':'Agenda completa'}</h1><p>{tab==='board'?'Cada carro no seu momento. Do primeiro cuidado à entrega.':'Todos os horários do seu estabelecimento, em um só lugar.'}</p></div><Button className="wash-book-button" onClick={()=>newBooking()}><Plus size={18}/>Marcar lavagem</Button></header>
    <div className="wash-main-toolbar"><div className="wash-tabs" role="tablist" aria-label="Alternar operação e agenda"><button type="button" role="tab" id="wash-board-tab" aria-controls="wash-board-panel" aria-selected={tab==='board'} onClick={()=>setTab('board')} onKeyDown={e=>{if(e.key==='ArrowRight'){setTab('calendar');document.getElementById('wash-calendar-tab')?.focus()}}} className={tab==='board'?'active':''}><Columns3 size={17}/>Serviços do dia</button><button type="button" role="tab" id="wash-calendar-tab" aria-controls="wash-calendar-panel" aria-selected={tab==='calendar'} onClick={()=>setTab('calendar')} onKeyDown={e=>{if(e.key==='ArrowLeft'){setTab('board');document.getElementById('wash-board-tab')?.focus()}}} className={tab==='calendar'?'active':''}><CalendarDays size={17}/>Agenda</button></div>
      <div className="wash-search"><Search size={16}/><input aria-label="Buscar atendimentos" placeholder="Buscar cliente, carro ou placa..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Limpar busca" onClick={()=>setSearch('')}><X size={14}/></button>}</div><button type="button" className="wash-icon-button" title="Atualizar atendimentos" aria-label="Atualizar atendimentos" onClick={()=>void reload()} disabled={Boolean(busy)}><RefreshCw size={17} className={busy==='refresh'?'spin':''}/></button>
    </div>
    <ErrorText message={error}/>{notice&&<div className="wash-notice" role="status"><CheckCircle2 size={16}/><span>{notice}</span><button type="button" onClick={()=>setNotice('')} aria-label="Dispensar aviso"><X size={14}/></button></div>}
    {tab==='board'?<section role="tabpanel" id="wash-board-panel" aria-labelledby="wash-board-tab">
      <div className="wash-day-toolbar"><div className="wash-date-navigation"><button type="button" className="wash-icon-button" aria-label="Dia anterior" onClick={()=>selectDate(addDays(date,-1))}><ChevronLeft size={17}/></button><label className="wash-date-label"><CalendarDays size={17}/><span>{date===today?'Hoje, ':''}{dateLabel(date,{day:'2-digit',month:'short',year:'numeric'})}</span><input type="date" aria-label="Data dos serviços" value={date} onChange={e=>selectDate(e.target.value)}/></label><button type="button" className="wash-icon-button" aria-label="Próximo dia" onClick={()=>selectDate(addDays(date,1))}><ChevronRight size={17}/></button>{date!==today&&<button type="button" className="wash-today" onClick={goToday}>Hoje</button>}</div><div className="wash-day-context"><span>{daily.length} atendimento{daily.length!==1?'s':''}</span>{previous.length>0&&<button type="button" aria-pressed={includePending} className={includePending?'active':''} onClick={()=>setIncludePending(v=>!v)}>{previous.length} pendência{previous.length!==1?'s':''} anterior{previous.length!==1?'es':''}</button>}</div></div>
      <div className="wash-board-scroll" ref={board}><div className="wash-board">{STAGES.map(stage=>{const Icon=STAGE_ICONS[stage],column=shown.filter(j=>j.stage===stage);return <section key={stage} className={`wash-column stage-${stage} ${hovered===stage?'is-over':''}`} data-wash-stage={stage} aria-label={`${STAGE_LABELS[stage]}: ${column.length} atendimentos`} onDragOver={e=>{if(dragging){e.preventDefault();e.dataTransfer.dropEffect='move';setHovered(stage)}}} onDrop={e=>{e.preventDefault();const id=dragging||e.dataTransfer.getData('application/vitracar-job');if(id)requestMove(id,stage);else resetDrag()}}>
        <header className="wash-column-head"><div><span className="wash-stage-icon"><Icon size={20}/></span><h2>{STAGE_LABELS[stage]}</h2><b>{column.length}</b></div><p>{STAGE_HINTS[stage]}</p></header>
        <div className="wash-column-cards">{column.map(job=><WashCard key={job.appointment.id} job={job} zone={zone} date={date} busy={Boolean(busy)} dragging={dragging===job.appointment.id} onDetails={()=>{setDetailId(job.appointment.id);setConfirmCancel(false)}} onMove={next=>requestMove(job.appointment.id,next)} onDragStart={e=>nativeDrag(e,job.appointment.id)} onDragEnd={resetDrag} onPointerDown={e=>touchDown(e,job.appointment.id)} onPointerMove={touchMove} onPointerUp={touchUp}/>)}
          {!column.length&&<div className="wash-column-empty"><Icon size={25} strokeWidth={1.25}/><span>{dragging?'Solte o carro aqui':'Nenhum carro nesta etapa'}</span></div>}
          {stage==='scheduled'&&<button type="button" className="wash-add-card" onClick={()=>newBooking()}><Plus size={15}/>Marcar lavagem</button>}
        </div>
      </section>})}</div></div>
      <div className="wash-board-foot"><span><Info size={13}/>Arraste pelo puxador ou use as setas para avançar e voltar.</span><small>Fuso: {zone.replace('America/','').replaceAll('_',' ')}</small></div>
      {cancelled.length>0&&<div className="wash-cancelled"><button type="button" onClick={()=>setShowCancelled(v=>!v)} aria-expanded={showCancelled}>{showCancelled?'Ocultar':'Ver'} {cancelled.length} cancelado(s) neste dia</button>{showCancelled&&cancelled.map(job=><button type="button" key={job.appointment.id} onClick={()=>setDetailId(job.appointment.id)}>{timeInZone(job.appointment.starts_at,zone)} · {job.vehicle?.model} · {job.client?.name}</button>)}</div>}
    </section>:<section role="tabpanel" id="wash-calendar-panel" aria-labelledby="wash-calendar-tab"><label className="wash-show-cancelled"><input type="checkbox" checked={showCancelled} onChange={e=>setShowCancelled(e.target.checked)}/>Mostrar cancelados</label><Suspense fallback={<Loading label="Abrindo agenda..."/>}><WashCalendar jobs={filtered.filter(j=>showCancelled||j.appointment.status!=='cancelled')} zone={zone} date={date} today={today} view={calendarView} onView={setCalendarView} onDate={selectDate} onToday={goToday} onNew={newBooking} onOpen={job=>{setDetailId(job.appointment.id);setConfirmCancel(false)}}/></Suspense></section>}
    <span className="sr-only" role="status" aria-live="polite">{dragging&&hovered?`Solte para mover para ${STAGE_LABELS[hovered]}`:''}</span>
    {editor&&<WashEditor zone={zone} initialSlot={editor.slot} seedClient={editor.client} seedVehicle={editor.vehicle} job={editor.job} onClose={closeEditor} onSaved={instant=>{selectDate(dayInZone(instant,zone));closeEditor();setNotice('Lavagem agendada. O atendimento já está no quadro e no calendário.')}}/>}
    {payment&&<WashPayment job={payment} onClose={()=>setPayId(null)} onPay={(amount,method)=>pay(payment,amount,method)}/>}
    {reopening&&<Modal title="Voltar uma etapa" onClose={()=>setReopening(null)}><p className="wash-dialog-text">Mover este atendimento para <strong>{STAGE_LABELS[reopening.stage]}</strong>?</p><AttentionNotice>Essa ação reorganiza o trabalho, sem apagar a ordem de serviço, os pagamentos ou as moedas já registradas.{reopening.job.received>0&&<> O recebimento de {money(reopening.job.received)} será preservado.</>}</AttentionNotice><div className="form-actions"><Button variant="secondary" onClick={()=>setReopening(null)}>Cancelar</Button><Button onClick={()=>{const action=reopening;setReopening(null);void performMove(action.job,action.stage)}}><ArrowLeft size={15}/>Confirmar retorno</Button></div></Modal>}
    {detail&&<Modal title="Detalhes do atendimento" onClose={()=>setDetailId(null)} className="wash-detail-modal"><div className="wash-detail-car"><VehiclePhoto job={detail}/><div><strong>{detail.vehicle?.brand} {detail.vehicle?.model}</strong><span>{formatPlate(detail.vehicle?.plate||'')}</span></div><span className={`wash-status-pill stage-${detail.stage}`}>{detail.appointment.status==='cancelled'?'Cancelado':STAGE_LABELS[detail.stage]}</span></div>
      <div className="wash-detail-client">{detail.client&&<Avatar client={detail.client}/>}<strong>{detail.client?.name}</strong></div><div className="wash-detail-facts"><span><CalendarDays size={16}/>{dateLabel(dayInZone(detail.appointment.starts_at,zone))}</span><span><Clock3 size={16}/>{timeInZone(detail.appointment.starts_at,zone)} · {detail.duration} min</span></div><AppointmentContact address={detail.appointment.address} phone={detail.client?.whatsapp}/><ul className="wash-detail-items">{detail.items.map(item=><li key={item.id}><span>{item.description}</span><strong>{money(item.price_cents)}</strong></li>)}</ul>
      <div className="wash-payment-totals"><div><span>Total</span><b>{money(detail.total)}</b></div><div><span>Recebido</span><b>{money(detail.received)}</b></div><div><span>A receber</span><strong>{money(detail.balance)}</strong></div></div>{detail.appointment.notes&&<p className="wash-note">{detail.appointment.notes}</p>}
      {detail.order&&STAGES.indexOf(detail.stage)<2&&<AttentionNotice>Etapa operacional reaberta. O histórico do serviço e os recebimentos continuam preservados.</AttentionNotice>}
      {detail.appointment.status!=='cancelled'&&<div className="wash-detail-actions">{detail.appointment.status!=='completed'&&<><Button variant="secondary" disabled={Boolean(busy)} onClick={()=>{setEditor({job:detail,slot:localDateTimeFor(detail)});setDetailId(null)}}><Pencil size={15}/>Editar horário</Button><Button variant="ghost" disabled={Boolean(busy)} onClick={()=>setConfirmCancel(true)}>Cancelar atendimento</Button></>}<Button disabled={Boolean(busy)} onClick={()=>{setPayId(detail.appointment.id);setDetailId(null)}}><WalletCards size={15}/>{detail.settled?'Encerrar como pago':'Registrar pagamento'}</Button></div>}
      {confirmCancel&&detail.appointment.status!=='completed'&&<div className="wash-cancel-confirm"><AttentionNotice>Cancelar este atendimento? O registro será mantido no histórico.</AttentionNotice><Button variant="secondary" disabled={Boolean(busy)} onClick={()=>setConfirmCancel(false)}>Manter atendimento</Button><Button variant="danger" disabled={Boolean(busy)} onClick={()=>void cancel(detail)}>Confirmar cancelamento</Button></div>}
    </Modal>}
  </div>
  function localDateTimeFor(job:WashJob){return `${dayInZone(job.appointment.starts_at,zone)}T${timeInZone(job.appointment.starts_at,zone)}`}
}

