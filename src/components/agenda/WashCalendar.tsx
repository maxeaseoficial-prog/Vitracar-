import { useEffect, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, Clock3, Plus } from 'lucide-react'
import { addDays, dateLabel, dayInZone, monthDays, monthShift, timeInZone, timelineJobs, weekStart, type WashJob } from '../../lib/wash-flow'
export type CalendarView='month'|'week'|'day'
type Props={jobs:WashJob[];zone:string;date:string;today:string;view:CalendarView;onView:(v:CalendarView)=>void;onDate:(date:string)=>void;onToday:()=>void;onNew:(slot:string)=>void;onOpen:(job:WashJob)=>void}
const DAYS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
export function WashCalendar({jobs,zone,date,today,view,onView,onDate,onToday,onNew,onOpen}:Props){
  const scroll=useRef<HTMLDivElement>(null)
  const days=useMemo(()=>view==='month'?monthDays(date):view==='week'?Array.from({length:7},(_,i)=>addDays(weekStart(date),i)):[date],[date,view])
  const positioned=useMemo(()=>view==='month'?[]:days.map(day=>timelineJobs(jobs,day,zone)),[jobs,days,zone,view])
  const title=view==='month'?dateLabel(date,{month:'long',year:'numeric'}):view==='week'?`${dateLabel(days[0],{day:'numeric',month:'short'})} — ${dateLabel(days[6],{day:'numeric',month:'short',year:'numeric'})}`:dateLabel(date,{weekday:'long',day:'numeric',month:'long'})
  useEffect(()=>{if(view!=='month'&&scroll.current)scroll.current.scrollTop=7*60},[view])
  function shift(amount:number){onDate(view==='month'?monthShift(date,amount):addDays(date,amount*(view==='week'?7:1)))}
  return <section className="wash-calendar" aria-label="Agenda completa">
    <header className="wash-calendar-toolbar"><div className="wash-calendar-period"><button type="button" className="wash-today" onClick={onToday}>Hoje</button><button type="button" className="wash-icon-button" aria-label="Período anterior" onClick={()=>shift(-1)}><ChevronLeft size={18}/></button><button type="button" className="wash-icon-button" aria-label="Próximo período" onClick={()=>shift(1)}><ChevronRight size={18}/></button><h2>{title}</h2></div>
      <div className="wash-calendar-modes" role="group" aria-label="Visualização da agenda">{(['month','week','day'] as const).map(v=><button type="button" key={v} aria-pressed={view===v} className={view===v?'active':''} onClick={()=>onView(v)}>{v==='month'?'Mês':v==='week'?'Semana':'Dia'}</button>)}</div>
    </header>
    {view==='month'?<div className="wash-month-grid">
      {DAYS.map(d=><div className="wash-week-label" key={d}>{d}</div>)}
      {days.map(day=>{const entries=jobs.filter(j=>dayInZone(j.appointment.starts_at,zone)===day);return <div key={day} className={`wash-month-cell ${day.slice(0,7)!==date.slice(0,7)?'outside':''} ${day===today?'is-today':''}`}>
        <div className="wash-month-cell-top"><button type="button" className="wash-day-number" aria-label={`Ver ${dateLabel(day)}`} onClick={()=>{onDate(day);onView('day')}}>{Number(day.slice(-2))}</button><button type="button" className="wash-cell-new" aria-label={`Marcar lavagem em ${dateLabel(day)}`} onClick={()=>onNew(day+'T09:00')}><Plus size={12}/></button></div>
        <div className="wash-month-events">{entries.slice(0,3).map(job=><button type="button" key={job.appointment.id} className={`wash-month-event stage-${job.stage} ${job.appointment.status==='cancelled'?'is-cancelled':''}`} onClick={()=>onOpen(job)} title={`${timeInZone(job.appointment.starts_at,zone)} · ${job.vehicle?.brand} ${job.vehicle?.model} · ${job.client?.name}`}><i/><b>{timeInZone(job.appointment.starts_at,zone)}</b><span>{job.vehicle?.model||job.client?.name||'Atendimento'}</span></button>)}{entries.length>3&&<button type="button" className="wash-more-events" onClick={()=>{onDate(day);onView('day')}}>+{entries.length-3} mais</button>}</div>
      </div>})}
    </div>:<div className="wash-time-scroll" ref={scroll}><div className={`wash-time-grid ${view==='week'?'is-week':'is-day'}`}>
      <div className="wash-time-head" style={{gridTemplateColumns:`54px repeat(${days.length},minmax(0,1fr))`}}><span><Clock3 size={16}/></span>{days.map(day=><button type="button" key={day} className={day===today?'is-today':''} onClick={()=>{onDate(day);onView('day')}}><small>{dateLabel(day,{weekday:'short'})}</small><strong>{Number(day.slice(-2))}</strong></button>)}</div>
      <div className="wash-timeline" style={{gridTemplateColumns:`54px repeat(${days.length},minmax(0,1fr))`}}><div className="wash-time-labels">{Array.from({length:24},(_,h)=><span key={h} style={{top:h*60}}>{String(h).padStart(2,'0')}:00</span>)}</div>
        {days.map((day,index)=><div className="wash-time-day" key={day}>
          {Array.from({length:48},(_,slot)=><button type="button" key={slot} className="wash-time-slot" style={{top:slot*30}} aria-label={`Marcar ${dateLabel(day)} às ${String(Math.floor(slot/2)).padStart(2,'0')}:${slot%2?'30':'00'}`} onClick={()=>onNew(`${day}T${String(Math.floor(slot/2)).padStart(2,'0')}:${slot%2?'30':'00'}`)}/>)}
          {positioned[index].map(({job,start,end,lane,lanes})=><button type="button" key={job.appointment.id} className={`wash-time-event stage-${job.stage} ${job.appointment.status==='cancelled'?'is-cancelled':''}`} style={{top:start,height:Math.max(24,end-start-2),left:`calc(${lane*100/lanes}% + 3px)`,width:`calc(${100/lanes}% - 6px)`}} onClick={()=>onOpen(job)} title={`${job.client?.name} · ${job.items.map(i=>i.description).join(', ')}`}>
            <b>{job.vehicle?.model||'Atendimento'}</b><span>{timeInZone(job.appointment.starts_at,zone)} · {job.vehicle?.plate}</span>{end-start>45&&<small>{job.client?.name}</small>}
          </button>)}
        </div>)}
      </div>
    </div></div>}
    <footer className="wash-calendar-foot">Clique em um horário para marcar. Clique em um atendimento para ver os detalhes. <span>Fuso: {zone.replace('America/','').replaceAll('_',' ')}</span></footer>
  </section>
}
