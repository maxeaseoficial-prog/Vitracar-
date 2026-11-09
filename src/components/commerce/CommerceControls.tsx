import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { CarFront, Check, ChevronDown, Search, UserRound, X } from 'lucide-react'
import { Avatar } from '../UI'
import type { Client, StatusQuote, Vehicle } from '../../types'
import { escapeSearch, formatPhone, formatPlate } from '../../lib/utils'
import { paintColor } from '../../lib/catalog'
import { QUOTE_STATUSES, quoteStatusLabel } from '../../lib/commerce'

export function QuoteStatusBadge({status}:{status:StatusQuote}){
  return <span className={`cx-status cx-status-${status}`}><i/>{quoteStatusLabel(status)}</span>
}

export function QuoteStatusPicker({value,onChange,disabled=false,label='Alterar situação'}:{value:StatusQuote;onChange:(s:StatusQuote)=>void;disabled?:boolean;label?:string}){
  const [open,setOpen]=useState(false)
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null)
  const id=useId()
  useEffect(()=>{
    if(!open)return
    const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)}
    document.addEventListener('pointerdown',outside)
    const raf=requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
    return()=>{document.removeEventListener('pointerdown',outside);cancelAnimationFrame(raf)}
  },[open])
  function key(e:KeyboardEvent<HTMLDivElement>){
    if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus()}
    if(!open||!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return
    e.preventDefault()
    const nodes=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')||[])
    const at=nodes.indexOf(document.activeElement as HTMLButtonElement)
    const next=e.key==='Home'?0:e.key==='End'?nodes.length-1:(at+(e.key==='ArrowDown'?1:-1)+nodes.length)%nodes.length
    nodes[next]?.focus()
  }
  return <div className="cx-status-picker" ref={root} onKeyDown={key}>
    <button type="button" ref={trigger} className="cx-status-trigger" disabled={disabled} aria-label={label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}>
      <QuoteStatusBadge status={value}/><ChevronDown size={13}/>
    </button>
    {open&&<div className="cx-status-menu" id={id} role="menu" aria-label={label}>
      {QUOTE_STATUSES.map(s=><button key={s.value} type="button" role="menuitemradio" aria-checked={value===s.value}
        onClick={()=>{onChange(s.value);setOpen(false);trigger.current?.focus()}}>
        <QuoteStatusBadge status={s.value}/>{value===s.value&&<Check size={14}/>}</button>)}
    </div>}
  </div>
}

export function VehicleIdentity({vehicle,compact=false}:{vehicle:Vehicle;compact?:boolean}){
  return <span className={`cx-vehicle-identity ${compact?'cx-vehicle-compact':''}`}>
    <span className="cx-car-symbol" aria-hidden="true"><CarFront size={compact?22:30} strokeWidth={1.6}/><i style={{background:paintColor(vehicle.color)}}/></span>
    <span className="cx-vehicle-copy"><strong>{vehicle.brand} {vehicle.model}</strong>
      <span className="cx-vehicle-details">{vehicle.year?`${vehicle.year} · `:''}{vehicle.color||'Cor não informada'}</span>
      <span className="cx-plate">{formatPlate(vehicle.plate)}</span>
    </span>
  </span>
}

export function ClientVehiclePicker({clients,vehicles,clientId,vehicleId,onClient,onVehicle,disabled=false}:{
  clients:Client[];vehicles:Vehicle[];clientId:string;vehicleId:string;
  onClient:(id:string)=>void;onVehicle:(id:string)=>void;disabled?:boolean
}){
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[highlight,setHighlight]=useState(0)
  const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null)
  const id=useId(),labelId=useId()
  const client=clients.find(c=>c.id===clientId)
  const owned=useMemo(()=>vehicles.filter(v=>v.client_id===clientId),[vehicles,clientId])
  const filtered=useMemo(()=>{
    const q=escapeSearch(query)
    return clients.filter(c=>escapeSearch(`${c.name} ${c.whatsapp||''} ${vehicles.filter(v=>v.client_id===c.id).map(v=>v.plate).join(' ')}`).includes(q))
      .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
  },[clients,vehicles,query])
  const cursor=Math.min(highlight,Math.max(0,filtered.length-1))
  useEffect(()=>{
    if(!open)return
    const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)}
    document.addEventListener('pointerdown',outside)
    const raf=requestAnimationFrame(()=>input.current?.focus())
    return()=>{document.removeEventListener('pointerdown',outside);cancelAnimationFrame(raf)}
  },[open])
  useEffect(()=>{if(open)document.getElementById(`${id}-${cursor}`)?.scrollIntoView({block:'nearest'})},[cursor,open,id])
  function choose(c:Client){onClient(c.id);setOpen(false);setQuery('');setHighlight(0);trigger.current?.focus()}
  function key(e:KeyboardEvent<HTMLInputElement>){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();return}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setHighlight((cursor+(e.key==='ArrowDown'?1:-1)+filtered.length)%Math.max(1,filtered.length))}
    if(e.key==='Enter'){e.preventDefault();if(filtered[cursor])choose(filtered[cursor])}
  }
  return <div className="cx-party-grid">
    <div className="cx-client-select" ref={root}>
      <span className="cx-field-label" id={labelId}>Cliente</span>
      <button type="button" ref={trigger} className={`cx-client-trigger ${open?'is-open':''}`} disabled={disabled}
        aria-labelledby={labelId} aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
        onClick={()=>{setOpen(v=>!v);setQuery('');setHighlight(0)}}>
        {client?<Avatar client={client}/>:<span className="cx-client-empty-icon"><UserRound size={24}/></span>}
        <span><strong>{client?.name||'Escolha o cliente'}</strong><small>{client?formatPhone(client.whatsapp)||'WhatsApp não informado':'Busque por nome, telefone ou placa'}</small></span>
        <ChevronDown size={17}/>
      </button>
      {open&&<div className="cx-client-popover">
        <div className="cx-client-search"><Search size={16}/><input ref={input} type="text" role="combobox" value={query}
          aria-label="Buscar cliente" aria-expanded="true" aria-controls={id} aria-autocomplete="list"
          aria-activedescendant={filtered.length?`${id}-${cursor}`:undefined}
          placeholder="Digite o nome do cliente..." onChange={e=>{setQuery(e.target.value);setHighlight(0)}} onKeyDown={key}/>
          {query&&<button type="button" aria-label="Limpar busca de cliente" onClick={()=>{setQuery('');input.current?.focus()}}><X size={14}/></button>}
        </div>
        <div className="cx-client-options" id={id} role="listbox" aria-label="Clientes cadastrados">
          {filtered.map((c,i)=><button key={c.id} type="button" role="option" id={`${id}-${i}`} tabIndex={-1}
            aria-selected={c.id===clientId} className={i===cursor?'is-highlighted':''}
            onMouseDown={e=>e.preventDefault()} onClick={()=>choose(c)}>
            <Avatar client={c} size="tiny"/><span><strong>{c.name}</strong>
              <small>{formatPhone(c.whatsapp)||'Sem WhatsApp'} · {vehicles.filter(v=>v.client_id===c.id).length} veículo(s)</small></span>
            {c.id===clientId&&<Check size={16}/>}</button>)}
          {!filtered.length&&<div className="cx-choice-empty">{clients.length?'Nenhum cliente encontrado.':'Cadastre um cliente para começar.'}</div>}
        </div>
      </div>}
      <small className="cx-helper">O avatar e os dados vêm do cadastro do cliente.</small>
    </div>
    <div className="cx-owned-vehicles">
      <span className="cx-field-label">{client?`Veículos de ${client.name.split(' ')[0]}`:'Veículo'}{client&&<b>{owned.length}</b>}</span>
      {!client?<div className="cx-vehicle-empty"><CarFront size={25}/><span>Selecione um cliente para ver os carros cadastrados.</span></div>:
        !owned.length?<div className="cx-vehicle-empty"><CarFront size={25}/><span>Este cliente ainda não tem veículos. Cadastre um carro no perfil dele antes de criar o orçamento.</span></div>:
          <div className="cx-owned-list" role="radiogroup" aria-label="Escolha o veículo do cliente">
            {owned.map(v=><button type="button" role="radio" key={v.id} disabled={disabled} aria-checked={vehicleId===v.id}
              className={`cx-vehicle-option ${vehicleId===v.id?'is-selected':''}`} onClick={()=>onVehicle(v.id)}>
              <VehicleIdentity vehicle={v} compact/><span className="cx-selection-dot">{vehicleId===v.id&&<Check size={12}/>}</span>
            </button>)}
          </div>}
    </div>
  </div>
}
