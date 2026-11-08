import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Wrench } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Button, Empty, ErrorText, Field, Input, PageHeading, Panel, Status, TableWrap, Textarea } from '../components/UI'
import { useStore } from '../lib/store'
import { centsToPrice, money, priceToCents } from '../lib/utils'
import type { Service } from '../types'

export function Services(){
  const {data,save}=useStore()
  const [editing,setEditing]=useState<Service|null>(null)
  const [modal,setModal]=useState(false)
  const [name,setName]=useState(''),[description,setDescription]=useState(''),[price,setPrice]=useState('0'),
    [duration,setDuration]=useState(''),[coins,setCoins]=useState('0'),[active,setActive]=useState(true)
  const [error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false)
  function open(service?:Service){
    setEditing(service||null);setName(service?.name||'');setDescription(service?.description||'')
    setPrice(service?centsToPrice(service.price_cents):'0')
    setDuration(service?.duration_minutes?String(service.duration_minutes):'')
    setCoins(String(service?.coins??0));setActive(service?.active??true);setError(null);setModal(true)
  }
  async function submit(e:FormEvent){
    e.preventDefault();setSaving(true);setError(null)
    try {
      const cents=priceToCents(price),reward=Number(coins)
      if(!name.trim()||!Number.isFinite(cents)||cents<0||!Number.isInteger(reward)||reward<0)throw new Error('Confira nome, preço e moedas.')
      await save('services',{name:name.trim(),description:description||null,price_cents:cents,
        duration_minutes:duration?Number(duration):null,coins:reward,active},editing?.id)
      setModal(false)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSaving(false)}
  }
  async function toggle(service:Service){
    try{await save('services',{active:!service.active},service.id)}
    catch(e){alert(e instanceof Error?e.message:String(e))}
  }
  const rows=[...data.services].sort((a,b)=>a.name.localeCompare(b.name))
  return <>
    <PageHeading eyebrow="OPERAÇÃO" title="Catálogo de serviços" subtitle="Organize seus procedimentos, valores e moedas de fidelidade."
      actions={<Button onClick={()=>open()}><Plus size={16}/> Novo serviço</Button>}/>
    <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
      <div className="kpi-card"><div className="kpi-head"><span className="kpi-label">Serviços cadastrados</span><div className="kpi-icon"><Wrench size={18}/></div></div><div className="kpi-value">{rows.length}</div><div className="kpi-foot">Total no catálogo</div></div>
      <div className="kpi-card"><div className="kpi-label">Serviços ativos</div><div className="kpi-value">{rows.filter(s=>s.active).length}</div><div className="kpi-foot">Disponíveis para agendamento</div></div>
      <div className="kpi-card"><div className="kpi-label">Preço médio</div><div className="kpi-value">{money(rows.length?Math.round(rows.reduce((a,s)=>a+s.price_cents,0)/rows.length):0)}</div><div className="kpi-foot">Preço padrão por serviço</div></div>
    </div>
    <Panel title="Todos os serviços">
      {rows.length?<TableWrap><thead><tr><th>SERVIÇO</th><th>DURAÇÃO</th><th>PREÇO</th><th>MOEDAS</th><th>STATUS</th><th></th></tr></thead>
        <tbody>{rows.map(s=><tr key={s.id}><td><strong>{s.name}</strong><div className="small-note">{s.description||'—'}</div></td>
          <td>{s.duration_minutes?`${s.duration_minutes} min`:'—'}</td><td><strong>{money(s.price_cents)}</strong></td>
          <td><span className="coin-count">{s.coins}</span></td><td><Status status={s.active?'Ativo':'Inativo'}/></td>
          <td className="actions-cell"><Button size="small" variant="ghost" onClick={()=>open(s)}><Pencil size={14}/> Editar</Button>
            <Button size="small" variant="ghost" onClick={()=>void toggle(s)}>{s.active?'Desativar':'Ativar'}</Button></td></tr>)}</tbody>
      </TableWrap>:<Empty title="Catálogo vazio" description="Cadastre o primeiro serviço para gerar orçamentos e agendamentos." action={<Button size="small" onClick={()=>open()}><Plus size={14}/> Adicionar</Button>}/>}
    </Panel>
    {modal&&<Modal title={editing?'Editar serviço':'Novo serviço'} onClose={()=>setModal(false)}>
      <form onSubmit={submit}>
        <Field label="Nome do serviço"><Input required value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Polimento técnico"/></Field>
        <Field label="Descrição"><Textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} placeholder="O que está incluso no serviço"/></Field>
        <div className="form-grid">
          <Field label="Preço padrão (R$)"><Input required inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder="150,00"/></Field>
          <Field label="Duração (minutos)"><Input type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="90"/></Field>
          <Field label="Moedas de fidelidade"><Input type="number" min="0" step="1" value={coins} onChange={e=>setCoins(e.target.value)}/></Field>
          <Field label="Disponibilidade"><select className="form-input" value={active?'yes':'no'} onChange={e=>setActive(e.target.value==='yes')}><option value="yes">Ativo</option><option value="no">Inativo</option></select></Field>
        </div>
        <ErrorText message={error}/>
        <div className="form-actions"><Button type="button" variant="secondary" onClick={()=>setModal(false)}>Cancelar</Button><Button disabled={saving} type="submit">{saving?'Salvando...':'Salvar serviço'}</Button></div>
      </form>
    </Modal>}
  </>
}
