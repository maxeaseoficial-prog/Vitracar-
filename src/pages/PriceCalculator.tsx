import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Check, CheckCircle2, ChevronRight, Download, Droplets, Fuel, MapPin, Plus, RotateCcw, Save, Sparkles, Store, Trash2, Users, Wrench } from 'lucide-react'
import { AttentionNotice, Button, ErrorText, Field, Input, Select, Textarea } from '../components/UI'
import { Modal } from '../components/Modal'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { readableError } from '../lib/commerce'
import { centsToPrice, money, uuid } from '../lib/utils'
import { calculatePricing, emptyPricing, parseAmount, priceOutcome, pricingRoute, type EquipmentCost, type OperationCost, type PricingDraft, type ProductCost, type ProductUnit } from '../lib/service-pricing'
import './price-calculator.css'
import { PricingProducts } from '../components/inventory/PricingProducts'

type NumericProps={label:string;value:string;onChange:(v:string)=>void;hint?:string;placeholder?:string}
function NumberField({label,value,onChange,hint,placeholder='0'}:NumericProps){return <Field label={label} hint={hint}><Input aria-label={label} inputMode="decimal" autoComplete="off" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></Field>}
function Section({step,title,subtitle,children}:{step:string;title:string;subtitle:string;children:ReactNode}){return <section className="pc-section"><header><span>{step}</span><div><h2>{title}</h2><p>{subtitle}</p></div></header>{children}</section>}
const presets=['Shampoo automotivo','APC / limpador multiuso','Desengraxante','Limpa-vidros','Pretinho / renovador de pneus','Cera','Selante','Higienizador de estofados','Removedor de ferro','Outro produto']
const baseUnit=(unit:ProductUnit)=>unit==='l'||unit==='ml'?'ml':unit==='kg'||unit==='g'?'g':'un'
type Confirmation={kind:'create'|'apply';price:number;id:string;oldPrice?:number;name:string;duration:number;description:string}
export function PriceCalculator(){
  const {data,company,save,refresh,isDemo}=useStore()
  const [draft,setDraft]=useState<PricingDraft>(()=>{const d=emptyPricing();d.trip.origin=company.address||'';return d})
  const [calculated,setCalculated]=useState(false),[attempted,setAttempted]=useState(false),[override,setOverride]=useState('')
  const [notice,setNotice]=useState(''),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false)
  const [target,setTarget]=useState(''),[filter,setFilter]=useState(''),[confirm,setConfirm]=useState<Confirmation|null>(null)
  const [resetOpen,setResetOpen]=useState(false),[acceptLoss,setAcceptLoss]=useState(false),[coins,setCoins]=useState('0')
  const [createdId,setCreatedId]=useState<string|null>(null)
  const operation=useRef(false)
  const result=useMemo(()=>calculatePricing(draft),[draft])
  const custom=override.trim()?parseAmount(override):null
  const finalCents=custom===null?result.suggestedCents:Math.round(custom*100)
  const priceValid=Number.isSafeInteger(finalCents)&&finalCents>0&&finalCents<=1000000000
  const outcome=priceOutcome(result,priceValid?finalCents:0)
  const ready=calculated&&result.valid&&priceValid
  const op=draft[draft.mode],external=draft.mode==='customer'
  const route=pricingRoute(draft.trip.origin,draft.trip.destination)
  const chosen=data.services.find(s=>s.id===target)
  const services=data.services.filter(s=>s.name.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR'))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
  function changed(){setCalculated(false);setNotice('');setError(null);setAcceptLoss(false);setCreatedId(null)}
  function patch<K extends keyof PricingDraft>(key:K,value:PricingDraft[K]){setDraft(d=>({...d,[key]:value}));changed()}
  function operationPatch(key:keyof OperationCost,value:string|boolean){setDraft(d=>({...d,[d.mode]:{...d[d.mode],[key]:value}}));changed()}
  function tripPatch(key:keyof PricingDraft['trip'],value:string|boolean){setDraft(d=>({...d,trip:{...d.trip,[key]:value}}));changed()}
  function productPatch(id:string,part:Partial<ProductCost>){patch('products',draft.products.map(p=>p.id===id?{...p,...part}:p))}
  function equipmentPatch(id:string,part:Partial<EquipmentCost>){patch('equipment',draft.equipment.map(e=>e.id===id?{...e,...part}:e))}
  function addProduct(name=''){patch('products',[...draft.products,{id:uuid(),name:name==='Outro produto'?'':name,unit:'l',pack:'',price:'',use:'',diluted:false,waterParts:''}])}
  function numeric(key:'duration'|'setup'|'people'|'hourly'|'waste'|'consumables'|'laundry'|'other'|'tax'|'fee'|'commission'|'fixedFee'|'margin'|'reserve',label:string,hint?:string){return <NumberField label={label} hint={hint} value={draft[key]} onChange={v=>patch(key,v)}/>}
  function operating(key:'water'|'waterRate'|'powerRate'|'rent'|'admin'|'other'|'hours',label:string,hint?:string){return <NumberField label={label} hint={hint} value={op[key]} onChange={v=>operationPatch(key,v)}/>}
  function travel(key:'km'|'efficiency'|'fuel'|'minutes'|'wear'|'tolls'|'parking',label:string,hint?:string){return <NumberField label={label} hint={hint} value={draft.trip[key]} onChange={v=>tripPatch(key,v)}/>}
  function calculate(){setAttempted(true);setError(null);setNotice('');setCalculated(result.valid);setOverride('');setAcceptLoss(false);if(result.valid)window.setTimeout(()=>document.getElementById('pc-result')?.scrollIntoView({behavior:'smooth',block:'start'}),50)}
  function prepare(kind:'create'|'apply'){
    setError(null)
    if(!ready){setAttempted(true);setError('Calcule novamente e confira o preço antes de salvar.');return}
    if(kind==='apply'&&!chosen){setError('Selecione o serviço que receberá o novo preço.');return}
    if(kind==='create'&&data.services.some(s=>s.name.trim().toLocaleLowerCase('pt-BR')===draft.name.trim().toLocaleLowerCase('pt-BR'))){setError('Já existe um serviço com esse nome. Aplique o preço nele ou use outro nome para criar uma versão diferente.');return}
    setAcceptLoss(false);setCoins('0')
    setConfirm({kind,price:finalCents,id:kind==='apply'?chosen!.id:uuid(),oldPrice:chosen?.price_cents,name:kind==='apply'?chosen!.name:draft.name.trim(),duration:result.duration,description:draft.description.trim()})
  }
  async function commit(){
    if(!confirm||operation.current)return
    if(confirm.price<result.minimumCents&&!acceptLoss){setError('Confirme que deseja salvar um preço abaixo do custo estimado.');return}
    const reward=parseAmount(coins)
    if(confirm.kind==='create'&&(!Number.isSafeInteger(reward)||reward<0||reward>2147483647)){setError('Informe moedas de fidelidade inteiras e não negativas.');return}
    operation.current=true;setBusy(true);setError(null)
    try{
      if(confirm.kind==='apply'){
        // Compare-and-set: do not silently overwrite a price changed in another session.
        if(isDemo)await save('services',{price_cents:confirm.price},confirm.id)
        else{
          if(!supabase)throw new Error('Banco indisponível.')
          const response=await supabase.from('services').update({price_cents:confirm.price}).eq('id',confirm.id).eq('company_id',company.id).eq('price_cents',confirm.oldPrice!).select('id').maybeSingle()
          if(response.error)throw response.error
          if(!response.data){await refresh();throw new Error('Este serviço foi alterado por outra sessão ou não está mais disponível. Feche a confirmação e confira o preço atual.')}
          await refresh()
        }
      }else{
        // Reuse this operation's UUID on retries; a lost response cannot create a duplicate.
        let alreadySaved=false
        if(!isDemo&&supabase){const probe=await supabase.from('services').select('id,name,price_cents').eq('id',confirm.id).eq('company_id',company.id).maybeSingle();if(probe.error)throw probe.error;if(probe.data){if(probe.data.name!==confirm.name||probe.data.price_cents!==confirm.price)throw new Error('Não foi possível validar a gravação anterior. Confira o catálogo.');alreadySaved=true;await refresh()}}
        if(!alreadySaved)await save('services',{id:confirm.id,name:confirm.name,description:confirm.description||null,price_cents:confirm.price,duration_minutes:confirm.duration,coins:reward,active:true})
        setCreatedId(confirm.id);setTarget(confirm.id)
      }
      setNotice(`${confirm.kind==='create'?'Serviço criado':'Preço atualizado'}: ${confirm.name} — ${money(confirm.price)}.${isDemo?' Modo de prévia: alteração temporária.':''}`);setConfirm(null)
    }catch(cause){setError(readableError(cause))}finally{setBusy(false);operation.current=false}
  }
  function download(){
    if(!ready)return
    const currency=(v:number)=>money(Math.round(v*100))
    const text=[`VITRACAR — SIMULAÇÃO DE PREÇO`,draft.name,`Local: ${external?'No endereço do cliente':'Na loja'}`,`Gerado em: ${new Date().toLocaleString('pt-BR')}`,'',...result.costs.map(c=>`${c.label}: ${currency(c.value)}`),'',`Custo total: ${currency(result.total)}`,`Mínimo sem lucro: ${money(result.minimumCents)}`,`Preço sugerido: ${money(result.suggestedCents)}`,`Preço escolhido: ${money(finalCents)}`,`Taxas sobre venda: ${(result.fees*100).toFixed(2)}%`,`Margem desejada: ${(result.margin*100).toFixed(2)}%`,`Resultado estimado (já descontada a reserva): ${currency(outcome.profit)}`,`Margem estimada: ${(outcome.margin*100).toFixed(2)}%`,'',`Tempo do serviço: ${result.duration} min; tempo ocupado: ${result.occupiedMinutes} min`,external?`Distância: ${result.distance} km; combustível: ${result.fuelLiters.toFixed(2)} L`:'','PRODUTOS',...draft.products.map((p,i)=>`${p.name}: embalagem ${p.pack} ${p.unit} por R$ ${p.price}; uso ${p.use} ${baseUnit(p.unit)}${p.diluted?` de mistura 1:${p.waterParts} (produto:água)`:''}; custo ${currency(result.productCosts[i])}`),'','PREMISSAS INFORMADAS',JSON.stringify(draft,null,2),'','ATENÇÃO: estimativa baseada nos custos informados; não é recomendação tributária. Campos opcionais em branco valem zero. A ficha não é armazenada no cadastro do serviço.',...result.warnings].join('\n')
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`vitracar-calculo-${draft.name.replace(/[^a-z0-9-]/gi,'-').slice(0,60)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <div className="pc-page">
    <header className="pc-heading"><div className="pc-title"><span className="pc-title-icon"><Calculator size={27}/></span><div><span className="eyebrow">PRECIFICAÇÃO INTELIGENTE</span><h1>Calcular preço</h1><p>Seu cuidado tem valor. Descubra quanto cobrar por cada serviço.</p></div></div><Button variant="secondary" onClick={()=>setResetOpen(true)}><RotateCcw size={15}/>Nova simulação</Button></header>
    <div className="pc-workspace"><fieldset className="pc-inputs" disabled={busy}>
      <Section step="01" title="Qual serviço vamos calcular?" subtitle="Comece pelo nome e pelo lugar onde o atendimento acontece.">
        <Field label="Nome do serviço"><Input aria-label="Nome do serviço" maxLength={160} value={draft.name} onChange={e=>patch('name',e.target.value)} placeholder="Ex.: Lavagem completa de SUV"/></Field>
        <div className="pc-modes" role="group" aria-label="Local do serviço">{([{value:'store',label:'Na loja',text:'Estrutura, água, energia e operação.',Icon:Store},{value:'customer',label:'No endereço do cliente',text:'Deslocamento e estrutura móvel.',Icon:MapPin}] as const).map(({value,label,text,Icon})=><button type="button" key={value} aria-pressed={draft.mode===value} className={draft.mode===value?'selected':''} onClick={()=>patch('mode',value)}><Icon size={24}/><span><strong>{label}</strong><small>{text}</small></span>{draft.mode===value&&<Check size={17}/>}</button>)}</div>
        <Field label="Descrição do serviço (opcional)"><Textarea aria-label="Descrição do serviço" rows={2} value={draft.description} onChange={e=>patch('description',e.target.value)} placeholder="Etapas e cuidados incluídos. Não coloque seus custos internos aqui."/></Field>
      </Section>
      {external&&<Section step="02" title="O caminho também tem custo" subtitle="Informe a distância real. O sistema não mede quilômetros automaticamente.">
        <div className="pc-grid"><Field label="Endereço de saída"><Input aria-label="Endereço de saída" maxLength={300} value={draft.trip.origin} onChange={e=>tripPatch('origin',e.target.value)} placeholder="Endereço da sua base"/></Field><Field label="Destino para consultar a rota"><Input aria-label="Destino para consultar a rota" maxLength={300} value={draft.trip.destination} onChange={e=>tripPatch('destination',e.target.value)} placeholder="Endereço do cliente"/></Field></div>
        {route&&<a className="pc-map-link" href={route} target="_blank" rel="noopener noreferrer"><MapPin size={15}/>Consultar distância no Maps <ChevronRight size={14}/></a>}<p className="pc-help">Consulte a rota e copie os quilômetros de ida abaixo. O preço do combustível é informado por você.</p>
        <div className="pc-grid">{travel('km','Distância de ida (km)')}{travel('fuel','Combustível (R$/L)')}{travel('efficiency','Consumo do veículo (km/L)')}{travel('minutes','Tempo total da viagem (min)','Some ida e volta quando aplicável.')}{travel('wear','Manutenção e desgaste (R$/km)','Sem combustível: pneus, revisão e depreciação.')}{travel('tolls','Pedágios totais (R$)')}{travel('parking','Estacionamento (R$)')}</div>
        <label className="pc-check"><input type="checkbox" checked={draft.trip.roundTrip} onChange={e=>tripPatch('roundTrip',e.target.checked)}/>Incluir ida e volta nos quilômetros</label><div className="pc-inline-summary"><Fuel size={17}/><span>{result.distance.toLocaleString('pt-BR')} km no total · {result.fuelLiters.toLocaleString('pt-BR',{maximumFractionDigits:2})} L de combustível estimados</span></div>
      </Section>}
      <Section step={external?'03':'02'} title="Produtos na medida certa" subtitle="Pague pelo que usou, não pela embalagem inteira. Inclua os químicos desta lavagem.">
        <PricingProducts products={draft.products} onChange={rows=>patch('products',rows)} result={result}/>
        <div className="pc-grid">{numeric('waste','Perdas extras de produtos (%)','Acrescenta uma reserva de consumo; não é desconto no rendimento.')}{numeric('consumables','Descartáveis por serviço (R$)','Luvas, sacos, aplicadores e outros consumíveis.')}{numeric('laundry','Panos: lavagem e reposição (R$)')}{numeric('other','Outros custos diretos (R$)')}</div><p className="pc-help">Use a diluição indicada pelo fabricante. A calculadora não recomenda misturas químicas.</p>
      </Section>
      <Section step={external?'04':'03'} title="Seu tempo faz parte do preço" subtitle="Considere a equipe e o seu próprio trabalho, mesmo quando você executa o serviço."><div className="pc-grid">{numeric('duration','Duração do serviço (min)')}{numeric('setup','Preparação e organização (min)')}{numeric('people','Quantidade de profissionais')}{numeric('hourly','Custo por hora por profissional (R$)','Salário/pró-labore + encargos, dividido pelas horas produtivas.')}</div><div className="pc-inline-summary"><Users size={17}/><span>{result.occupiedMinutes} minutos ocupados{external?' incluindo a viagem':''}. O deslocamento usa o mesmo custo/hora da equipe.</span></div></Section>
      <Section step={external?'05':'04'} title="Equipamentos, água e energia" subtitle="Inclua o uso e a reposição da lavadora, aspirador, extratora ou politriz.">
        {draft.equipment.map((e,i)=><article className="pc-item" key={e.id}><header><strong>Equipamento {i+1}</strong><button type="button" className="pc-remove" aria-label={`Remover equipamento ${i+1}`} onClick={()=>patch('equipment',draft.equipment.filter(x=>x.id!==e.id))}><Trash2 size={16}/></button></header><div className="pc-grid"><Field label="Equipamento"><Input aria-label={`Equipamento ${i+1}`} value={e.name} onChange={ev=>equipmentPatch(e.id,{name:ev.target.value})} placeholder="Ex.: Lavadora de alta pressão"/></Field><NumberField label={`Potência ${i+1} (W)`} value={e.watts} onChange={v=>equipmentPatch(e.id,{watts:v})}/><NumberField label={`Tempo ligado ${i+1} (min)`} value={e.minutes} onChange={v=>equipmentPatch(e.id,{minutes:v})}/><NumberField label={`Valor de reposição ${i+1} (R$)`} value={e.price} onChange={v=>equipmentPatch(e.id,{price:v})}/><NumberField label={`Vida útil ${i+1} (atendimentos)`} value={e.life} onChange={v=>equipmentPatch(e.id,{life:v})}/></div><footer><small>Reserva de reposição por uso</small><strong>{money(Math.round(result.equipmentCosts[i]*100))}</strong></footer></article>)}
        <Button variant="secondary" onClick={()=>patch('equipment',[...draft.equipment,{id:uuid(),name:'',watts:'',minutes:'',price:'',life:''}])}><Plus size={15}/>Adicionar equipamento</Button>
        <div className="pc-grid pc-spaced">{operating('water','Água por lavagem (L)','Inclua a água das diluições.')}{!(external&&op.customerWater)&&operating('waterRate','Água e esgoto (R$/m³)','1 m³ = 1.000 litros.')}{!(external&&op.customerPower)&&operating('powerRate','Energia (R$/kWh)')}</div>
        {external&&<div className="pc-grid"><label className="pc-check"><input type="checkbox" checked={op.customerWater} onChange={e=>operationPatch('customerWater',e.target.checked)}/>Cliente fornece a água, sem custo para mim</label><label className="pc-check"><input type="checkbox" checked={op.customerPower} onChange={e=>operationPatch('customerPower',e.target.checked)}/>Cliente fornece energia, sem custo para mim</label></div>}<p className="pc-help">Consumo estimado dos equipamentos: {result.kwh.toLocaleString('pt-BR',{maximumFractionDigits:3})} kWh. Gerador, água transportada e manutenção extra podem entrar em outros custos diretos.</p>
      </Section>
      <Section step={external?'06':'05'} title={external?'Sua estrutura móvel':'A loja precisa se pagar'} subtitle="Distribua os custos fixos pelas horas realmente vendidas, não pelas horas em que a loja fica aberta."><div className="pc-grid">{operating('rent',external?'Base / estrutura móvel por mês (R$)':'Aluguel e condomínio por mês (R$)')}{operating('admin','Administração por mês (R$)','Sistema, contador, internet e despesas administrativas.')}{operating('other','Outros custos fixos por mês (R$)','Marketing, seguros e custos ainda não incluídos.')}{operating('hours','Horas produtivas vendidas por mês','Horas da operação/equipe, sem multiplicar pelo número de profissionais.')}</div><p className="pc-help">Não repita mão de obra, água, energia ou equipamentos já incluídos acima. O rateio usa o tempo ocupado de cada atendimento. Loja e atendimento externo guardam valores independentes nesta simulação.</p></Section>
      <Section step={external?'07':'06'} title="Taxas e margem desejada" subtitle="A margem é calculada sobre o preço de venda, não como um acréscimo simples sobre o custo."><div className="pc-grid">{numeric('tax','Impostos sobre a venda (%)','Informe sua alíquota efetiva; confirme com a contabilidade.')}{numeric('fee','Taxa de recebimento (%)','Cartão, antecipação ou outro meio usado na simulação.')}{numeric('commission','Comissão sobre a venda (%)')}{numeric('fixedFee','Tarifa fixa por recebimento (R$)')}{numeric('reserve','Reserva técnica sobre custos (%)','Margem de segurança para custos não previstos.')}{numeric('margin','Margem de resultado desejada (%)','Digite inclusive zero quando não desejar margem.')}
        <Field label="Arredondar preço sugerido"><Select aria-label="Arredondar preço sugerido" value={draft.rounding} onChange={e=>patch('rounding',e.target.value)}><option value="0.01">Para cima, em centavos</option><option value="1">Para cima, de R$ 1 em R$ 1</option><option value="5">Para cima, de R$ 5 em R$ 5</option><option value="10">Para cima, de R$ 10 em R$ 10</option></Select></Field></div>
        <p className="pc-help">Campos opcionais em branco entram como zero. O resultado depende da qualidade dos custos informados; não representa lucro contábil garantido.</p>
      </Section>
      {attempted&&result.errors.length>0&&<AttentionNotice urgent>{result.errors.map(e=><p key={e}>{e}</p>)}</AttentionNotice>}
      <Button className="pc-calculate" onClick={calculate}><Calculator size={18}/>Calcular preço do serviço</Button>
    </fieldset>
    <aside className="pc-summary" id="pc-result"><div className="pc-result-hero"><span><Sparkles size={16}/> SEU PREÇO, COM CLAREZA</span><h2>{draft.name.trim()||'Seu próximo serviço'}</h2><small>{external?'No endereço do cliente':'Na loja'}</small><div className="pc-main-price"><small>Preço sugerido</small><strong>{calculated&&result.valid?money(result.suggestedCents):'—'}</strong><span>{calculated&&result.valid?'Custos + taxas + margem desejada':'Preencha os custos e clique em calcular'}</span></div></div>
      <div className="pc-result-body"><h3>De onde vem o custo</h3><div className="pc-breakdown">{result.costs.map(c=><div key={c.label}><span>{c.label}</span><strong>{money(Math.round(c.value*100))}</strong></div>)}<div className="pc-cost-total"><span>Custo por atendimento</span><strong>{money(Math.round(result.total*100))}</strong></div></div>
        {calculated&&result.valid?<><div className="pc-minimum"><small>Mínimo para cobrir custos e taxas</small><strong>{money(result.minimumCents)}</strong><span>Sem lucro, com a reserva técnica informada.</span></div><NumberField label="Preço que vou cobrar (R$)" value={override} onChange={v=>{setOverride(v);setError(null);setCreatedId(null)}} placeholder={centsToPrice(result.suggestedCents)} hint="Deixe em branco para usar o preço sugerido."/>
          {!priceValid&&<ErrorText message="Informe um preço maior que zero, de até R$ 10 milhões."/>}
          {priceValid&&<><div className={`pc-profit ${outcome.profit<0?'negative':''}`}><span>Resultado estimado por serviço</span><strong>{money(Math.round(outcome.profit*100))}</strong><small>{(outcome.margin*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}% de margem · taxas: {money(Math.round(outcome.charges*100))}</small></div>{finalCents<result.minimumCents?<AttentionNotice>O preço escolhido não cobre os custos informados. A confirmação exigirá reconhecer essa perda.</AttentionNotice>:outcome.margin+0.00001<result.margin?<AttentionNotice>O preço escolhido fica abaixo da margem desejada.</AttentionNotice>:null}<p className="pc-help">Desconto máximo até zerar o resultado estimado: <strong>{money(Math.round(outcome.maxDiscount*100))}</strong>.</p></>}
          {result.warnings.length>0&&<details className="pc-warnings"><summary>Revisar {result.warnings.length} premissa(s) do cálculo</summary><AttentionNotice>{result.warnings.map(w=><p key={w}>{w}</p>)}</AttentionNotice></details>}
          <Button variant="secondary" className="pc-full" onClick={download} disabled={!ready}><Download size={15}/>Baixar memória do cálculo</Button>
        </>:<p className="pc-help">Esta é uma simulação. Nenhum serviço é alterado enquanto você preenche os valores.</p>}
        <details className="pc-formula"><summary>Como o preço é calculado?</summary><p>Preço = custo total ÷ (1 − impostos − taxas − comissão − margem).</p><p>A reserva técnica já está no custo. O rateio mensal usa as horas produtivas. Produtos diluídos usam 1 parte de produto + N partes de água.</p></details>
      </div></aside></div>
    {calculated&&result.valid&&<section className="pc-publish"><header><span className="pc-title-icon"><Save size={23}/></span><div><h2>Leve este preço para o catálogo</h2><p>Escolha o destino. Nada será gravado antes da sua confirmação.</p></div></header><ErrorText message={confirm?null:error}/>{notice&&<div className="success-text" role="status"><CheckCircle2 size={17}/>{notice} <Link to="/servicos">Ver serviços</Link></div>}
      <div className="pc-publish-grid"><div><h3>Criar serviço</h3><p>Cadastre {draft.name||'um novo serviço'} com o preço calculado, sua descrição e duração.</p><Button onClick={()=>prepare('create')} disabled={!ready||busy||Boolean(createdId)}><Plus size={16}/>{createdId?'Serviço criado':'Criar serviço'}</Button></div><div><h3>Aplicar a serviço criado</h3><Input aria-label="Buscar serviço para atualizar" placeholder="Buscar serviço do catálogo..." value={filter} onChange={e=>setFilter(e.target.value)}/><Select aria-label="Serviço para atualizar" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Selecione um serviço</option>{services.map(s=><option value={s.id} key={s.id}>{s.name} — {money(s.price_cents)}{s.active?'':' (pausado)'}</option>)}</Select>{chosen&&<p>Preço atual: <strong>{money(chosen.price_cents)}</strong> → novo: <strong>{priceValid?money(finalCents):'—'}</strong></p>}<Button variant="secondary" onClick={()=>prepare('apply')} disabled={!ready||!chosen||busy}><Save size={16}/>Aplicar ao serviço selecionado</Button></div></div>
      <p className="pc-help">O catálogo tem um preço padrão por serviço. Para manter valores diferentes para loja e domicílio, crie duas versões. Atualizar o preço não modifica orçamentos, agendamentos ou recebimentos anteriores. A memória de custos não fica armazenada no cadastro: baixe o resumo para guardá-la.</p>
    </section>}
    {confirm&&<Modal title={confirm.kind==='create'?'Criar serviço com este preço?':'Atualizar preço do serviço?'} onClose={()=>{if(!busy){setConfirm(null);setError(null)}}}><div className="pc-confirm"><h3>{confirm.name}</h3>{confirm.kind==='apply'&&<p>Preço atual: {money(confirm.oldPrice||0)}</p>}<strong>{money(confirm.price)}</strong><p>{confirm.kind==='apply'?'Somente o preço padrão será alterado. Nome, descrição, duração, moedas e situação serão preservados.':'Será criado um serviço ativo. A duração cadastrada será somente a duração do serviço, sem a viagem e a preparação.'}</p>{confirm.kind==='create'&&<NumberField label="Moedas de fidelidade do novo serviço" value={coins} onChange={setCoins}/>}
      {confirm.price<result.minimumCents&&<AttentionNotice>Este preço pode gerar prejuízo nesta simulação.<label className="pc-check"><input type="checkbox" checked={acceptLoss} onChange={e=>setAcceptLoss(e.target.checked)}/>Entendo que o preço não cobre os custos informados.</label></AttentionNotice>}<ErrorText message={error}/><div className="form-actions"><Button variant="secondary" onClick={()=>{setConfirm(null);setError(null)}} disabled={busy}>Cancelar</Button><Button disabled={busy||(confirm.price<result.minimumCents&&!acceptLoss)} onClick={()=>void commit()}>{busy?'Salvando...':confirm.kind==='create'?'Confirmar criação':'Confirmar novo preço'}</Button></div></div></Modal>}
    {resetOpen&&<Modal title="Começar uma nova simulação?" onClose={()=>setResetOpen(false)}><AttentionNotice>Os valores desta simulação serão limpos. Serviços já salvos no catálogo não serão alterados.</AttentionNotice><div className="form-actions"><Button variant="secondary" onClick={()=>setResetOpen(false)}>Continuar simulando</Button><Button onClick={()=>{const d=emptyPricing();d.trip.origin=company.address||'';setDraft(d);setCalculated(false);setAttempted(false);setOverride('');setError(null);setNotice('');setCreatedId(null);setResetOpen(false)}}>Limpar simulação</Button></div></Modal>}
  </div>
}
