import { useMemo, useState, type FormEvent } from 'react'
import { Award, Coins, Crown, Gift, Plus, Trophy } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Avatar, Button, CoinCount, Empty, ErrorText, Field, Input, PageHeading, Panel, Select, TableWrap, Textarea } from '../components/UI'
import { useStore } from '../lib/store'
import { dateTime, number, sum } from '../lib/utils'
import type { LoyaltyReward } from '../types'

export function Loyalty(){
  const {data,save,redeem}=useStore()
  const [period,setPeriod]=useState<'all'|'month'>('all')
  const [rewardOpen,setRewardOpen]=useState(false),[editing,setEditing]=useState<LoyaltyReward|null>(null)
  const [name,setName]=useState(''),[description,setDescription]=useState(''),[cost,setCost]=useState('500')
  const [redeemOpen,setRedeemOpen]=useState(false),[clientId,setClientId]=useState(''),[rewardId,setRewardId]=useState('')
  const [error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false)
  const [pageError,setPageError]=useState<string|null>(null)
  const ranked=useMemo(()=>{
    const now=new Date()
    return data.clients.filter(c=>!c.archived_at).map(client=>{
      const ledger=data.loyalty_ledger.filter(l=>l.client_id===client.id)
      const earned=sum(ledger.filter(l=>l.change>0&&(period==='all'||(
        new Date(l.created_at).getMonth()===now.getMonth()&&new Date(l.created_at).getFullYear()===now.getFullYear()
      ))).map(l=>l.change))
      const balance=sum(ledger.map(l=>l.change))
      return {client,earned,balance}
    }).sort((a,b)=>b.earned-a.earned)
  },[data.clients,data.loyalty_ledger,period])
  const rewards=[...data.loyalty_rewards].sort((a,b)=>a.cost-b.cost)
  const totalDistributed=sum(data.loyalty_ledger.filter(l=>l.kind==='earn').map(l=>l.change))
  const totalRedeemed=-sum(data.loyalty_ledger.filter(l=>l.kind==='redeem').map(l=>l.change))
  const chosen=ranked.find(r=>r.client.id===clientId)
  const selectedReward=rewards.find(r=>r.id===rewardId)
  function openReward(reward?:LoyaltyReward){
    setEditing(reward||null);setName(reward?.name||'');setDescription(reward?.description||'')
    setCost(String(reward?.cost||500));setError(null);setRewardOpen(true)
  }
  function openRedeem(){
    setClientId('');setRewardId('');setError(null);setRedeemOpen(true)
  }
  async function saveReward(e:FormEvent){
    e.preventDefault();setSaving(true);setError(null)
    try{
      const points=Number(cost)
      if(!name.trim()||!Number.isSafeInteger(points)||points<=0)throw new Error('Confira nome e quantidade de moedas.')
      await save('loyalty_rewards',{name:name.trim(),description:description||null,cost:points,active:editing?.active??true},editing?.id)
      setRewardOpen(false)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSaving(false)}
  }
  async function submitRedeem(e:FormEvent){
    e.preventDefault();setSaving(true);setError(null)
    try{
      if(!clientId||!rewardId)throw new Error('Selecione cliente e recompensa.')
      await redeem(clientId,rewardId)
      setRedeemOpen(false)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSaving(false)}
  }
  async function toggle(r:LoyaltyReward){
    setPageError(null)
    try{await save('loyalty_rewards',{active:!r.active},r.id)}
    catch(e){setPageError(e instanceof Error?e.message:String(e))}
  }
  const spotlight=[ranked[1],ranked[0],ranked[2]]
  return <>
    <PageHeading eyebrow="RELACIONAMENTO" title="Moedas VitraCar" subtitle="Incentive a recorrência com recompensas e conquistas reais."
      actions={<><Button variant="secondary" onClick={()=>openReward()}><Plus size={15}/> Nova recompensa</Button>
        <Button onClick={openRedeem}><Gift size={15}/> Resgatar moedas</Button></>}/>
    <ErrorText message={pageError}/>
    <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
      <div className="kpi-card"><div className="kpi-head"><span className="kpi-label">Moedas distribuídas</span><span className="kpi-icon"><Coins size={18}/></span></div>
        <div className="kpi-value">{number(totalDistributed)}</div><div className="kpi-foot">Créditos por serviços quitados</div></div>
      <div className="kpi-card"><div className="kpi-head"><span className="kpi-label">Moedas resgatadas</span><span className="kpi-icon dark"><Gift size={18}/></span></div>
        <div className="kpi-value">{number(totalRedeemed)}</div><div className="kpi-foot">Utilizadas em recompensas</div></div>
      <div className="kpi-card"><div className="kpi-head"><span className="kpi-label">Clientes participantes</span><span className="kpi-icon green"><Award size={18}/></span></div>
        <div className="kpi-value">{data.clients.filter(c=>!c.archived_at&&data.loyalty_ledger.some(l=>l.client_id===c.id)).length}</div><div className="kpi-foot">Com movimentação no programa</div></div>
    </div>
    <div className="dashboard-grid dashboard-grid-secondary">
      <Panel title="Ranking de clientes" action={<div className="period-tabs">
        <button className={`period-tab ${period==='all'?'active':''}`} onClick={()=>setPeriod('all')}>Geral</button>
        <button className={`period-tab ${period==='month'?'active':''}`} onClick={()=>setPeriod('month')}>Mensal</button>
      </div>}>
        {ranked.length?<><div className="rank-podium">
          {spotlight.map((row,index)=>row?<div className={`podium-card ${index===1?'first':''}`} key={row.client.id}>
            {index===1?<Crown size={24} color="#e3a937" style={{margin:'0 auto 9px'}}/>:
              <Trophy size={20} color={index===0?'#9481c2':'#df915a'} style={{margin:'0 auto 9px'}}/>}
            <Avatar client={row.client} size="medium"/><strong>{row.client.name}</strong>
            <CoinCount value={row.earned}/><small>moedas conquistadas</small>
          </div>:<div key={index} className="podium-card"/>)}
        </div><div>
          {ranked.slice(3,12).map((r,i)=><div className="rank-row" key={r.client.id}>
            <span className="rank-place">{i+4}º</span><Avatar client={r.client} size="tiny"/>
            <span className="rank-name">{r.client.name}</span><span className="rank-amount"><CoinCount value={r.earned}/></span></div>)}
        </div></>:<Empty title="Nenhum cliente participa do programa"/>}
      </Panel>
      <Panel title="Catálogo de recompensas" action={<Button variant="ghost" size="small" onClick={()=>openReward()}><Plus size={14}/> Adicionar</Button>}>
        {rewards.length?rewards.map(r=><div className="reward-card" key={r.id} style={{marginBottom:10,opacity:r.active?1:.55}}>
          <div className="reward-icon"><Gift size={21}/></div><div style={{minWidth:0,flex:1}}>
            <strong>{r.name}</strong><small>{number(r.cost)} moedas · {r.active?'Disponível':'Desativada'}</small></div>
          <div style={{display:'flex',gap:4}}><Button variant="ghost" size="small" onClick={()=>openReward(r)}>Editar</Button>
            <Button variant="ghost" size="small" onClick={()=>void toggle(r)}>{r.active?'Pausar':'Ativar'}</Button></div>
        </div>):<Empty title="Cadastre a primeira recompensa" description="Ofereça serviços gratuitos em troca de moedas."/>}
      </Panel>
    </div>
    <Panel title="Extrato de moedas" action={<span className="tag">{data.loyalty_ledger.length} movimentações</span>}>
      {data.loyalty_ledger.length?<TableWrap><thead><tr><th>CLIENTE</th><th>DESCRIÇÃO</th><th>DATA</th><th>MOVIMENTAÇÃO</th></tr></thead>
        <tbody>{[...data.loyalty_ledger].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(l=>{
          const c=data.clients.find(c=>c.id===l.client_id)
          return <tr key={l.id}><td><strong>{c?.name||'—'}</strong></td><td>{l.description}</td><td>{dateTime(l.created_at)}</td>
            <td><strong className={l.change>0?'price-positive':'price-negative'}>{l.change>0?'+':''}{number(l.change)}</strong></td></tr>
        })}</tbody></TableWrap>:<Empty title="Nenhuma moeda movimentada" description="O primeiro pagamento de serviço concluído criará o histórico."/>}
    </Panel>
    {rewardOpen&&<Modal title={editing?'Editar recompensa':'Nova recompensa'} onClose={()=>setRewardOpen(false)}>
      <form onSubmit={saveReward}>
        <Field label="Nome da recompensa"><Input required value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Lavagem gratuita"/></Field>
        <Field label="Custo em moedas"><Input required type="number" min="1" step="1" value={cost} onChange={e=>setCost(e.target.value)}/></Field>
        <Field label="Descrição"><Textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)}/></Field>
        <ErrorText message={error}/>
        <div className="form-actions"><Button variant="secondary" type="button" onClick={()=>setRewardOpen(false)}>Cancelar</Button>
          <Button disabled={saving} type="submit">{saving?'Salvando...':'Salvar recompensa'}</Button></div>
      </form>
    </Modal>}
    {redeemOpen&&<Modal title="Resgatar recompensa" onClose={()=>setRedeemOpen(false)}>
      <form onSubmit={submitRedeem}>
        <Field label="Cliente"><Select required value={clientId} onChange={e=>setClientId(e.target.value)}>
          <option value="">Selecione</option>{ranked.map(r=><option value={r.client.id} key={r.client.id}>{r.client.name}</option>)}
        </Select></Field>
        {chosen&&<div className="mini-stat"><small>Saldo disponível</small><strong><CoinCount value={chosen.balance}/></strong></div>}
        <Field label="Recompensa"><Select required value={rewardId} onChange={e=>setRewardId(e.target.value)}>
          <option value="">Selecione</option>{rewards.filter(r=>r.active).map(r=><option value={r.id} key={r.id}>{r.name} · {number(r.cost)} moedas</option>)}
        </Select></Field>
        {selectedReward&&chosen&&<div className="modal-summary">
          <span>Saldo após resgate</span><strong>{number(chosen.balance-selectedReward.cost)} moedas</strong></div>}
        {selectedReward&&chosen&&chosen.balance<selectedReward.cost&&<ErrorText message="Moedas insuficientes para esta recompensa."/>}
        <ErrorText message={error}/>
        <div className="form-actions"><Button variant="secondary" type="button" onClick={()=>setRedeemOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={saving||!selectedReward||!chosen||chosen.balance<selectedReward.cost}><Gift size={15}/> Confirmar resgate</Button></div>
      </form>
    </Modal>}
  </>
}

