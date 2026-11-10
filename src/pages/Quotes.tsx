import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, CarFront, Check, CheckCircle2, ChevronRight, Clock3, Download, Eye, FileText, Minus, Plus, Search, Sparkles, UserRound, X } from 'lucide-react'
import { Modal } from '../components/Modal'
import { AttentionNotice, Avatar, Button, Empty, ErrorText, Field, Input, PageHeading, Panel, Textarea } from '../components/UI'
import { ClientVehiclePicker, QuoteStatusBadge, QuoteStatusPicker, VehicleIdentity } from '../components/commerce/CommerceControls'
import { QuotePreview, type QuoteDocumentData } from '../components/commerce/QuotePreview'
import { useStore } from '../lib/store'
import { centsToPrice, date, escapeSearch, formatPhone, formatQuoteNumber, money, priceToCents } from '../lib/utils'
import { durationLabel, QUOTE_STATUSES, quoteTotal, readableError } from '../lib/commerce'
import type { Quote, QuoteItem, StatusQuote } from '../types'
import '../commerce.css'
import { QuoteEditor } from '../components/commerce/QuoteEditor'

type Seed={clientId:string;vehicleId:string}
type Selection=Record<string,{quantity:string;price:string}>

export function Quotes(){
  const {data,company,save}=useStore()
  const [params,setParams]=useSearchParams()
  const [draft,setDraft]=useState<Seed|null>(()=>params.get('vehicle')?{clientId:params.get('client')||'',vehicleId:params.get('vehicle')||''}:null)
  const [search,setSearch]=useState(''),[filter,setFilter]=useState<StatusQuote|'all'>('all')
  const [preview,setPreview]=useState<QuoteDocumentData|null>(null)
  const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState('')
  const [busyStatus,setBusyStatus]=useState<string|null>(null),[busyPdf,setBusyPdf]=useState<string|null>(null)
  const itemsByQuote=useMemo(()=>{
    const map=new Map<string,QuoteItem[]>();for(const item of data.quote_items){const row=map.get(item.quote_id)||[];row.push(item);map.set(item.quote_id,row)}return map
  },[data.quote_items])
  const rows=useMemo(()=>[...data.quotes].filter(q=>{
    if(filter!=='all'&&q.status!==filter)return false
    const c=data.clients.find(c=>c.id===q.client_id),v=data.vehicles.find(v=>v.id===q.vehicle_id)
    return escapeSearch(`${c?.name||''} ${v?.brand||''} ${v?.model||''} ${v?.plate||''} ${formatQuoteNumber(q.quote_number)}`).includes(escapeSearch(search))
  }).sort((a,b)=>b.created_at.localeCompare(a.created_at)),[data.quotes,data.clients,data.vehicles,filter,search])
  const approved=data.quotes.filter(q=>q.status==='approved'),pending=data.quotes.filter(q=>q.status==='draft'||q.status==='sent')
  const valueOf=(q:Quote)=>quoteTotal(q,itemsByQuote.get(q.id)||[])
  function documentFor(q:Quote):QuoteDocumentData{
    const client=data.clients.find(c=>c.id===q.client_id),vehicle=data.vehicles.find(v=>v.id===q.vehicle_id&&v.client_id===q.client_id)
    if(!client||!vehicle)throw new Error('O cliente ou o veículo deste orçamento não está disponível.')
    return {quote:q,items:itemsByQuote.get(q.id)||[],client,vehicle,company}
  }
  function showPreview(q:Quote){setError(null);try{setPreview(documentFor(q))}catch(cause){setError(readableError(cause))}}
  async function download(q:Quote){
    if(busyPdf)return;setBusyPdf(q.id);setError(null)
    try{const d=documentFor(q);const {downloadQuotePDF}=await import('../lib/pdf');await downloadQuotePDF(d.quote,d.items,d.client,d.vehicle,d.company)}catch(cause){setError(readableError(cause))}finally{setBusyPdf(null)}
  }
  async function changeStatus(q:Quote,status:StatusQuote){
    if(busyStatus||status===q.status)return;setBusyStatus(q.id);setError(null)
    try{await save('quotes',{status},q.id)}catch(cause){setError(readableError(cause))}finally{setBusyStatus(null)}
  }
  const closeEditor=useCallback(()=>{setDraft(null);setParams(p=>{const next=new URLSearchParams(p);next.delete('client');next.delete('vehicle');return next},{replace:true})},[setParams])
  const closePreview=useCallback(()=>setPreview(null),[])
  function saved(){closeEditor();setFilter('all');setSearch('');setNotice('Orçamento salvo. A proposta já está disponível para visualizar ou baixar em PDF.')}
  return <div className="cx-page">
    <PageHeading eyebrow="COMERCIAL" title="Orçamentos" subtitle="Propostas com a mesma atenção que você dedica a cada veículo."
      actions={<Button onClick={()=>{setNotice('');setDraft({clientId:'',vehicleId:''})}}><Plus size={16}/>Novo orçamento</Button>}/>
    <div className="cx-metrics cx-metrics-three">
      <div className="cx-metric cx-metric-feature"><span><FileText size={17}/>Propostas criadas</span><strong>{data.quotes.length}</strong><small>orçamentos no seu histórico</small></div>
      <div className="cx-metric"><span><Clock3 size={17}/>Em negociação</span><strong>{money(pending.reduce((n,q)=>n+valueOf(q),0))}</strong><small>{pending.length} rascunho(s) ou emitido(s)</small></div>
      <div className="cx-metric"><span><CheckCircle2 size={17}/>Propostas aprovadas</span><strong>{money(approved.reduce((n,q)=>n+valueOf(q),0))}</strong><small>{approved.length} aprovado(s) · não representa recebimentos</small></div>
    </div>
    {notice&&<div className="cx-notice" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button type="button" aria-label="Dispensar aviso" onClick={()=>setNotice('')}><X size={15}/></button></div>}
    <ErrorText message={error}/>
    <div className="cx-toolbar"><div className="cx-search"><Search size={17}/><input aria-label="Buscar orçamentos" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Busque por cliente, placa ou orçamento..."/></div><span className="cx-result-count">{rows.length} proposta(s)</span></div>
    <div className="cx-filter-tabs cx-quote-filters" role="group" aria-label="Filtrar orçamentos por situação">
      <button type="button" className={filter==='all'?'is-selected':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Todos <b>{data.quotes.length}</b></button>
      {QUOTE_STATUSES.map(s=><button type="button" key={s.value} className={filter===s.value?'is-selected':''} aria-pressed={filter===s.value} onClick={()=>setFilter(s.value)}>{s.label}<b>{data.quotes.filter(q=>q.status===s.value).length}</b></button>)}
    </div>
    {rows.length?<div className="cx-quote-grid">{rows.map(q=>{
      const client=data.clients.find(c=>c.id===q.client_id),vehicle=data.vehicles.find(v=>v.id===q.vehicle_id),items=itemsByQuote.get(q.id)||[]
      return <article className="cx-quote-card" key={q.id}>
        <header><div className="cx-quote-ref"><FileText size={15}/><strong>{formatQuoteNumber(q.quote_number)}</strong><span>{date(q.created_at)}</span></div><QuoteStatusPicker value={q.status} onChange={status=>void changeStatus(q,status)} disabled={busyStatus!==null} label={`Alterar situação do orçamento ${formatQuoteNumber(q.quote_number)}`}/></header>
        <div className="cx-quote-client">{client?<Avatar client={client}/>:<UserRound size={26}/>}<div><strong>{client?.name||'Cliente indisponível'}</strong><small>{client?formatPhone(client.whatsapp)||'WhatsApp não informado':''}</small></div></div>
        {vehicle&&<div className="cx-quote-card-vehicle"><VehicleIdentity vehicle={vehicle} compact/></div>}
        <div className="cx-quote-card-services"><Sparkles size={14}/><span>{items.slice(0,2).map(i=>`${i.quantity>1?`${i.quantity}× `:''}${i.description}`).join(' · ')||'Sem itens registrados'}{items.length>2&&` +${items.length-2} item(ns)`}</span></div>
        <footer><div><small>Total da proposta</small><strong>{money(valueOf(q))}</strong></div><div className="cx-quote-card-actions"><Button variant="secondary" size="small" onClick={()=>showPreview(q)}><Eye size={14}/>Ver PDF</Button><button type="button" className="cx-download-button" aria-label={`Baixar PDF do orçamento ${formatQuoteNumber(q.quote_number)}`} disabled={busyPdf!==null} onClick={()=>void download(q)}><Download size={17}/></button></div></footer>
      </article>
    })}</div>:<Panel><Empty title={data.quotes.length?'Nenhuma proposta encontrada':'Sua próxima proposta começa aqui'} description={data.quotes.length?'Tente outro filtro, nome ou placa.':'Escolha o cliente, selecione os serviços e gere um orçamento com a identidade da VitraCar.'} action={<Button onClick={()=>setDraft({clientId:'',vehicleId:''})}><Plus size={15}/>Criar orçamento</Button>}/></Panel>}
    {draft&&<QuoteEditor seed={draft} onClose={closeEditor} onSaved={saved} onPreview={setPreview}/>}
    {preview&&<QuotePreview document={preview} onClose={closePreview}/>}
  </div>
}
