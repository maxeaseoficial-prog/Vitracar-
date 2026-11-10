// Pure cost model. Monetary inputs are BRL; only final amounts are rounded to cents.
export type PricingMode = 'store' | 'customer'
export type ProductUnit = 'ml' | 'l' | 'g' | 'kg' | 'un'
export type ProductCost = {id:string;name:string;unit:ProductUnit;pack:string;price:string;use:string;diluted:boolean;waterParts:string}
export type EquipmentCost = {id:string;name:string;watts:string;minutes:string;price:string;life:string}
export type OperationCost = {water:string;waterRate:string;powerRate:string;rent:string;admin:string;other:string;hours:string;customerWater:boolean;customerPower:boolean}
export type PricingDraft = {
  name:string;description:string;mode:PricingMode;duration:string;setup:string;people:string;hourly:string;
  products:ProductCost[];equipment:EquipmentCost[];waste:string;consumables:string;laundry:string;other:string;
  store:OperationCost;customer:OperationCost;
  trip:{km:string;roundTrip:boolean;efficiency:string;fuel:string;minutes:string;wear:string;tolls:string;parking:string;origin:string;destination:string};
  tax:string;fee:string;commission:string;fixedFee:string;margin:string;reserve:string;rounding:string
}
export function emptyOperation():OperationCost{return {water:'',waterRate:'',powerRate:'',rent:'',admin:'',other:'',hours:'',customerWater:false,customerPower:false}}
export function emptyPricing():PricingDraft{return {name:'',description:'',mode:'store',duration:'',setup:'',people:'1',hourly:'',products:[],equipment:[],waste:'',consumables:'',laundry:'',other:'',store:emptyOperation(),customer:emptyOperation(),trip:{km:'',roundTrip:true,efficiency:'',fuel:'',minutes:'',wear:'',tolls:'',parking:'',origin:'',destination:''},tax:'',fee:'',commission:'',fixedFee:'',margin:'',reserve:'',rounding:'0.01'}}
export function parseAmount(raw:string):number {
  const s=raw.trim();if(!s)return 0
  // Decimal comma/dot; BR grouping is accepted only with an explicit decimal comma.
  const normalized=/^\d{1,3}(\.\d{3})+,\d+$/.test(s)?s.replaceAll('.','').replace(',','.'):s.replace(',','.')
  if(!/^\d+(\.\d+)?$/.test(normalized))return NaN
  const value=Number(normalized);return Number.isFinite(value)&&value<=100000000?value:NaN
}
const ceilCents=(value:number)=>Math.ceil(value*100-1e-7)
export type PricingResult = {
  errors:string[];warnings:string[];costs:{label:string;value:number}[];productCosts:number[];equipmentCosts:number[];
  total:number;subtotal:number;reserveCost:number;fees:number;margin:number;suggestedCents:number;minimumCents:number;
  duration:number;occupiedMinutes:number;distance:number;fuelLiters:number;kwh:number;concentrate:number[];valid:boolean
}
export function calculatePricing(d:PricingDraft):PricingResult {
  const errors:string[]=[],warnings:string[]=[]
  function read(s:string,label:string,options:{required?:boolean;positive?:boolean;integer?:boolean;max?:number}={}){
    const n=parseAmount(s)
    if((options.required&&!s.trim())||!Number.isFinite(n)||(options.positive&&n<=0)||(options.integer&&!Number.isInteger(n))||n>(options.max??100000000)){
      errors.push(`Confira ${label}${options.positive?': informe um valor maior que zero':': use um número válido, igual ou maior que zero'}.`);return 0
    }return n
  }
  if(!d.name.trim()||d.name.trim().length>160)errors.push('Informe o nome do serviço, com até 160 caracteres.')
  const duration=read(d.duration,'a duração do serviço',{required:true,positive:true,integer:true,max:1440})
  const setup=read(d.setup,'o tempo de preparação',{max:1440})
  const people=read(d.people,'a quantidade de profissionais',{required:true,positive:true,integer:true,max:100})
  const hourly=read(d.hourly,'o custo por hora de cada profissional')
  if(hourly===0)warnings.push('Mão de obra está zerada. Inclua também o custo do seu próprio tempo.')
  const waste=read(d.waste,'as perdas de produtos (%)',{max:100})
  const concentrate:number[]=[]
  const productCosts=d.products.map((p,i)=>{
    const label=p.name.trim()||`produto ${i+1}`
    if(!p.name.trim())errors.push(`Informe o nome do produto ${i+1}.`)
    const pack=read(p.pack,`a embalagem de ${label}`,{required:true,positive:true})
    const price=read(p.price,`o preço da embalagem de ${label}`,{required:true})
    const used=read(p.use,`o consumo de ${label}`,{required:true,positive:true})
    const liquid=p.unit==='l'||p.unit==='ml'
    if(p.diluted&&!liquid)errors.push(`Diluição de ${label}: use apenas unidades de volume (L ou ml).`)
    const parts=p.diluted&&liquid?read(p.waterParts,`as partes de água de ${label}`,{required:true,max:100000}):0
    const amount=used/(1+parts);concentrate.push(amount)
    return pack>0?price*amount/(pack*(p.unit==='l'||p.unit==='kg'?1000:1))*(1+waste/100):0
  })
  if(!d.products.length)warnings.push('Nenhum produto foi incluído. O preço não considera produtos químicos ainda.')
  let kwh=0
  const equipmentCosts=d.equipment.map((e,i)=>{
    const label=e.name.trim()||`equipamento ${i+1}`
    if(!e.name.trim())errors.push(`Informe o nome do equipamento ${i+1}.`)
    const watts=read(e.watts,`a potência de ${label}`),minutes=read(e.minutes,`o uso de ${label}`,{positive:watts>0,max:1440})
    kwh+=watts/1000*minutes/60
    const price=read(e.price,`o valor de ${label}`),life=read(e.life,`a vida útil em atendimentos de ${label}`,{positive:price>0,integer:true})
    return price>0&&life>0?price/life:0
  })
  const op=d[d.mode],external=d.mode==='customer',trip=d.trip
  let distance=0,fuelLiters=0,travelMinutes=0,transport=0
  if(external){
    distance=read(trip.km,'a distância de ida (km)',{required:true,max:10000})*(trip.roundTrip?2:1)
    const efficiency=read(trip.efficiency,'o consumo do veículo (km/L)',{required:distance>0,positive:distance>0,max:1000})
    const fuel=read(trip.fuel,'o preço do combustível (R$/L)',{required:distance>0,positive:distance>0})
    fuelLiters=efficiency>0?distance/efficiency:0
    travelMinutes=read(trip.minutes,'o tempo total de deslocamento',{max:2880})
    transport=fuelLiters*fuel+distance*read(trip.wear,'o desgaste por km')+read(trip.tolls,'os pedágios')+read(trip.parking,'o estacionamento')
    if(distance>0&&travelMinutes===0)warnings.push('O deslocamento não tem tempo informado: a mão de obra e a estrutura durante a viagem estão zeradas.')
    if(distance>0&&parseAmount(trip.wear)===0)warnings.push('O transporte considera combustível, mas não reserva por km para pneus, manutenção e depreciação do veículo.')
  }
  const water=read(op.water,'o consumo de água (L)')
  const waterRate=external&&op.customerWater?0:read(op.waterRate,'a tarifa de água e esgoto (R$/m³)',{required:water>0})
  const powerRate=external&&op.customerPower?0:read(op.powerRate,'a tarifa de energia (R$/kWh)',{required:kwh>0})
  const utilityCost=water/1000*waterRate+kwh*powerRate
  const fixed=read(op.rent,'o aluguel/base mensal')+read(op.admin,'a administração mensal')+read(op.other,'os outros custos fixos mensais')
  const hours=read(op.hours,'as horas produtivas do mês',{required:fixed>0,positive:fixed>0,max:744})
  if(fixed===0)warnings.push('Custos fixos estão zerados. A simulação não está cobrindo aluguel/base, administração ou outros custos mensais.')
  if(water===0&&!(external&&op.customerWater))warnings.push('Água não incluída. Informe o consumo, inclusive o usado nas diluições, quando houver.')
  const occupiedMinutes=duration+setup+travelMinutes
  const costs=[
    {label:'Produtos e perdas',value:productCosts.reduce((a,b)=>a+b,0)},
    {label:'Descartáveis, panos e outros',value:read(d.consumables,'os descartáveis')+read(d.laundry,'a lavagem/reposição de panos')+read(d.other,'os outros custos diretos')},
    {label:'Mão de obra',value:occupiedMinutes/60*people*hourly},
    {label:'Água e energia',value:utilityCost},
    {label:'Desgaste dos equipamentos',value:equipmentCosts.reduce((a,b)=>a+b,0)},
    {label:'Rateio da estrutura',value:hours>0?fixed/hours*occupiedMinutes/60:0},
    ...(external?[{label:'Deslocamento e combustível',value:transport}]:[]),
    {label:'Tarifa fixa por recebimento',value:read(d.fixedFee,'a tarifa fixa por recebimento')}
  ]
  const subtotal=costs.reduce((sum,c)=>sum+c.value,0)
  const reserveCost=subtotal*read(d.reserve,'a reserva técnica (%)',{max:100})/100,total=subtotal+reserveCost
  costs.push({label:'Reserva técnica',value:reserveCost})
  const fees=(read(d.tax,'os impostos (%)',{max:99.99})+read(d.fee,'a taxa de recebimento (%)',{max:99.99})+read(d.commission,'a comissão (%)',{max:99.99}))/100
  const margin=read(d.margin,'a margem desejada (%)',{required:true,max:99.99})/100
  if(fees+margin>=1)errors.push('A soma de impostos, taxas, comissão e margem deve ser menor que 100%.')
  if(total<=0)errors.push('Inclua pelo menos um custo maior que zero antes de calcular o preço.')
  if(!d.tax.trim())warnings.push('Impostos não informados foram tratados como zero. Preencha a alíquota efetiva aplicável ao seu negócio.')
  const step=parseAmount(d.rounding)
  if(![0.01,1,5,10].includes(step))errors.push('Escolha uma opção válida de arredondamento.')
  const minimumCents=fees<1?ceilCents(total/(1-fees)):0
  const raw=fees+margin<1?total/(1-fees-margin):0
  const suggestedCents=step>0?Math.ceil((raw-1e-9)/step)*Math.round(step*100):0
  if(!Number.isSafeInteger(suggestedCents)||suggestedCents>1000000000)errors.push('O preço calculado excede o limite de R$ 10 milhões. Revise os custos e percentuais.')
  return {errors,warnings,costs,productCosts,equipmentCosts,total,subtotal,reserveCost,fees,margin,suggestedCents,minimumCents,duration,occupiedMinutes,distance,fuelLiters,kwh,concentrate,valid:errors.length===0}
}
export function priceOutcome(result:PricingResult,cents:number){
  const price=cents/100,charges=price*result.fees,profit=price-charges-result.total
  return {price,charges,profit,margin:price>0?profit/price:0,maxDiscount:Math.max(0,price-result.minimumCents/100)}
}
export function pricingRoute(origin:string,destination:string){
  if(!origin.trim()||!destination.trim())return null
  const query=new URLSearchParams({api:'1',origin:origin.trim(),destination:destination.trim(),travelmode:'driving'})
  const url=`https://www.google.com/maps/dir/?${query}`;return url.length<=2048?url:null
}
