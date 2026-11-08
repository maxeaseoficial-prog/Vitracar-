import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CarFront, CheckCircle2, CircleAlert, Hash, Keyboard, Layers3, Save, Search, ShieldCheck } from 'lucide-react'
import { Button, ErrorText, Field, Input, Select, Textarea } from '../UI'
import { CarViewer } from '../CarViewer'
import { getCatalog, categories, isUsableModel, type CatalogCar } from '../../lib/catalog'
import { warmModel } from '../../lib/model-cache'
import { useStore } from '../../lib/store'
import { formatPlate, normalizePlate, validPlate } from '../../lib/utils'
import type { Vehicle } from '../../types'
import { VehiclePicker } from './VehiclePicker'
import { ColorSwatches } from './ColorSwatches'

type Props = {
  clientId: string
  vehicle?: Vehicle
  onDone: () => void
  onClose: () => void
}

export function VehicleStudioForm({clientId,vehicle,onDone,onClose}:Props) {
  const {save}=useStore()
  const [plate,setPlate]=useState(vehicle?.plate||'')
  const [brand,setBrand]=useState(vehicle?.brand||'')
  const [model,setModel]=useState(vehicle?.model||'')
  const [year,setYear]=useState(vehicle?.year?.toString()||'')
  const [color,setColor]=useState(vehicle?.color||'Prata')
  const [category,setCategory]=useState(vehicle?.category||'')
  const [upholstery,setUpholstery]=useState(vehicle?.upholstery||'Tecido')
  const [model3d,setModel3d]=useState(vehicle?.model_3d_id||'')
  const [notes,setNotes]=useState(vehicle?.notes||'')
  const [manual,setManual]=useState(Boolean(vehicle&&!vehicle.model_3d_id))
  const [cars,setCars]=useState<CatalogCar[]>([])
  const [loadingCatalog,setLoadingCatalog]=useState(true)
  const [catalogError,setCatalogError]=useState<string|null>(null)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState<string|null>(null)

  const loadCatalog=useCallback(async()=>{
    setLoadingCatalog(true);setCatalogError(null)
    try {
      const result=await getCatalog()
      setCars(result)
    } catch (cause) {
      setCatalogError(cause instanceof Error?cause.message:'Catálogo 3D indisponível no momento')
    } finally {
      setLoadingCatalog(false)
    }
  },[])
  useEffect(()=>{void loadCatalog()},[loadCatalog])
  const usableCars=useMemo(()=>cars.filter(isUsableModel),[cars])
  const selectedCar=useMemo(()=>cars.find(car=>car.id===model3d)||null,[cars,model3d])
  useEffect(()=>{
    if(!model3d)return
    const index=usableCars.findIndex(car=>car.id===model3d)
    if(index<0)return
    // O carro vizinho já estará em cache se o usuário navegar pelo carrossel.
    // Somente dois modelos leves, sem carregar a biblioteca inteira.
    const timer=setTimeout(()=>{
      warmModel(usableCars[index-1])
      warmModel(usableCars[index+1])
    },550)
    return()=>clearTimeout(timer)
  },[model3d,usableCars])
  const plateText=normalizePlate(plate)
  const canRepaint=Boolean(selectedCar && isUsableModel(selectedCar) && selectedCar.paint && selectedCar.paint.confidence!=='baixa')
  const isColorAvailable=!selectedCar||canRepaint
  const canSubmit=validPlate(plate) && brand.trim().length>0 && model.trim().length>0 &&
    (manual || Boolean(selectedCar) || Boolean(vehicle?.model_3d_id&&model3d===vehicle.model_3d_id))

  function selectCar(car:CatalogCar){
    setModel3d(car.id)
    setBrand(car.brand)
    setModel(car.model)
    setCategory(car.category)
    setManual(false)
    setError(null)
  }

  function enableManual(){
    setManual(true)
    setModel3d('')
    setBrand('')
    setModel('')
    setCategory('')
  }

  async function submit(event:FormEvent){
    event.preventDefault();setError(null)
    try{
      if(!validPlate(plate))throw new Error('Informe uma placa válida no formato ABC1D23 ou ABC-1234.')
      if(!brand.trim()||!model.trim())throw new Error('Escolha um carro no catálogo ou preencha marca e modelo manualmente.')
      if(!manual && !selectedCar && !(vehicle?.model_3d_id && model3d===vehicle.model_3d_id))
        throw new Error('Selecione um modelo 3D ou escolha o cadastro manual.')
      const typedYear=year.trim()?Number(year):null
      if(typedYear!==null&&(!Number.isInteger(typedYear)||typedYear<1900||typedYear>2100))
        throw new Error('Informe um ano válido.')
      setSaving(true)
      await save('vehicles',{
        client_id:clientId,
        plate:plateText,
        brand:brand.trim(),
        model:model.trim(),
        year:typedYear,
        color,
        category:category||null,
        upholstery:upholstery||null,
        model_3d_id:manual?null:(model3d||null),
        notes:notes.trim()||null
      },vehicle?.id)
      onDone()
    }catch(cause){
      setError(cause instanceof Error?cause.message:String(cause))
    }finally{setSaving(false)}
  }

  return <form className="v-studio-form" onSubmit={submit}>
    <div className="v-studio-intro">
      <div className="v-studio-intro-icon"><Layers3 size={23}/></div>
      <div><strong>Sua garagem, em três dimensões.</strong>
        <p>Encontre o modelo, personalize a cor e veja a placa mudar antes de salvar.</p></div>
      <span className="v-studio-intro-chip"><span/> VISUALIZAÇÃO AO VIVO</span>
    </div>

    <div className="v-studio-grid">
      <div className="v-studio-left">
        <VehiclePicker cars={usableCars} loading={loadingCatalog} error={catalogError}
          selectedId={manual?'':model3d} onSelect={selectCar} onRetry={()=>void loadCatalog()}/>
        {cars.length>usableCars.length&&<p className="v-qa-note">
          {cars.length-usableCars.length} modelos incompletos foram ocultados do showroom.
          Você ainda pode cadastrar esses veículos manualmente.
        </p>}
        <div className="v-manual-toggle">
          <span>Não encontrou o veículo correto?</span>
          <button type="button" className="v-manual-button" onClick={manual?()=>setManual(false):enableManual}>
            <Keyboard size={15}/>{manual?'Voltar ao catálogo':'Cadastrar sem modelo 3D'}<ArrowRight size={14}/>
          </button>
        </div>
        {manual&&<div className="v-manual-fields">
          <span className="v-manual-label"><CarFront size={15}/> Cadastro manual</span>
          <div className="form-grid">
            <Field label="Marca"><Input value={brand} required onChange={e=>setBrand(e.target.value)} placeholder="Ex.: Toyota"/></Field>
            <Field label="Modelo"><Input value={model} required onChange={e=>setModel(e.target.value)} placeholder="Ex.: Corolla"/></Field>
            <Field label="Categoria"><Select value={category} onChange={e=>setCategory(e.target.value)}>
              <option value="">Selecione</option>
              {Object.entries(categories).map(([key,label])=><option value={key} key={key}>{label}</option>)}
            </Select></Field>
          </div>
          <small>O veículo será cadastrado normalmente, mesmo sem um modelo 3D compatível.</small>
        </div>}
      </div>

      <div className="v-studio-right">
        <div className="v-preview-head"><div><span className="v-studio-step">PRÉVIA</span>
          <strong>{manual?(brand&&model?`${brand} ${model}`:'Veículo sem modelo 3D') :
            selectedCar?`${selectedCar.brand} ${selectedCar.model}`:'Selecione um veículo'}</strong>
          {selectedCar&&<small>{categories[selectedCar.category]||selectedCar.category} · Modelo 3D do catálogo</small>}
        </div><span className="v-preview-live"><span/> AO VIVO</span></div>

        {selectedCar&&!manual?<CarViewer modelId={selectedCar.id} car={selectedCar} color={color} plate={plate} variant="studio"/>:
          <div className="v-preview-placeholder">
            <div className="v-preview-placeholder-art"><CarFront size={60} strokeWidth={1.25}/></div>
            <strong>{manual?'Cadastro sem 3D':'Seu próximo veículo aparece aqui'}</strong>
            <span>{manual?'Todos os dados podem ser registrados normalmente.':
              'Busque e selecione um carro para ver o modelo tridimensional interativo.'}</span>
            <div className="v-placeholder-plate"><span>BRASIL</span><strong>{plateText||'ABC1D23'}</strong></div>
          </div>}

        <ColorSwatches value={color} onChange={setColor} canRepaint={isColorAvailable}/>
      </div>
    </div>

    <section className="v-studio-data">
      <div className="v-studio-section-title">
        <div><span className="v-studio-step">03</span><strong>Dados do veículo</strong>
          <p>Preencha apenas as informações necessárias para identificar o carro.</p></div>
        {selectedCar&&!manual&&<span className="v-car-autofilled"><CheckCircle2 size={15}/> Marca e modelo preenchidos</span>}
      </div>
      <div className="v-studio-data-grid">
        <Field label="Placa brasileira">
          <div className="v-plate-input-wrap"><Hash size={17}/>
            <Input required value={formatPlate(plate)} maxLength={8} autoCapitalize="characters" autoComplete="off"
              onChange={e=>setPlate(normalizePlate(e.target.value).slice(0,7))}
              placeholder="ABC1D23" aria-describedby="v-plate-help"/>
          </div>
          <span id="v-plate-help" className={`v-input-hint ${plateText.length===7&&!validPlate(plateText)?'invalid':''}`}>
            {plateText.length===7&&!validPlate(plateText)?'Confira a placa informada.':'A placa muda automaticamente na visualização 3D.'}
          </span>
        </Field>
        <Field label="Ano"><Input type="number" min="1900" max="2100" value={year} onChange={e=>setYear(e.target.value)}
          placeholder="Ex.: 2024"/></Field>
        <Field label="Tipo de estofado"><Select value={upholstery} onChange={e=>setUpholstery(e.target.value)}>
          <option value="Tecido">Tecido</option><option value="Couro">Couro</option>
          <option value="Sintético">Sintético</option><option value="Alcântara">Alcântara</option>
          <option value="Outro">Outro</option>
        </Select></Field>
        <div className="v-studio-vehicle-meta"><ShieldCheck size={17}/>
          <span>{selectedCar&&!manual?`${brand} ${model} · ${categories[category]||category}`:
            'Escolha um modelo 3D para preencher a marca e o modelo automaticamente.'}</span>
        </div>
      </div>
      <Field label="Observações (opcional)"><Textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}
        placeholder="Detalhes importantes sobre o veículo..."/></Field>
    </section>

    {error&&<ErrorText message={error}/>}
    <div className="v-studio-footer">
      <p><CircleAlert size={15}/> O modelo 3D representa uma versão ilustrativa. A cor e a placa informadas ficam salvas no cadastro.</p>
      <div><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={saving||!canSubmit}><Save size={16}/>{saving?'Salvando...':vehicle?'Salvar alterações':'Adicionar veículo'}</Button>
      </div>
    </div>
  </form>
}
