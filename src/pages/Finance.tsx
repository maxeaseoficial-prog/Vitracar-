import { useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, Banknote, CircleDollarSign, Plus, ReceiptText } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Button, Empty, ErrorText, Field, Input, PageHeading, Panel, Select, TableWrap, Textarea } from '../components/UI'
import { useStore } from '../lib/store'
import { centsToPrice, date, dateTime, isoToday, money, paymentLabel, priceToCents, sum } from '../lib/utils'
import type { PaymentMethod } from '../types'

const methods:PaymentMethod[]=['pix','cash','credit_card','debit_card','other']
export function Finance(){
  const {data,save,recordPayment}=useStore()
  const [tab,setTab]=useState<'received'|'expenses'|'pending'>('received')
  const [modal,setModal]=useState<'expense'|'payment'|null>(null)
  const [description,setDescription]=useState(''),[category,setCategory]=useState('Produtos')
  const [amount,setAmount]=useState(''),[occurred,setOccurred]=useState(isoToday())
  const [method,setMethod]=useState<PaymentMethod>('pix'),[supplier,setSupplier]=useState(''),[notes,setNotes]=useState('')
  const [orderId,setOrderId]=useState(''),[error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false)
  const sold=sum(data.service_orders.filter(o=>o.status==='completed').map(o=>o.total_cents))
  const received=sum(data.payments.map(p=>p.amount_cents))
  const expenses=sum(data.expenses.map(e=>e.amount_cents))
  const pending=data.service_orders.filter(o=>o.status==='completed').map(o=>({
    order:o,paid:sum(data.payments.filter(p=>p.order_id===o.id).map(p=>p.amount_cents))
  })).filter(x=>x.order.total_cents>x.paid)
  const receivable=sum(pending.map(p=>p.order.total_cents-p.paid))
  const chosen=pending.find(p=>p.order.id===orderId)
  function openExpense(){
    setDescription('');setCategory('Produtos');setAmount('');setOccurred(isoToday())
    setMethod('pix');setSupplier('');setNotes('');setError(null);setModal('expense')
  }
  function openPayment(id?:string){
    const available=pending.find(p=>p.order.id===id)||pending[0]
    setOrderId(available?.order.id||'');setAmount(available?centsToPrice(available.order.total_cents-available.paid):'')
    setMethod('pix');setError(null);setModal('payment')
  }
  async function submit(e:FormEvent){
    e.preventDefault();setSaving(true);setError(null)
    try{
      const cents=priceToCents(amount)
      if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('Informe um valor positivo e válido.')
      if(modal==='expense'){
        if(!description.trim())throw new Error('Descreva a despesa.')
        await save('expenses',{description:description.trim(),category,amount_cents:cents,
          occurred_on:occurred,method,supplier:supplier||null,notes:notes||null})
        setTab('expenses')
      }else if(modal==='payment'){
        if(!orderId)throw new Error('Selecione o serviço a receber.')
        await recordPayment(orderId,cents,method)
        setTab('received')
      }
      setModal(null)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSaving(false)}
  }
  const payments=[...data.payments].sort((a,b)=>b.paid_at.localeCompare(a.paid_at))
  const expensesRows=[...data.expenses].sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on))
  const metrics=[
    {label:'Total vendido',value:sold,tone:'',icon:CircleDollarSign,foot:'Serviços concluídos'},
    {label:'Total recebido',value:received,tone:'green',icon:ArrowDownLeft,foot:'Pagamentos registrados'},
    {label:'A receber',value:receivable,tone:'dark',icon:Banknote,foot:'Saldo de serviços pendentes'},
    {label:'Despesas',value:expenses,tone:'red',icon:ArrowUpRight,foot:'Saídas registradas'}
  ]
  return <>
    <PageHeading eyebrow="GESTÃO FINANCEIRA" title="Financeiro" subtitle="Vendas, recebimentos e despesas sem misturar conceitos."
      actions={<><Button variant="secondary" onClick={openExpense}><Plus size={15}/> Nova despesa</Button>
        <Button onClick={()=>openPayment()} disabled={!pending.length}><Plus size={15}/> Registrar recebimento</Button></>}/>
    <div className="kpi-grid">{metrics.map(m=><div className="kpi-card" key={m.label}>
      <div className="kpi-head"><span className="kpi-label">{m.label}</span><span className={`kpi-icon ${m.tone}`}><m.icon size={18}/></span></div>
      <div className="kpi-value">{money(m.value)}</div><div className="kpi-foot">{m.foot}</div>
    </div>)}</div>
    <div className="dashboard-grid dashboard-grid-secondary">
      <Panel title="Resultado financeiro estimado"><div style={{fontSize:30,fontWeight:850,letterSpacing:-1,margin:'5px 0'}}>{money(received-expenses)}</div>
        <p className="small-note" style={{marginBottom:20}}>Valor recebido menos despesas lançadas. Não representa lucro contábil.</p>
        <div className="detail-line"><span>Recebimentos</span><strong className="price-positive">{money(received)}</strong></div>
        <div className="detail-line"><span>Despesas</span><strong className="price-negative">{money(expenses)}</strong></div>
      </Panel>
      <Panel title="Situação dos pagamentos"><div className="mini-stats-grid">
        <div className="mini-stat"><small>Pagamentos</small><strong>{payments.length}</strong></div>
        <div className="mini-stat"><small>Pendentes</small><strong>{pending.length}</strong></div>
        <div className="mini-stat"><small>Despesas</small><strong>{expensesRows.length}</strong></div>
      </div><p className="small-note" style={{marginTop:18}}>Um orçamento emitido não conta como venda; somente ordens concluídas entram no faturamento.</p></Panel>
    </div>
    <Panel title="Movimentações" action={<div className="period-tabs">
      <button className={`period-tab ${tab==='received'?'active':''}`} onClick={()=>setTab('received')}>Recebimentos</button>
      <button className={`period-tab ${tab==='expenses'?'active':''}`} onClick={()=>setTab('expenses')}>Despesas</button>
      <button className={`period-tab ${tab==='pending'?'active':''}`} onClick={()=>setTab('pending')}>A receber</button>
    </div>}>
      {tab==='received'&&(payments.length?<TableWrap><thead><tr><th>CLIENTE / SERVIÇO</th><th>DATA</th><th>FORMA</th><th>VALOR</th></tr></thead>
        <tbody>{payments.map(p=>{
          const o=data.service_orders.find(o=>o.id===p.order_id)
          const c=data.clients.find(c=>c.id===o?.client_id)
          return <tr key={p.id}><td><strong>{c?.name||'—'}</strong><div className="small-note">
            {data.service_order_items.filter(i=>i.order_id===o?.id).map(i=>i.description).join(', ')||'Serviço concluído'}</div></td>
            <td>{dateTime(p.paid_at)}</td><td>{paymentLabel[p.method]}</td><td><strong className="price-positive">{money(p.amount_cents)}</strong></td></tr>
        })}</tbody></TableWrap>:<Empty title="Nenhum pagamento registrado"/>)}
      {tab==='expenses'&&(expensesRows.length?<TableWrap><thead><tr><th>DESCRIÇÃO</th><th>CATEGORIA</th><th>DATA</th><th>FORMA</th><th>VALOR</th></tr></thead>
        <tbody>{expensesRows.map(x=><tr key={x.id}><td><strong>{x.description}</strong><div className="small-note">{x.supplier||'Sem fornecedor'}</div></td>
          <td>{x.category}</td><td>{date(x.occurred_on)}</td><td>{x.method?paymentLabel[x.method]:'—'}</td>
          <td className="price-negative"><strong>{money(x.amount_cents)}</strong></td></tr>)}</tbody>
      </TableWrap>:<Empty title="Nenhuma despesa cadastrada" action={<Button size="small" onClick={openExpense}><Plus size={14}/> Cadastrar despesa</Button>}/>)}
      {tab==='pending'&&(pending.length?<TableWrap><thead><tr><th>CLIENTE / VEÍCULO</th><th>VALOR DO SERVIÇO</th><th>RECEBIDO</th><th>RESTANTE</th><th></th></tr></thead>
        <tbody>{pending.map(({order,paid})=>{
          const c=data.clients.find(c=>c.id===order.client_id),v=data.vehicles.find(v=>v.id===order.vehicle_id)
          return <tr key={order.id}><td><strong>{c?.name||'—'}</strong><div className="small-note">{v?.brand} {v?.model}</div></td>
            <td>{money(order.total_cents)}</td><td>{money(paid)}</td><td><strong>{money(order.total_cents-paid)}</strong></td>
            <td className="actions-cell"><Button size="small" onClick={()=>openPayment(order.id)}>Receber</Button></td></tr>
        })}</tbody></TableWrap>:<Empty title="Sem valores pendentes" description="Todos os serviços concluídos estão quitados." />)}
    </Panel>
    {modal&&<Modal title={modal==='expense'?'Registrar despesa':'Registrar recebimento'} onClose={()=>setModal(null)}>
      <form onSubmit={submit}>
        {modal==='expense'?<>
          <Field label="Descrição"><Input required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: Shampoo automotivo"/></Field>
          <div className="form-grid">
            <Field label="Categoria"><Select value={category} onChange={e=>setCategory(e.target.value)}>
              <option>Produtos</option><option>Materiais</option><option>Equipamentos</option><option>Operacional</option><option>Outros</option>
            </Select></Field>
            <Field label="Data"><Input required type="date" value={occurred} onChange={e=>setOccurred(e.target.value)}/></Field>
          </div>
          <Field label="Fornecedor (opcional)"><Input value={supplier} onChange={e=>setSupplier(e.target.value)}/></Field>
          <Field label="Observações"><Textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
        </>:<Field label="Serviço concluído"><Select required value={orderId} onChange={e=>{
          const candidate=pending.find(p=>p.order.id===e.target.value)
          setOrderId(e.target.value);setAmount(candidate?centsToPrice(candidate.order.total_cents-candidate.paid):'')
        }}><option value="">Selecione a ordem</option>{pending.map(({order,paid})=>{
          const c=data.clients.find(c=>c.id===order.client_id)
          return <option key={order.id} value={order.id}>{c?.name||'Cliente'} · {money(order.total_cents-paid)} pendente</option>
        })}</Select></Field>}
        <div className="form-grid">
          <Field label="Valor (R$)"><Input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="150,00"/></Field>
          <Field label="Forma de pagamento"><Select value={method} onChange={e=>setMethod(e.target.value as PaymentMethod)}>
            {methods.map(m=><option key={m} value={m}>{paymentLabel[m]}</option>)}
          </Select></Field>
        </div>
        {chosen&&modal==='payment'&&<p className="small-note">Saldo máximo permitido: {money(chosen.order.total_cents-chosen.paid)}. As moedas serão creditadas após a quitação integral.</p>}
        <ErrorText message={error}/>
        <div className="form-actions"><Button type="button" variant="secondary" onClick={()=>setModal(null)}>Cancelar</Button>
          <Button type="submit" disabled={saving}><ReceiptText size={15}/>{saving?'Salvando...':'Registrar'}</Button></div>
      </form>
    </Modal>}
  </>
}
