import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, CarFront, FilePlus2, History, Pencil, Plus, UserRound, Wallet } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Avatar, Button, CoinCount, Empty, ErrorText, Field, Input, PageHeading, Panel, SearchInput, Select, Status, TableWrap, Textarea } from '../components/UI'
import { CarViewer } from '../components/CarViewer'
import { QuickCarViewer } from '../components/vehicle/QuickCarViewer'
import { categories } from '../lib/catalog'
import { VehicleStudioForm } from '../components/vehicle/VehicleStudioForm'
import { useStore } from '../lib/store'
import { date, dateTime, escapeSearch, formatQuoteNumber, formatPlate, money, number, sum } from '../lib/utils'
import type { Client } from '../types'

function ClientForm({client,onDone,onClose}:{client?:Client;onDone:()=>void;onClose:()=>void}){
  const {save,uploadClientPhoto,isDemo}=useStore()
  const [name,setName]=useState(client?.name||''),[whatsapp,setWhatsapp]=useState(client?.whatsapp||'')
  const [avatar,setAvatar]=useState(client?.avatar_kind||'male')
  const [notes,setNotes]=useState(client?.notes||''),[photo,setPhoto]=useState<File|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null)
  async function submit(e:FormEvent){
    e.preventDefault();setError(null);setBusy(true)
    try{
      if(name.trim().length<2)throw new Error('Informe o nome do cliente.')
      const row=await save('clients',{name:name.trim(),whatsapp:whatsapp||null,
        avatar_kind:avatar,notes:notes||null},client?.id)
      if(photo){
        const path=await uploadClientPhoto(String(row.id),photo)
        await save('clients',{photo_path:path},String(row.id))
      }
      onDone()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  return <form onSubmit={submit}>
    <div className="form-grid">
      <div className="span-2"><Field label="Nome completo"><Input required minLength={2} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome e sobrenome"/></Field></div>
      <Field label="WhatsApp"><Input type="tel" inputMode="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="(65) 99999-9999"/></Field>
      <Field label="Avatar padrão"><Select value={avatar} onChange={e=>setAvatar(e.target.value as 'male'|'female')}>
        <option value="male">Avatar masculino</option><option value="female">Avatar feminino</option>
      </Select></Field>
      <Field label="Foto (opcional)" hint={isDemo?'Upload disponível após conectar Supabase.':'PNG, JPG ou WEBP, até 5 MB.'}>
        <Input type="file" accept="image/png,image/jpeg,image/webp" disabled={isDemo} onChange={e=>setPhoto(e.target.files?.[0]||null)}/>
      </Field>
      <div className="span-2"><Field label="Observações"><Textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Preferências ou informações do cliente"/></Field></div>
    </div>
    <ErrorText message={error}/>
    <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button type="submit" disabled={busy}>{busy?'Salvando...':'Salvar cliente'}</Button></div>
  </form>
}
export function Clients(){
  const {data}=useStore(),navigate=useNavigate()
  const [search,setSearch]=useState(''),[modal,setModal]=useState(false),[editing,setEditing]=useState<Client|null>(null)
  const filtered=useMemo(()=>data.clients.filter(c=>{
    const plates=data.vehicles.filter(v=>v.client_id===c.id).map(v=>v.plate+' '+v.brand+' '+v.model).join(' ')
    return escapeSearch(`${c.name} ${c.whatsapp||''} ${plates}`).includes(escapeSearch(search))
  }).sort((a,b)=>a.name.localeCompare(b.name)),[data.clients,data.vehicles,search])
  function edit(client?:Client){setEditing(client||null);setModal(true)}
  return <>
    <PageHeading eyebrow="RELACIONAMENTO" title="Clientes e veículos"
      subtitle="Um cadastro completo para acompanhar cada cliente e todos os seus carros."
      actions={<Button onClick={()=>edit()}><Plus size={16}/> Novo cliente</Button>}/>
    <div className="filter-bar"><SearchInput value={search} onChange={setSearch} placeholder="Buscar nome, telefone ou placa..."/>
      <div className="filter-right"><span className="tag">{filtered.length} clientes</span><span className="tag">{data.vehicles.length} veículos</span></div></div>
    <Panel>
      {filtered.length?<TableWrap><thead><tr><th>CLIENTE</th><th>WHATSAPP</th><th>VEÍCULOS</th><th>MOEDAS</th><th>CADASTRADO</th><th></th></tr></thead>
        <tbody>{filtered.map(client=>{
          const cars=data.vehicles.filter(v=>v.client_id===client.id)
          const coins=sum(data.loyalty_ledger.filter(l=>l.client_id===client.id).map(l=>l.change))
          return <tr key={client.id}><td><div className="table-primary"><Avatar client={client} size="tiny"/><div>
            <strong>{client.name}</strong><small>{cars.map(v=>v.brand+' '+v.model).slice(0,2).join(', ')||'Sem veículos'}</small></div></div></td>
            <td>{client.whatsapp||'—'}</td><td><strong>{cars.length}</strong></td><td><CoinCount value={coins}/></td>
            <td>{date(client.created_at)}</td>
            <td className="actions-cell"><Button size="small" variant="ghost" onClick={()=>edit(client)}><Pencil size={14}/></Button>
              <Button size="small" variant="secondary" onClick={()=>navigate(`/clientes/${client.id}`)}>Ver perfil</Button></td></tr>
        })}</tbody>
      </TableWrap>:<Empty title={search?'Nenhum cliente encontrado':'Ainda não há clientes cadastrados'}
        description={search?'Experimente outro termo de busca.':'Comece cadastrando seu primeiro cliente.'}
        action={!search?<Button size="small" onClick={()=>edit()}><Plus size={14}/> Adicionar cliente</Button>:undefined}/>}
    </Panel>
    {modal&&<Modal title={editing?'Editar cliente':'Cadastrar cliente'} onClose={()=>setModal(false)} wide>
      <ClientForm client={editing||undefined} onDone={()=>setModal(false)} onClose={()=>setModal(false)}/>
    </Modal>}
  </>
}
export function ClientProfile(){
  const {id}=useParams(),{data}=useStore(),navigate=useNavigate()
  const [showClient,setShowClient]=useState(false),[vehicleModal,setVehicleModal]=useState(false)
  const client=data.clients.find(c=>c.id===id)
  if(!client)return <Empty title="Cliente não encontrado" action={<Button onClick={()=>navigate('/clientes')}>Voltar aos clientes</Button>}/>
  const cars=data.vehicles.filter(v=>v.client_id===client.id)
  const orders=data.service_orders.filter(o=>o.client_id===client.id).sort((a,b)=>(b.completed_at||'').localeCompare(a.completed_at||''))
  const ledger=data.loyalty_ledger.filter(l=>l.client_id===client.id)
  const balance=sum(ledger.map(l=>l.change))
  const quotes=data.quotes.filter(q=>q.client_id===client.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))
  return <>
    <PageHeading eyebrow="PERFIL DO CLIENTE" title={client.name} subtitle="Histórico, veículos e relacionamento em um só lugar."
      actions={<><Button variant="secondary" onClick={()=>navigate('/clientes')}><ArrowLeft size={15}/> Voltar</Button><Button onClick={()=>setVehicleModal(true)}><Plus size={16}/> Adicionar veículo</Button></>}/>
    <div className="dashboard-grid dashboard-grid-secondary">
      <Panel>
        <div className="profile-identity"><Avatar client={client} size="large"/><div><h2>{client.name}</h2>
          <p>{client.whatsapp||'WhatsApp não informado'}</p><p>Cliente desde {date(client.created_at)}</p></div>
          <button className="icon-button" style={{marginLeft:'auto'}} onClick={()=>setShowClient(true)} aria-label="Editar cliente"><Pencil size={17}/></button>
        </div>
        <div className="profile-summary">
          <div className="summary-tile"><small>Veículos</small><strong>{cars.length}</strong></div>
          <div className="summary-tile"><small>Atendimentos</small><strong>{orders.length}</strong></div>
          <div className="summary-tile"><small>Saldo de moedas</small><strong style={{color:'#b9832b'}}>{number(balance)}</strong></div>
        </div>
        {client.notes&&<p className="small-note" style={{marginTop:20}}>{client.notes}</p>}
      </Panel>
      <Panel title="Fidelidade"><div className="mini-stat"><small>Moedas acumuladas</small><strong>{number(sum(ledger.filter(l=>l.change>0).map(l=>l.change)))}</strong></div>
        <div className="detail-line"><span>Saldo disponível</span><strong><CoinCount value={balance}/></strong></div>
        <div className="detail-line"><span>Total resgatado</span><strong>{number(-sum(ledger.filter(l=>l.change<0).map(l=>l.change)))}</strong></div>
        <button className="text-action" style={{marginTop:15}} onClick={()=>navigate('/fidelidade')}>Abrir fidelidade</button>
      </Panel>
    </div>
    <Panel title="Veículos do cliente" action={<Button size="small" variant="secondary" onClick={()=>setVehicleModal(true)}><Plus size={14}/> Adicionar</Button>}>
      {cars.length?<div className="form-grid">{cars.map(v=><div className="vehicle-card" key={v.id} onClick={()=>navigate(`/veiculos/${v.id}`)} role="link" tabIndex={0}
        onKeyDown={e=>{if(e.key==='Enter')navigate(`/veiculos/${v.id}`)}}>
        <div className="vehicle-icon"><CarFront size={28}/></div><div><strong>{v.brand} {v.model}</strong>
          <small>{formatPlate(v.plate)} · {v.color}</small></div><span style={{marginLeft:'auto',color:'#97aabc'}}>›</span>
      </div>)}</div>:<Empty title="Nenhum veículo cadastrado" action={<Button size="small" onClick={()=>setVehicleModal(true)}><Plus size={14}/> Cadastrar veículo</Button>}/>}
    </Panel>
    <div className="dashboard-grid" style={{marginTop:19}}>
      <Panel title="Histórico de atendimentos">
        {orders.length?orders.map(o=>{
          const v=data.vehicles.find(v=>v.id===o.vehicle_id)
          return <div key={o.id} className="list-item-row"><div className="list-icon"><History size={17}/></div>
            <div><div className="list-item-title">{v?.brand} {v?.model}</div><div className="list-item-subtitle">{dateTime(o.completed_at)}</div></div>
            <div className="list-item-right list-item-value">{money(o.total_cents)}</div></div>
        }):<Empty title="Nenhum atendimento concluído"/>}
      </Panel>
      <Panel title="Orçamentos anteriores">
        {quotes.length?quotes.map(q=><div key={q.id} className="list-item-row">
          <div className="list-icon"><FilePlus2 size={17}/></div>
          <div><div className="list-item-title">Orçamento {formatQuoteNumber(q.quote_number)}</div><div className="list-item-subtitle">{date(q.created_at)}</div></div>
          <div className="list-item-right"><Status status={q.status}/></div></div>):<Empty title="Nenhum orçamento registrado"/>}
      </Panel>
    </div>
    {showClient&&<Modal title="Editar cliente" wide onClose={()=>setShowClient(false)}><ClientForm client={client}
      onDone={()=>setShowClient(false)} onClose={()=>setShowClient(false)}/></Modal>}
    {vehicleModal&&<Modal title="Adicionar veículo" showroom onClose={()=>setVehicleModal(false)}><VehicleStudioForm clientId={client.id}
      onDone={()=>setVehicleModal(false)} onClose={()=>setVehicleModal(false)}/></Modal>}
  </>
}
export function VehicleDetail(){
  const {id}=useParams(),{data}=useStore(),navigate=useNavigate()
  const [editing,setEditing]=useState(false)
  const v=data.vehicles.find(x=>x.id===id)
  const [viewMode,setViewMode]=useState<'quick'|'original'>(v?.model_3d_id?'original':'quick')
  if(!v)return <Empty title="Veículo não encontrado" action={<Button onClick={()=>navigate('/clientes')}>Voltar</Button>}/>
  const client=data.clients.find(c=>c.id===v.client_id)
  const orders=data.service_orders.filter(o=>o.vehicle_id===v.id&&o.status==='completed')
    .sort((a,b)=>(b.completed_at||'').localeCompare(a.completed_at||''))
  const last=orders[0]
  const info=[
    ['Proprietário',client?.name||'—'],['Placa',formatPlate(v.plate)],['Marca',v.brand],
    ['Modelo',v.model],['Ano',v.year?.toString()||'—'],['Cor',v.color==='Original'?'Original do modelo':v.color],
    ['Categoria',categories[v.category||'']||v.category||'—'],['Estofado',v.upholstery||'—'],
    ['Último serviço',last?date(last.completed_at):'Nenhum']
  ]
  return <>
    <PageHeading eyebrow="GARAGEM DIGITAL" title={`${v.brand} ${v.model}`}
      subtitle={`${formatPlate(v.plate)} · ${client?.name||'Cliente'}`}
      actions={<><Button variant="secondary" onClick={()=>navigate(`/clientes/${v.client_id}`)}><ArrowLeft size={15}/> Perfil</Button>
        <Button variant="secondary" onClick={()=>setEditing(true)}><Pencil size={15}/> Editar</Button></>}/>
    <div className="vehicle-detail-grid">
      <div>
        <div className="v-mode-switch v-detail-mode" role="group" aria-label="Modo de visualização">
          <button type="button" className={viewMode==='quick'?'active':''} aria-pressed={viewMode==='quick'}
            onClick={()=>setViewMode('quick')}>3D simplificado</button>
          <button type="button" className={viewMode==='original'?'active':''} aria-pressed={viewMode==='original'}
            disabled={!v.model_3d_id} onClick={()=>setViewMode('original')}>Modelo real</button>
        </div>
        {viewMode==='original'&&v.model_3d_id?
          <CarViewer modelId={v.model_3d_id} color={v.color} plate={v.plate}/>:
          <QuickCarViewer category={v.category||'sedan'} color={v.color} plate={v.plate} variant="standard"/>}
      </div>
      <Panel title="Ficha do veículo">
        {info.map(([label,value])=><div className="detail-line" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        <div className="detail-cta">
          <Button onClick={()=>navigate(`/orcamentos?client=${v.client_id}&vehicle=${v.id}`)}><FilePlus2 size={15}/> Orçamento</Button>
          <Button variant="secondary" onClick={()=>navigate(`/agenda?client=${v.client_id}&vehicle=${v.id}`)}><CalendarPlus size={15}/> Agendar</Button>
        </div>
      </Panel>
    </div>
    <Panel title="Histórico de serviços realizados" action={<span className="tag">{orders.length} registros</span>}>
      {orders.length?<TableWrap><thead><tr><th>DATA</th><th>SERVIÇOS</th><th>VALOR</th><th>STATUS</th></tr></thead>
        <tbody>{orders.map(o=><tr key={o.id}>
          <td>{dateTime(o.completed_at)}</td>
          <td><strong>{data.service_order_items.filter(i=>i.order_id===o.id).map(i=>i.description).join(', ')||'Serviço realizado'}</strong></td>
          <td>{money(o.total_cents)}</td><td><Status status={o.status}/></td></tr>)}</tbody>
      </TableWrap>:<Empty title="Sem histórico de serviços" description="Os atendimentos concluídos aparecerão aqui."/>}
    </Panel>
    {v.notes&&<Panel title="Observações" className="settings-section"><p className="small-note">{v.notes}</p></Panel>}
    {editing&&<Modal title="Editar veículo" showroom onClose={()=>setEditing(false)}><VehicleStudioForm clientId={v.client_id} vehicle={v}
      onDone={()=>setEditing(false)} onClose={()=>setEditing(false)}/></Modal>}
  </>
}
