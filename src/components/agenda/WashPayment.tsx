import { useState, type FormEvent } from 'react'
import { Banknote, CreditCard, Landmark, WalletCards } from 'lucide-react'
import { Modal } from '../Modal'
import { Button, ErrorText, Field, Input } from '../UI'
import type { PaymentMethod } from '../../types'
import type { WashJob } from '../../lib/wash-flow'
import { centsToPrice, money, priceToCents } from '../../lib/utils'
import { readableError } from '../../lib/commerce'
const methods:{value:PaymentMethod;label:string;Icon:typeof Banknote}[]=[{value:'pix',label:'Pix',Icon:Landmark},{value:'cash',label:'Dinheiro',Icon:Banknote},{value:'credit_card',label:'Crédito',Icon:CreditCard},{value:'debit_card',label:'Débito',Icon:CreditCard},{value:'other',label:'Outro',Icon:WalletCards}]
export function WashPayment({job,onClose,onPay}:{job:WashJob;onClose:()=>void;onPay:(amount:number,method:PaymentMethod)=>Promise<void>}){
  const [amount,setAmount]=useState(centsToPrice(job.balance)),[method,setMethod]=useState<PaymentMethod>('pix')
  const [error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false)
  const cents=priceToCents(amount)
  async function submit(event:FormEvent){event.preventDefault();if(saving)return;setError(null);try{if(!Number.isSafeInteger(cents)||cents<0||cents>job.balance||(job.balance>0&&cents===0))throw new Error('Informe um valor válido, até o saldo pendente.');setSaving(true);await onPay(cents,method);onClose()}catch(cause){setError(readableError(cause))}finally{setSaving(false)}}
  return <Modal title={job.balance?'Registrar pagamento':'Encerrar atendimento'} onClose={()=>{if(!saving)onClose()}} className="wash-payment-modal"><form onSubmit={submit} className="wash-payment-form"><div className="wash-payment-car"><WalletCards size={28}/><div><strong>{job.vehicle?.brand} {job.vehicle?.model}</strong><span>{job.vehicle?.plate} · {job.client?.name}</span></div></div>
    <div className="wash-payment-totals"><div><span>Total</span><b>{money(job.total)}</b></div><div><span>Já recebido</span><b>{money(job.received)}</b></div><div><span>Saldo pendente</span><strong>{money(job.balance)}</strong></div></div>
    {job.balance>0&&<><Field label="Valor recebido (R$)"><Input autoFocus inputMode="decimal" required value={amount} onChange={e=>setAmount(e.target.value)} disabled={saving}/></Field><div className="wash-methods" role="group" aria-label="Forma de pagamento">{methods.map(({value,label,Icon})=><button type="button" key={value} aria-pressed={method===value} className={method===value?'active':''} disabled={saving} onClick={()=>setMethod(value)}><Icon size={19}/>{label}</button>)}</div></>}
    <p className="wash-note">{job.balance===0?'Não será criado outro pagamento: o atendimento já está quitado ou não tem cobrança.':cents<job.balance?'Recebimento parcial: o saldo continuará pendente. O card só vai para Pago quando houver quitação.':'Ao confirmar, o recebimento será registrado no Financeiro e o card irá para Pago.'} Este registro não faz cobrança automática.</p><ErrorText message={error}/><div className="form-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Registrando...':job.balance?'Confirmar recebimento':'Mover para Pago'}</Button></div></form></Modal>
}
