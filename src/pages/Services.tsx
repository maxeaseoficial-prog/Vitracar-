import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Check, Clock3, Coins, Pencil, Plus, Search, Sparkles, Wrench } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Button, Empty, ErrorText, Field, Input, PageHeading, Panel, Textarea } from '../components/UI'
import { useStore } from '../lib/store'
import { centsToPrice, escapeSearch, money, number, priceToCents } from '../lib/utils'
import { durationLabel, readableError } from '../lib/commerce'
import type { Service } from '../types'
import '../commerce.css'

function ServiceForm({service,onClose}:{service:Service|null;onClose:()=>void}){
  const {save}=useStore()
  const [name,setName]=useState(service?.name||''),[description,setDescription]=useState(service?.description||'')
  const [price,setPrice]=useState(service?centsToPrice(service.price_cents):'')
  const [duration,setDuration]=useState(service?.duration_minutes?String(service.duration_minutes):'')
  const [coins,setCoins]=useState(String(service?.coins??0)),[active,setActive]=useState(service?.active??true)
  const [error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false)
  const priceCents=priceToCents(price)
  async function submit(e:FormEvent){
    e.preventDefault();if(saving)return;setError(null)
    const reward=Number(coins),minutes=duration.trim()?Number(duration):null
    if(!name.trim()){setError('Informe o nome do serviço.');return}
    if(!Number.isSafeInteger(priceCents)||priceCents<0){setError('Informe um preço válido. Exemplo: 150,00.');return}
    if(!coins.trim()||!Number.isSafeInteger(reward)||reward<0){setError('As moedas devem ser um número inteiro igual ou maior que zero.');return}
    if(minutes!==null&&(!Number.isSafeInteger(minutes)||minutes<=0)){setError('A duração deve ser um número inteiro de minutos maior que zero.');return}
    setSaving(true)
    try{
      await save('services',{name:name.trim(),description:description.trim()||null,price_cents:priceCents,
        duration_minutes:minutes,coins:reward,active},service?.id)
      onClose()
    }catch(cause){setError(readableError(cause))}
    finally{setSaving(false)}
  }
  const close=useCallback(()=>{if(!saving)onClose()},[onClose,saving])
  return <Modal title={service?'Editar serviço':'Novo serviço'} onClose={close} className="cx-dialog cx-service-dialog">
    <form className="cx-editor cx-service-editor" onSubmit={submit}>
      <aside className="cx-summary cx-service-summary" aria-label="Prévia do serviço">
        <div className="cx-summary-banner"><span>VITRACAR / SERVIÇOS</span><Sparkles size={22}/></div>
        <div className="cx-summary-content">
          <div className="cx-service-emblem"><Sparkles size={34} strokeWidth={1.5}/></div>
          <span className="cx-overline">PRÉVIA EM TEMPO REAL</span>
          <h3>{name.trim()||'Seu próximo serviço'}</h3>
          <p className="cx-summary-description">{description.trim()||'Mostre o cuidado e os detalhes que fazem parte do seu atendimento.'}</p>
          <div className="cx-service-value"><small>Preço padrão</small><strong>{money(Number.isFinite(priceCents)?priceCents:0)}</strong></div>
          <div className="cx-summary-tiles">
            <div><Clock3 size={17}/><small>Tempo estimado</small><strong>{durationLabel(Number(duration)||null)}</strong></div>
            <div><Coins size={17}/><small>Fidelidade</small><strong>{number(Number(coins)||0)} moedas</strong></div>
          </div>
          <span className={`cx-service-state ${active?'is-active':''}`}><i/>{active?'Disponível para orçamento':'Serviço pausado'}</span>
          <p className="cx-summary-note">Os valores serão usados como padrão nos próximos orçamentos e agendamentos.</p>
        </div>
      </aside>
      <div className="cx-editor-fields">
        <div className="cx-section-heading"><div><span className="cx-overline">PERSONALIZE SEU CATÁLOGO</span><h3>Um serviço bem apresentado.</h3><p>Defina os detalhes. A prévia ao lado acompanha suas alterações.</p></div></div>
        <Field label="Nome do serviço"><Input autoFocus required maxLength={160} disabled={saving} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Polimento técnico"/></Field>
        <Field label="O que está incluído?" hint="Uma descrição clara ajuda o cliente a entender o valor do serviço."><Textarea rows={3} disabled={saving} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descreva o cuidado, as etapas e os diferenciais do atendimento..."/></Field>
        <div className="cx-two-columns">
          <Field label="Preço padrão (R$)"><div className="cx-money-input"><span>R$</span><Input required disabled={saving} inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0,00"/></div></Field>
          <Field label="Duração (minutos)"><div className="cx-icon-input"><Clock3 size={16}/><Input disabled={saving} type="number" min="1" step="1" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="Ex.: 90"/></div></Field>
        </div>
        <div className="cx-two-columns">
          <Field label="Moedas de fidelidade"><div className="cx-icon-input"><Coins size={16}/><Input required disabled={saving} type="number" min="0" step="1" value={coins} onChange={e=>setCoins(e.target.value)}/></div></Field>
          <div className="field"><span className="field-label">Disponibilidade</span><div className="cx-availability" role="radiogroup" aria-label="Disponibilidade do serviço">
            <button type="button" role="radio" disabled={saving} aria-checked={active} className={active?'is-selected':''} onClick={()=>setActive(true)}><Check size={14}/>Ativo</button>
            <button type="button" role="radio" disabled={saving} aria-checked={!active} className={!active?'is-selected':''} onClick={()=>setActive(false)}>Pausado</button>
          </div></div>
        </div>
        <ErrorText message={error}/>
        <div className="cx-editor-actions"><Button type="button" variant="secondary" disabled={saving} onClick={close}>Cancelar</Button><Button type="submit" disabled={saving}><Check size={16}/>{saving?'Salvando...':'Salvar serviço'}</Button></div>
      </div>
    </form>
  </Modal>
}

export function Services(){
  const {data,save}=useStore()
  const [editing,setEditing]=useState<Service|null>(null),[modal,setModal]=useState(false)
  const [search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|'active'|'paused'>('all')
  const [error,setError]=useState<string|null>(null),[busyId,setBusyId]=useState<string|null>(null)
  const active=data.services.filter(s=>s.active)
  const rows=useMemo(()=>data.services.filter(s=>(filter==='all'||s.active===(filter==='active'))&&escapeSearch(`${s.name} ${s.description||''}`).includes(escapeSearch(search))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),[data.services,filter,search])
  function open(service?:Service){setEditing(service||null);setModal(true)}
  const close=useCallback(()=>setModal(false),[])
  async function toggle(service:Service){
    if(busyId)return;setBusyId(service.id);setError(null)
    try{await save('services',{active:!service.active},service.id)}catch(cause){setError(readableError(cause))}finally{setBusyId(null)}
  }
  return <div className="cx-page">
    <PageHeading eyebrow="OPERAÇÃO" title="Catálogo de serviços" subtitle="Apresente seus cuidados, organize os valores e valorize cada atendimento."
      actions={<Button onClick={()=>open()}><Plus size={16}/> Novo serviço</Button>}/>
    <div className="cx-metrics cx-metrics-three">
      <div className="cx-metric cx-metric-feature"><span><Wrench size={17}/>Seu catálogo</span><strong>{data.services.length}</strong><small>serviços cadastrados</small></div>
      <div className="cx-metric"><span><Check size={17}/>Disponíveis</span><strong>{active.length}</strong><small>serviços ativos para orçar</small></div>
      <div className="cx-metric"><span><Sparkles size={17}/>Valor médio</span><strong>{money(active.length?Math.round(active.reduce((n,s)=>n+s.price_cents,0)/active.length):0)}</strong><small>dos serviços ativos</small></div>
    </div>
    <ErrorText message={error}/>
    <div className="cx-toolbar"><div className="cx-search"><Search size={17}/><input aria-label="Buscar serviços" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Busque um serviço..."/></div>
      <div className="cx-filter-tabs" role="group" aria-label="Filtrar serviços">{(['all','active','paused'] as const).map(v=><button key={v} type="button" aria-pressed={filter===v} className={filter===v?'is-selected':''} onClick={()=>setFilter(v)}>{v==='all'?'Todos':v==='active'?'Ativos':'Pausados'}</button>)}</div>
    </div>
    {rows.length?<div className="cx-service-grid">{rows.map(service=><article className={`cx-service-card ${!service.active?'is-paused':''}`} key={service.id}>
      <header><span className="cx-card-symbol"><Sparkles size={23}/></span><span className={`cx-service-state ${service.active?'is-active':''}`}><i/>{service.active?'Ativo':'Pausado'}</span></header>
      <h3>{service.name}</h3><p>{service.description||'Nenhuma descrição adicionada.'}</p>
      <div className="cx-card-meta"><span><Clock3 size={14}/>{durationLabel(service.duration_minutes)}</span><span><Coins size={14}/>{number(service.coins)} moedas</span></div>
      <div className="cx-service-card-price"><small>Valor padrão</small><strong>{money(service.price_cents)}</strong></div>
      <footer><Button variant="secondary" size="small" onClick={()=>open(service)} aria-label={`Editar ${service.name}`}><Pencil size={14}/>Editar serviço</Button><button type="button" className="cx-text-button" disabled={busyId!==null} onClick={()=>void toggle(service)}>{busyId===service.id?'Salvando...':service.active?'Pausar':'Ativar'}</button></footer>
    </article>)}</div>:<Panel><Empty title={data.services.length?'Nenhum serviço encontrado':'Seu catálogo começa aqui'} description={data.services.length?'Tente outro nome ou filtro.':'Cadastre o primeiro serviço e defina seu preço e moedas de fidelidade.'} action={!data.services.length?<Button onClick={()=>open()}><Plus size={15}/>Cadastrar serviço</Button>:undefined}/></Panel>}
    {modal&&<ServiceForm service={editing} onClose={close}/>}
  </div>
}
