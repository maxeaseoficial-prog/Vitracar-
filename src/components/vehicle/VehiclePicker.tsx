import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CarFront, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import type { CatalogCar } from '../../lib/catalog'
import { categories, getModelThumbnailUrl } from '../../lib/catalog'
import { escapeSearch } from '../../lib/utils'

const PAGE_SIZE = 8
const popular = ['Chevrolet','Fiat','Volkswagen','Toyota','Honda','Hyundai','Jeep','Ford','Renault','Nissan','Peugeot','BYD']

type Props = {
  cars: CatalogCar[]
  selectedId: string
  loading: boolean
  error: string | null
  onSelect: (car: CatalogCar) => void
  onRetry: () => void
}

function VehiclePhoto({car}:{car:CatalogCar}){
  const [failed,setFailed]=useState(false)
  const [loaded,setLoaded]=useState(false)
  // Referência para a fotografia original do mesmo modelo 3D.
  const thumbnail=getModelThumbnailUrl(car)
  useEffect(()=>{setFailed(false);setLoaded(false)},[thumbnail])
  return <span className="v-pick-photo-frame">
    {thumbnail&&!failed&&<img src={thumbnail} loading="lazy" decoding="async"
      alt={`Prévia real: ${car.brand} ${car.model}`}
      className={loaded?'v-pick-photo loaded':'v-pick-photo'}
      onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/>}
    {(!thumbnail||failed||!loaded)&&<span className="v-pick-photo-placeholder">
      <CarFront size={28} strokeWidth={1.45}/>
      <small>{failed||!thumbnail?'Prévia indisponível':'Carregando foto...'}</small>
    </span>}
  </span>
}

export function VehiclePicker({cars,selectedId,loading,error,onSelect,onRetry}:Props) {
  const [query,setQuery] = useState('')
  const [brand,setBrand] = useState('all')
  const [page,setPage] = useState(0)
  const brands = useMemo(()=>[...new Set(cars.map(c=>c.brand))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[cars])
  const filtered = useMemo(()=>{
    const q = escapeSearch(query.trim())
    return cars.filter(c=>(brand==='all'||c.brand===brand) &&
      (!q || escapeSearch([c.brand,c.model,c.id,c.category,c.years[0],c.years[1]].join(' ')).includes(q)))
      .sort((a,b)=>{
        if(!query.trim() && brand==='all'){
          const ai=popular.indexOf(a.brand),bi=popular.indexOf(b.brand)
          if(ai!==bi)return (ai<0?999:ai)-(bi<0?999:bi)
        }
        return (a.brand+' '+a.model).localeCompare(b.brand+' '+b.model,'pt-BR')
      })
  },[cars,brand,query])
  useEffect(()=>setPage(0),[brand,query])
  useEffect(()=>{
    if(!selectedId||!filtered.length)return
    const index=filtered.findIndex(c=>c.id===selectedId)
    if(index!==-1)setPage(Math.floor(index/PAGE_SIZE))
  },[selectedId,filtered])
  const totalPages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))
  const visible = filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)
  const selectedIndex = filtered.findIndex(c=>c.id===selectedId)
  const selectAdjacent = (shift:number) => {
    if(!filtered.length)return
    const nextIndex = selectedIndex<0 ? (shift>0?0:filtered.length-1) :
      (selectedIndex + shift + filtered.length)%filtered.length
    onSelect(filtered[nextIndex])
  }

  return <section className="v-pick-shell" aria-label="Selecionar veículo 3D">
    <div className="v-studio-section-title">
      <div><span className="v-studio-step">01</span><strong>Encontre seu veículo</strong>
        <p>Selecione um modelo para visualizar em 3D.</p></div>
      <span className="v-pick-count">{cars.length} modelos</span>
    </div>
    <div className="v-pick-filters">
      <label className="v-pick-search"><Search size={17}/><input type="search" value={query}
        onChange={e=>setQuery(e.target.value)} placeholder="Buscar marca ou modelo (ex.: Civic, Onix)"
        aria-label="Buscar carros por marca ou modelo"/></label>
      <label className="v-pick-brand"><SlidersHorizontal size={15}/>
        <select value={brand} onChange={e=>setBrand(e.target.value)} aria-label="Filtrar pela marca">
          <option value="all">Todas as marcas</option>
          {brands.map(b=><option value={b} key={b}>{b}</option>)}
        </select>
      </label>
    </div>
    {loading?<div className="v-pick-message"><CarFront size={26}/><strong>Carregando catálogo de veículos...</strong><small>Preparando a lista de modelos 3D.</small></div>:
      error?<div className="v-pick-message"><CarFront size={26}/><strong>Não foi possível carregar o catálogo</strong>
        <small>{error}</small><button type="button" className="btn btn-secondary btn-small" onClick={onRetry}>Tentar novamente</button></div>:
      filtered.length===0?<div className="v-pick-message"><Search size={25}/><strong>Nenhum modelo encontrado</strong>
        <small>Experimente outra marca ou nome. Também é possível cadastrar um veículo sem 3D.</small></div>:
      <>
        <div className="v-pick-grid">
          {visible.map(car=><button key={car.id} type="button" className={`v-pick-card ${selectedId===car.id?'selected':''}`}
            onClick={()=>onSelect(car)} aria-pressed={selectedId===car.id}
            title={`${car.brand} ${car.model} · ${car.years[0]} a ${car.years[1]}`}>
            <span className="v-pick-art"><VehiclePhoto car={car}/><span className="v-pick-3d">3D</span></span>
            <span className="v-pick-make">{car.brand}</span>
            <strong className="v-pick-model">{car.model}</strong>
            <small>{categories[car.category]||'Veículo'} · {car.years[0]}–{car.years[1]}</small>
            {selectedId===car.id&&<span className="v-pick-selected">Selecionado</span>}
          </button>)}
        </div>
        <div className="v-pick-pagination">
          <span>{filtered.length} resultados · Página {page+1} de {totalPages}</span>
          <div className="v-pick-pager-actions">
            <button type="button" onClick={()=>selectAdjacent(-1)} title="Ver modelo anterior"><ArrowLeft size={16}/></button>
            <button type="button" onClick={()=>selectAdjacent(1)} title="Ver próximo modelo"><ArrowRight size={16}/></button>
            <span className="v-pick-divider"/>
            <button type="button" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
              aria-label="Página anterior"><ChevronLeft size={16}/></button>
            <button type="button" onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}
              aria-label="Próxima página"><ChevronRight size={16}/></button>
          </div>
        </div>
      </>}
  </section>
}
