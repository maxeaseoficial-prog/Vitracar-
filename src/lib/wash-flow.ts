import type { Appointment, AppointmentItem, Client, Dataset, ServiceOrder, Vehicle } from '../types'

export const STAGES = ['scheduled','washing','finished','delivered','paid'] as const
export type WashStage = typeof STAGES[number]
export type WashAppointment = Appointment & { workflow_stage?: WashStage | null; workflow_version?: number; workflow_updated_at?: string | null; duration_minutes?: number }
export type WashJob = { appointment: WashAppointment; client?: Client; vehicle?: Vehicle; items: AppointmentItem[]; order?: ServiceOrder; stage: WashStage; total: number; received: number; balance: number; settled: boolean; duration: number }
export const STAGE_LABELS: Record<WashStage,string> = { scheduled:'Agendados',washing:'Lavando',finished:'Finalizado',delivered:'Entregue',paid:'Pago' }
export const STAGE_HINTS: Record<WashStage,string> = { scheduled:'Prontos para começar',washing:'Cuidado em andamento',finished:'Prontos para retirada',delivered:'Veículos devolvidos',paid:'Atendimento encerrado' }

export function safeZone(zone?: string): string {
  try { new Intl.DateTimeFormat('pt-BR',{timeZone:zone || 'America/Sao_Paulo'}).format(); return zone || 'America/Sao_Paulo' } catch { return 'America/Sao_Paulo' }
}
const formatters = new Map<string,Intl.DateTimeFormat>()
function parts(value: string | Date,zone: string) {
  let formatter=formatters.get(zone)
  if(!formatter){formatter=new Intl.DateTimeFormat('en-CA',{timeZone:safeZone(zone),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});formatters.set(zone,formatter)}
  return Object.fromEntries(formatter.formatToParts(new Date(value)).map(p=>[p.type,p.value]))
}
export function dayInZone(value: string | Date,zone: string): string { const p=parts(value,zone);return `${p.year}-${p.month}-${p.day}` }
export function timeInZone(value: string | Date,zone: string): string { const p=parts(value,zone);return `${p.hour}:${p.minute}` }
export function localDateTime(value: string | Date,zone: string): string {return `${dayInZone(value,zone)}T${timeInZone(value,zone)}`}
export function toInstant(value: string,zone: string): string {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Informe uma data e horário válidos.')
  const nominal=Date.parse(value+':00Z')
  if(!Number.isFinite(nominal))throw new Error('Data inválida.')
  let candidate=nominal
  for(let i=0;i<4;i++){
    const local=localDateTime(new Date(candidate),zone)
    const difference=nominal-Date.parse(local+':00Z')
    if(!difference)break
    candidate+=difference
  }
  if(localDateTime(new Date(candidate),zone)!==value)throw new Error('Esse horário não existe no fuso do estabelecimento. Escolha outro horário.')
  return new Date(candidate).toISOString()
}
export function addDays(key: string,amount: number): string {const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10)}
export function monthShift(key: string,amount: number): string {const d=new Date(key+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+amount);return d.toISOString().slice(0,10)}
export function weekStart(key: string): string {const weekday=new Date(key+'T12:00:00Z').getUTCDay();return addDays(key,-((weekday+6)%7))}
export function monthDays(key: string): string[] {const first=key.slice(0,7)+'-01';const begin=weekStart(first);return Array.from({length:42},(_,i)=>addDays(begin,i))}
export function dateLabel(key: string,options: Intl.DateTimeFormatOptions={day:'numeric',month:'long',year:'numeric'}): string {return new Intl.DateTimeFormat('pt-BR',{...options,timeZone:'UTC'}).format(new Date(key+'T12:00:00Z'))}
export function minutesAt(value: string,zone: string): number {const [h,m]=timeInZone(value,zone).split(':').map(Number);return h*60+m}
export function suggestedSlot(key: string,zone: string): string {const now=new Date();if(dayInZone(now,zone)!==key)return key+'T09:00';const rounded=new Date(Math.ceil((now.getTime()+60000)/1800000)*1800000);return localDateTime(rounded,zone)}

export function buildJobs(data: Dataset): WashJob[] {
  const clients=new Map(data.clients.map(c=>[c.id,c])),vehicles=new Map(data.vehicles.map(v=>[v.id,v]))
  const services=new Map(data.services.map(s=>[s.id,s]))
  const orders=new Map(data.service_orders.filter(o=>o.status!=='cancelled'&&o.appointment_id).map(o=>[o.appointment_id!,o]))
  const items=new Map<string,AppointmentItem[]>(),received=new Map<string,number>()
  for(const item of data.appointment_items){const group=items.get(item.appointment_id)||[];group.push(item);items.set(item.appointment_id,group)}
  for(const p of data.payments)received.set(p.order_id,(received.get(p.order_id)||0)+p.amount_cents)
  return data.appointments.map(appointment=>{
    const ap=appointment as WashAppointment,order=orders.get(ap.id),lines=items.get(ap.id)||[]
    const total=order?.total_cents??lines.reduce((n,i)=>n+i.price_cents,0),paid=order?(received.get(order.id)||0):0
    const settled=Boolean(order&&order.status==='completed'&&paid>=total)
    let stage: WashStage=ap.workflow_stage || (ap.status==='completed'?(settled?'paid':'finished'):ap.status==='in_progress'?'washing':'scheduled')
    if(stage==='paid'&&!settled)stage='delivered'
    const estimated=lines.reduce((n,i)=>n+(services.get(i.service_id||'')?.duration_minutes||0),0)
    return {appointment:ap,client:clients.get(ap.client_id),vehicle:vehicles.get(ap.vehicle_id),items:lines,order,stage,total,received:paid,balance:Math.max(0,total-paid),settled,duration:Math.min(1440,Math.max(5,ap.duration_minutes||estimated||60))}
  }).sort((a,b)=>a.appointment.starts_at.localeCompare(b.appointment.starts_at)||a.appointment.id.localeCompare(b.appointment.id))
}
export function jobMatches(job: WashJob,search: string): boolean {const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return normalize(`${job.client?.name||''} ${job.vehicle?.brand||''} ${job.vehicle?.model||''} ${job.vehicle?.plate||''} ${job.items.map(i=>i.description).join(' ')}`).includes(normalize(search.trim()))}
export function jobOnDay(job: WashJob,day: string,zone: string): boolean {return dayInZone(job.appointment.starts_at,zone)===day}
export type PositionedJob={job:WashJob;start:number;end:number;lane:number;lanes:number}
/** Clip cross-midnight events and place overlapping bookings side by side. */
export function timelineJobs(jobs: WashJob[],day: string,zone: string): PositionedJob[] {
  const start=Date.parse(toInstant(day+'T00:00',zone)),end=Date.parse(toInstant(addDays(day,1)+'T00:00',zone))
  const entries:PositionedJob[]=jobs.flatMap(job=>{const a=Date.parse(job.appointment.starts_at),b=a+job.duration*60000;if(a>=end||b<=start)return [];return [{job,start:a<start?0:minutesAt(job.appointment.starts_at,zone),end:b>=end?1440:minutesAt(new Date(b).toISOString(),zone),lane:0,lanes:1}]})
  entries.sort((a,b)=>a.start-b.start||b.end-a.end)
  let group:PositionedJob[]=[],lastEnd=-1
  const finish=()=>{const laneEnds:number[]=[];for(const item of group){let lane=laneEnds.findIndex(e=>e<=item.start);if(lane<0)lane=laneEnds.length;laneEnds[lane]=item.end;item.lane=lane}for(const item of group)item.lanes=laneEnds.length;group=[]}
  for(const item of entries){if(item.start>=lastEnd){finish();lastEnd=-1}group.push(item);lastEnd=Math.max(lastEnd,item.end)}finish();return entries
}
