import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, CarFront, Check, CheckCircle2, ChevronRight, Clock3, Download, Eye, FileText, Minus, Plus, Search, Sparkles, UserRound, X } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Avatar, Button, Empty, ErrorText, Field, Input, PageHeading, Panel, Textarea } from '../components/UI'
import { ClientVehiclePicker, QuoteStatusBadge, QuoteStatusPicker, VehicleIdentity } from '../components/commerce/CommerceControls'
import { QuotePreview, type QuoteDocumentData } from '../components/commerce/QuotePreview'
import { downloadQuotePDF } from '../lib/pdf'
import { useStore } from '../lib/store'
import { centsToPrice, date, escapeSearch, formatPhone, formatQuoteNumber, money, priceToCents } from '../lib/utils'
import { durationLabel, QUOTE_STATUSES, quoteTotal, readableError } from '../lib/commerce'
import type { Quote, QuoteItem, StatusQuote } from '../types'
import '../commerce.css'

type Seed={clientId:string;vehicleId:string}
type Selection=Record<string,{quantity:string;price:string}>

function QuoteEditor({seed,onClose,onSaved,onPreview}:{seed:Seed;onClose:()=>void;onSaved:()=>void;onPreview:(doc:QuoteDocumentData)=>void}){
  const {data,company,createQuote}=useStore()
  const [clientId,setClientId]=useState(seed.clientId),[vehicleId,setVehicleId]=useState(seed.vehicleId)
  const [selected,setSelected]=useState<Selection>({}),[serviceSearch,setServiceSearch]=useState('')
  const [discount,setDiscount]=useState(''),[notes,setNotes]=useState('')
  const [error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false)
  const client=data.clients.find(c=>c.id===clientId)
  const vehicle=data.vehicles.find(v=>v.id===vehicleId&&v.client_id===clientId)
  const services=data.services.filter(s=>s.active).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
  const included=services.filter(s=>selected[s.id])
  const shown=services.filter(s=>escapeSearch(`${s.name} ${s.description||''}`).includes(escapeSearch(serviceSearch)))
  const discountCents=discount.trim()?priceToCents(discount):0
  const subtotal=included.reduce((n,s)=>{const v=priceToCents(selected[s.id].price)*Number(selected[s.id].quantity);return n+(Number.isFinite(v)?v:0)},0)
  const total=Math.max(0,subtotal-(Number.isFinite(discountCents)?discountCents:0))
  function chooseClient(id:string){
    const owned=data.vehicles.filter(v=>v.client_id===id)
    setClientId(id)
    setVehicleId(id===clientId&&owned.some(v=>v.id===vehicleId)?vehicleId:owned.length===1?owned[0].id:'')
    setError(null)
  }
  function toggle(id:string){
    const s=services.find(s=>s.id===id);if(!s)return
    setSelected(prev=>{const next={...prev};if(next[id])delete next[id];else next[id]={quantity:'1',price:centsToPrice(s.price_cents)};return next})
  }
  function changeLine(id:string,patch:Partial<Selection[string]>){setSelected(prev=>({...prev,[id]:{...prev[id],...patch}}))}
  function validate(){
    if(!client)throw new Error('Selecione um cliente cadastrado.')
    if(!vehicle)throw new Error('Selecione um veículo pertencente ao cliente escolhido.')
    if(!included.length)throw new Error('Inclua pelo menos um serviço no orçamento.')
    const items=included.map(s=>{
      const row=selected[s.id],quantity=Number(row.quantity),unit=priceToCents(row.price)
      if(!row.quantity.trim()||!Number.isSafeInteger(quantity)||quantity<1||quantity>9999)throw new Error(`Confira a quantidade de ${s.name}. Use um número inteiro de 1 a 9999.`)
      if(!Number.isSafeInteger(unit)||unit<0)throw new Error(`Confira o preço de ${s.name}.`)
      return {service_id:s.id,description:s.name,quantity,unit_cents:unit}
    })
    const sum=items.reduce((n,i)=>n+i.quantity*i.unit_cents,0)
    if(!Number.isSafeInteger(sum))throw new Error('O valor total ultrapassa o limite permitido.')
    if(!Number.isSafeInteger(discountCents)||discountCents<0||discountCents>sum)throw new Error('O desconto deve ser igual ou maior que zero e não pode ultrapassar o subtotal.')
    return {items,client,vehicle}
  }
  async function submit(e:FormEvent){
    e.preventDefault();if(saving)return;setError(null)
    try{
      const valid=validate();setSaving(true)
      await createQuote({client_id:valid.client.id,vehicle_id:valid.vehicle.id,discount_cents:discountCents,notes:notes.trim()||null},valid.items)
      onSaved()
    }catch(cause){setError(readableError(cause))}finally{setSaving(false)}
  }
  function preview(){
    setError(null)
    try{
      const valid=validate()
      const quote:Quote={id:'preview',company_id:company.id,quote_number:0,client_id:valid.client.id,vehicle_id:valid.vehicle.id,status:'draft',discount_cents:discountCents,notes:notes.trim()||null,created_at:new Date().toISOString()}
      const items:QuoteItem[]=valid.items.map((item,i)=>({...item,id:`preview-${i}`,company_id:company.id,quote_id:quote.id}))
      onPreview({quote,items,client:valid.client,vehicle:valid.vehicle,company})
    }catch(cause){setError(readableError(cause))}
  }
  const close=useCallback(()=>{if(!saving)onClose()},[saving,onClose])
  return <Modal title="Novo orçamento" onClose={close} className="cx-dialog cx-quote-dialog">
    <form className="cx-editor cx-quote-editor" onSubmit={submit}>
      <aside className="cx-summary cx-quote-summary" aria-label="Resumo do orçamento">
        <div className="cx-summary-banner"><span>VITRACAR / PROPOSTA</span><FileText size={23}/></div>
        <div className="cx-summary-content">
          <div className="cx-quote-avatar">{client?<Avatar client={client} size="large"/>:<UserRound size={37} strokeWidth={1.4}/>}</div>
          <span className="cx-overline">PREPARADO PARA</span><h3>{client?.name||'Seu cliente'}</h3>
          <p className="cx-summary-contact">{client?formatPhone(client.whatsapp)||'WhatsApp não informado':'Escolha um cliente para começar'}</p>
          {vehicle?<div className="cx-summary-car"><VehicleIdentity vehicle={vehicle} compact/></div>:<div className="cx-summary-car cx-summary-car-empty"><CarFront size={22}/><span>O veículo escolhido aparece aqui</span></div>}
          <div className="cx-summary-line-items"><div><strong>Serviços incluídos</strong><span>{included.length}</span></div>
            {included.length?<ul>{included.map(s=><li key={s.id}><span>{selected[s.id].quantity||'0'}× {s.name}</span><b>{money(Number.isFinite(priceToCents(selected[s.id].price)*Number(selected[s.id].quantity))?priceToCents(selected[s.id].price)*Number(selected[s.id].quantity):0)}</b></li>)}</ul>:<p>Adicione os serviços para montar a proposta.</p>}
          </div>
          <div className="cx-summary-totals" aria-live="polite"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Desconto</span><strong>{money(Number.isFinite(discountCents)?discountCents:0)}</strong></div><div className="cx-summary-grandtotal"><span>Total do orçamento</span><strong>{money(total)}</strong></div></div>
          <p className="cx-summary-note"><FileText size={14}/>Você poderá visualizar e baixar o PDF antes de enviar ao cliente.</p>
        </div>
      </aside>
      <div className="cx-editor-fields cx-quote-fields">
        <section className="cx-form-section"><div className="cx-section-heading"><span className="cx-step">01</span><div><h3>Para quem vamos cuidar?</h3><p>Escolha o cliente e um dos veículos dele.</p></div></div>
          <ClientVehiclePicker clients={data.clients} vehicles={data.vehicles} clientId={clientId} vehicleId={vehicleId} onClient={chooseClient} onVehicle={setVehicleId} disabled={saving}/>
          {!data.clients.length&&<Link className="cx-inline-link" to="/clientes">Cadastrar cliente e veículo <ArrowUpRight size={14}/></Link>}
        </section>
        <section className="cx-form-section"><div className="cx-section-heading"><span className="cx-step">02</span><div><h3>Monte o atendimento</h3><p>Adicione os serviços e ajuste quantidades e valores.</p></div><span className="cx-small-count">{included.length} selecionado(s)</span></div>
          {!!services.length&&<div className="cx-search cx-service-search"><Search size={16}/><input aria-label="Buscar serviços no orçamento" value={serviceSearch} onChange={e=>setServiceSearch(e.target.value)} placeholder="Buscar no catálogo de serviços..."/></div>}
          <div className="cx-service-choices">
            {shown.map(s=>{const row=selected[s.id],amount=row?priceToCents(row.price)*Number(row.quantity):0;return <div key={s.id} className={`cx-quote-service ${row?'is-selected':''}`}>
              <button className="cx-service-choice" type="button" aria-pressed={Boolean(row)} disabled={saving} onClick={()=>toggle(s.id)}>
                <span className="cx-service-checkbox">{row?<Check size={15}/>:<Plus size={15}/>}</span>
                <span className="cx-service-choice-copy"><strong>{s.name}</strong><small>{s.duration_minutes?durationLabel(s.duration_minutes):s.description||'Serviço do seu catálogo'}</small></span>
                <b>{money(s.price_cents)}</b>
              </button>
              {row&&<div className="cx-quote-line-edit">
                <div><span className="cx-field-label">Quantidade</span><div className="cx-quantity"><button type="button" disabled={saving||Number(row.quantity)<=1} aria-label={`Diminuir quantidade de ${s.name}`} onClick={()=>changeLine(s.id,{quantity:String(Math.max(1,(Number(row.quantity)||1)-1))})}><Minus size={13}/></button>
                  <input type="number" min="1" max="9999" step="1" disabled={saving} aria-label={`Quantidade de ${s.name}`} value={row.quantity} onChange={e=>changeLine(s.id,{quantity:e.target.value})}/>
                  <button type="button" disabled={saving||Number(row.quantity)>=9999} aria-label={`Aumentar quantidade de ${s.name}`} onClick={()=>changeLine(s.id,{quantity:String(Math.min(9999,(Number(row.quantity)||0)+1))})}><Plus size={13}/></button></div></div>
                <div><label className="cx-field-label" htmlFor={`price-${s.id}`}>Valor unitário (R$)</label><Input id={`price-${s.id}`} aria-label={`Valor unitário de ${s.name}`} disabled={saving} inputMode="decimal" value={row.price} onChange={e=>changeLine(s.id,{price:e.target.value})}/></div>
                <div className="cx-line-total"><span className="cx-field-label">Total do item</span><strong>{money(Number.isFinite(amount)?amount:0)}</strong></div>
              </div>}
            </div>})}
            {!shown.length&&<div className="cx-inline-empty"><Sparkles size={23}/><span>{services.length?'Nenhum serviço corresponde à busca.':'Cadastre serviços ativos antes de criar a proposta.'}</span>{!services.length&&<Link to="/servicos">Ir para serviços <ChevronRight size={13}/></Link>}</div>}
          </div>
        </section>
        <section className="cx-form-section"><div className="cx-section-heading"><span className="cx-step">03</span><div><h3>Os últimos detalhes</h3><p>Finalize os ajustes e confira a proposta.</p></div></div>
          <div className="cx-two-columns"><Field label="Desconto (R$)"><div className="cx-money-input"><span>R$</span><Input disabled={saving} inputMode="decimal" value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="0,00"/></div></Field>
            <div className="cx-initial-status"><span className="cx-field-label">Situação inicial</span><QuoteStatusBadge status="draft"/><small>Você pode alterar depois de salvar.</small></div>
          </div>
          <Field label="Observações para o cliente"><Textarea rows={3} disabled={saving} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Inclua os detalhes e orientações que devem aparecer no PDF..."/></Field>
        </section>
        <ErrorText message={error}/>
        <div className="cx-editor-actions cx-quote-actions"><Button type="button" variant="ghost" disabled={saving} onClick={close}>Cancelar</Button><Button type="button" variant="secondary" disabled={saving||!included.length||!client||!vehicle} onClick={preview}><Eye size={15}/>Prévia do PDF</Button><Button type="submit" disabled={saving||!included.length||!client||!vehicle}><Check size={16}/>{saving?'Salvando...':'Salvar orçamento'}</Button></div>
      </div>
    </form>
  </Modal>
}

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
    try{const d=documentFor(q);await downloadQuotePDF(d.quote,d.items,d.client,d.vehicle,d.company)}catch(cause){setError(readableError(cause))}finally{setBusyPdf(null)}
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
        <div className="cx-quote-card-services"><Sparkles size={14}/><span>{items.slice(0,2).map(i=>`${i.quantity>1?`${i.quantity}× `:''}${i.description}`).join(' · ')||'Sem itens registrados'}{items.length>2&&` +${items.length-2} serviço(s)`}</span></div>
        <footer><div><small>Total da proposta</small><strong>{money(valueOf(q))}</strong></div><div className="cx-quote-card-actions"><Button variant="secondary" size="small" onClick={()=>showPreview(q)}><Eye size={14}/>Ver PDF</Button><button type="button" className="cx-download-button" aria-label={`Baixar PDF do orçamento ${formatQuoteNumber(q.quote_number)}`} disabled={busyPdf!==null} onClick={()=>void download(q)}><Download size={17}/></button></div></footer>
      </article>
    })}</div>:<Panel><Empty title={data.quotes.length?'Nenhuma proposta encontrada':'Sua próxima proposta começa aqui'} description={data.quotes.length?'Tente outro filtro, nome ou placa.':'Escolha o cliente, selecione os serviços e gere um orçamento com a identidade da VitraCar.'} action={<Button onClick={()=>setDraft({clientId:'',vehicleId:''})}><Plus size={15}/>Criar orçamento</Button>}/></Panel>}
    {draft&&<QuoteEditor seed={draft} onClose={closeEditor} onSaved={saved} onPreview={setPreview}/>}
    {preview&&<QuotePreview document={preview} onClose={closePreview}/>}
  </div>
}
