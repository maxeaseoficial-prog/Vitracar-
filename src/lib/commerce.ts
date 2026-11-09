import type { Quote, QuoteItem, StatusQuote } from '../types'

export const QUOTE_STATUSES: {value:StatusQuote;label:string}[] = [
  {value:'draft',label:'Rascunho'}, {value:'sent',label:'Emitido'},
  {value:'approved',label:'Aprovado'}, {value:'declined',label:'Recusado'},
  {value:'cancelled',label:'Cancelado'}
]
export const quoteStatusLabel = (status:StatusQuote) => QUOTE_STATUSES.find(s=>s.value===status)?.label || status
export const quoteSubtotal = (items:Pick<QuoteItem,'quantity'|'unit_cents'>[]) => items.reduce((n,i)=>n+i.quantity*i.unit_cents,0)
export const quoteTotal = (q:Pick<Quote,'discount_cents'>,items:Pick<QuoteItem,'quantity'|'unit_cents'>[]) => Math.max(0,quoteSubtotal(items)-q.discount_cents)
export function durationLabel(minutes:number|null|undefined){
  if(!minutes||!Number.isFinite(minutes))return 'Duração a combinar'
  const h=Math.floor(minutes/60),m=minutes%60
  return h?`${h}h${m?` ${m}min`:''}`:`${m} min`
}
export function readableError(cause:unknown){
  if(cause instanceof Error)return cause.message
  if(cause&&typeof cause==='object'&&'message' in cause)return String(cause.message)
  return 'Não foi possível concluir. Tente novamente.'
}
