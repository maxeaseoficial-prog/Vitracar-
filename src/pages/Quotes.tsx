import { useState, type FormEvent } from 'react'
import { Download, FileText, Plus, SearchCheck } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { Button, Empty, ErrorText, Field, Input, PageHeading, Panel, SearchInput, Select, Status, TableWrap, Textarea } from '../components/UI'
import { downloadQuotePDF } from '../lib/pdf'
import { useStore } from '../lib/store'
import { date, money, priceToCents, centsToPrice, sum } from '../lib/utils'
import type { Quote, StatusQuote } from '../types'

export function Quotes(){
  const {data,company,save}=useStore()
  const [params]=useSearchParams()
  const [search,setSearch]=useState(''),[open,setOpen]=useState(Boolean(params.get('vehicle')))
  const [clientId,setClientId]=useState(params.get('client')||'')
  const [vehicleId,setVehicleId]=useState(params.get('vehicle')||'')
  const [selected,setSelected]=useState<Record<string,{chosen:boolean;quantity:number;price:string}>>({})
  const [discount,setDiscount]=useState('0'),[notes,setNotes]=useState('')
  const [error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false)
  const clients=data.clients
  const cars=data.vehicles.filter(v=>v.client_id===clientId)
  const services=data.services.filter(s=>s.active)
  const active=services.filter(s=>selected[s.id]?.chosen)
  const subtotal=sum(active.map(s=>priceToCents(selected[s.id].price)*selected[s.id].quantity))
  const discountCents=Math.max(0,priceToCents(discount)||0)
  const rows=[...data.quotes].filter(q=>{
    const c=clients.find(c=>c.id===q.client_id)
    const v=data.vehicles.find(v=>v.id===q.vehicle_id)
    return (c?.name+' '+v?.brand+' '+v?.model+' '+v?.plate+' '+q.quote_number).toLowerCase().includes(search.toLowerCase())
  }).sort((a,b)=>b.created_at.localeCompare(a.created_at))
  function changeService(id:string,patch:Partial<{chosen:boolean;quantity:number;price:string}>){
    const s=services.find(s=>s.id===id)!
    setSelected(state=>({...state,[id]:{chosen:false,quantity:1,price:centsToPrice(s.price_cents),...state[id],...patch}}))
  }
  function newQuote(){
    setClientId('');setVehicleId('');setSelected({});setNotes('');setDiscount('0');setError(null);setOpen(true)
  }
  async function submit(e:FormEvent){
    e.preventDefault();setError(null);setSaving(true)
    try {
      if(!clientId||!vehicleId)throw new Error('Selecione cliente e veículo.')
      if(!active.length)throw new Error('Selecione pelo menos um serviço.')
      if(!Number.isFinite(discountCents)||discountCents>subtotal)throw new Error('Desconto inválido.')
      for(const s of active){
        const item=selected[s.id]
        if(!Number.isInteger(item.quantity)||item.quantity<1||!Number.isFinite(priceToCents(item.price))||priceToCents(item.price)<0)
          throw new Error('Confira os valores e quantidades.')
      }
      const quote=await save('quotes',{client_id:clientId,vehicle_id:vehicleId,status:'draft',
        discount_cents:discountCents,notes:notes||null})
      for(const s of active)await save('quote_items',{quote_id:quote.id,service_id:s.id,description:s.name,
        unit_cents:priceToCents(selected[s.id].price),quantity:selected[s.id].quantity})
      setOpen(false)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSaving(false)}
  }
  async function changeStatus(q:Quote,status:StatusQuote){
    try{await save('quotes',{status},q.id)}
    catch(e){alert(e instanceof Error?e.message:String(e))}
  }
  async function pdf(q:Quote){
    const c=data.clients.find(c=>c.id===q.client_id)
    const v=data.vehicles.find(v=>v.id===q.vehicle_id)
    if(!c||!v){alert('Cliente ou veículo não encontrado');return}
    try{await downloadQuotePDF(q,data.quote_items.filter(i=>i.quote_id===q.id),c,v,company)}
    catch(e){alert(e instanceof Error?e.message:String(e))}
  }
  return <>
    <PageHeading eyebrow="COMERCIAL" title="Orçamentos" subtitle="Propostas organizadas e documentos em PDF para seus clientes."
      actions={<Button onClick={newQuote}><Plus size={16}/> Novo orçamento</Button>}/>
    <div className="filter-bar"><SearchInput value={search} onChange={setSearch} placeholder="Buscar cliente, veículo ou número..."/>
      <div className="filter-right"><span className="tag">{rows.length} orçamentos</span></div></div>
    <Panel title="Propostas registradas">
      {rows.length?<TableWrap><thead><tr><th>NÚMERO</th><th>CLIENTE / VEÍCULO</th><th>EMISSÃO</th><th>TOTAL</th><th>STATUS</th><th></th></tr></thead>
        <tbody>{rows.map(q=>{
          const client=data.clients.find(c=>c.id===q.client_id),v=data.vehicles.find(v=>v.id===q.vehicle_id)
          const total=Math.max(0,sum(data.quote_items.filter(i=>i.quote_id===q.id).map(i=>i.quantity*i.unit_cents))-q.discount_cents)
          return <tr key={q.id}>
            <td><strong>#{String(q.quote_number).padStart(5,'0')}</strong></td>
            <td><strong>{client?.name||'—'}</strong><div className="small-note">{v?.brand} {v?.model} · {v?.plate}</div></td>
            <td>{date(q.created_at)}</td><td><strong>{money(total)}</strong></td>
            <td><select className="form-input" style={{minWidth:120,paddingTop:6,paddingBottom:6}} value={q.status}
              onChange={e=>void changeStatus(q,e.target.value as StatusQuote)} aria-label={`Status orçamento ${q.quote_number}`}>
              <option value="draft">Rascunho</option><option value="sent">Emitido</option><option value="approved">Aprovado</option>
              <option value="declined">Recusado</option><option value="cancelled">Cancelado</option></select></td>
            <td className="actions-cell"><Button variant="secondary" size="small" onClick={()=>void pdf(q)}><Download size={14}/> PDF</Button></td>
          </tr>
        })}</tbody></TableWrap>:<Empty title="Nenhum orçamento encontrado" description="Crie propostas personalizadas e gere PDFs." action={<Button size="small" onClick={newQuote}><Plus size={14}/> Criar orçamento</Button>}/>}
    </Panel>
    {open&&<Modal title="Novo orçamento" wide onClose={()=>setOpen(false)}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Cliente"><Select required value={clientId} onChange={e=>{setClientId(e.target.value);setVehicleId('')}}>
            <option value="">Selecione o cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select></Field>
          <Field label="Veículo"><Select required value={vehicleId} onChange={e=>setVehicleId(e.target.value)}>
            <option value="">Selecione o veículo</option>{cars.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}
          </Select></Field>
        </div>
        <Field label="Serviços incluídos">
          {services.length?<div className="item-picker">{services.map(s=>{
            const item=selected[s.id],checked=item?.chosen||false
            return <div className="picker-row" key={s.id}>
              <input aria-label={`Selecionar ${s.name}`} type="checkbox" checked={checked}
                onChange={e=>changeService(s.id,{chosen:e.target.checked})}/>
              <span>{s.name}</span>
              {checked?<><Input aria-label="Quantidade" type="number" min="1" step="1" style={{width:62}} value={item.quantity}
                onChange={e=>changeService(s.id,{quantity:Number(e.target.value)})}/>
                <Input aria-label="Preço em reais" style={{width:93}} inputMode="decimal" value={item.price}
                  onChange={e=>changeService(s.id,{price:e.target.value})}/></>:
                <strong>{money(s.price_cents)}</strong>}
            </div>
          })}</div>:<Empty title="Cadastre serviços antes de criar um orçamento" action={<span className="small-note">Acesse Serviços para adicionar opções.</span>}/>}
        </Field>
        <div className="form-grid">
          <Field label="Desconto (R$)"><Input inputMode="decimal" value={discount} onChange={e=>setDiscount(e.target.value)}/></Field>
          <Field label="Situação inicial"><Input disabled value="Rascunho"/></Field>
        </div>
        <Field label="Observações"><Textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
        <div className="modal-summary"><span>Total do orçamento</span><strong>{money(Math.max(0,subtotal-discountCents))}</strong></div>
        <ErrorText message={error}/>
        <div className="form-actions"><Button type="button" variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={saving||!active.length}><FileText size={15}/>{saving?'Salvando...':'Criar orçamento'}</Button></div>
      </form>
    </Modal>}
  </>
}
