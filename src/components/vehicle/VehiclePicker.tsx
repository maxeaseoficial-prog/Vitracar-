import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CarFront, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import type { CatalogCar } from '../../lib/catalog'
import { categories } from '../../lib/catalog'
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

function VehicleSilhouette({ category }: { category: string }) {
  const tall = ['suv','pickup','van','utility','minivan'].includes(category)
  return <svg className="v-pick-illustration" viewBox="0 0 156 84" aria-hidden="true">
    <defs>
      <linearGradient id="vehicle-silhouette-gradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#6e94c9" stopOpacity=".74"/>
        <stop offset="1" stopColor="#244c8f" stopOpacity=".92"/>
      </linearGradient>
    </defs>
    <ellipse cx="80" cy="69" rx="61" ry="7" fill="#bcd0eb" opacity=".35"/>
    <path fill="url(#vehicle-silhouette-gradient)"
      d={tall
        ? 'M16 49 L23 34 Q25 28 38 26 L52 25 L64 12 Q68 8 78 8 L112 8 Q121 8 126 18 L134 42 L144 48 L144 62 L12 62 L12 54 Z'
        : 'M13 49 L28 43 L50 39 L65 23 Q69 18 81 18 L109 19 Q118 19 123 28 L132 42 L144 49 L147 61 L10 61 Z'}/>
    <path fill="#d8ebff" opacity=".72" d={tall
      ? 'M67 16 L113 16 Q118 16 121 24 L126 42 L51 42 Z'
      : 'M68 26 Q73 24 82 24 L110 25 Q115 25 119 33 L124 42 L52 41 Z'}/>
    <path d="M80 23 L81 43 M51 41 L126 43" stroke="#3e6094" strokeWidth="2" opacity=".7"/>
    <circle cx="42" cy="61" r="15" fill="#1d2d45"/><circle cx="42" cy="61" r="8" fill="#ccd6e6"/>
    <circle cx="116" cy="61" r="15" fill="#1d2d45"/><circle cx="116" cy="61" r="8" fill="#ccd6e6"/>
    <path d="M14 52 L24 49 M135 49 L145 52" stroke="#c1dfff" strokeWidth="4" strokeLinecap="round"/>
  </svg>
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
            <span className="v-pick-art"><VehicleSilhouette category={car.category}/><span className="v-pick-3d">3D</span></span>
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
