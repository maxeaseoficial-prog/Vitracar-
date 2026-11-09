import { Check, Pipette } from 'lucide-react'
import { paintColor } from '../../lib/catalog'

const presets = [
  {name:'Prata',hex:'#9ba5b3'},
  {name:'Preto',hex:'#141a25'},
  {name:'Branco',hex:'#f2f4f8'},
  {name:'Cinza',hex:'#646f7c'},
  {name:'Azul',hex:'#1259bf'},
  {name:'Vermelho',hex:'#b4242f'},
  {name:'Verde',hex:'#2fb66d'},
  {name:'Amarelo',hex:'#f6c343'},
  {name:'Bege',hex:'#d9c9ac'},
]

export function ColorSwatches({value,onChange,canRepaint,allowOriginal=false}:{
  value:string
  onChange:(next:string)=>void
  canRepaint:boolean
  allowOriginal?:boolean
}){
  const custom=/^#[0-9a-f]{6}$/i.test(value)
  const original=value.toLowerCase()==='original'
  return <div className="v-color-panel">
    <div className="v-color-topline"><span className="v-studio-step">02</span><strong>Personalize a pintura</strong>
      <span className="v-color-selected">{custom?'Personalizada':original?'Cor original':value}</span></div>
    <div className="v-color-options" role="group" aria-label="Escolha a cor do veículo">
      {allowOriginal&&<button type="button" title="Cor original do modelo" aria-label="Manter a cor original do modelo"
        aria-pressed={original} onClick={()=>onChange('Original')} className={`v-swatch v-swatch-original ${original?'active':''}`}>
        {original?<Check size={16} color="#18243c" strokeWidth={3}/>:<span>ORIG</span>}</button>}
      {presets.map(p=><button key={p.name} type="button" title={p.name}
        aria-label={`Selecionar cor ${p.name}`} aria-pressed={!custom&&value.toLowerCase()===p.name.toLowerCase()}
        onClick={()=>onChange(p.name)} className={`v-swatch ${!custom&&value.toLowerCase()===p.name.toLowerCase()?'active':''}`}
        style={{background:p.hex}}>
        {!custom&&value.toLowerCase()===p.name.toLowerCase()&&<Check size={16} color={p.name==='Branco'||p.name==='Amarelo'||p.name==='Bege'?'#18243c':'#fff'} strokeWidth={3}/>}
      </button>)}
      <label className={`v-color-custom ${custom?'active':''}`} title="Escolher cor personalizada">
        <Pipette size={17}/><input type="color" value={paintColor(value)} aria-label="Escolher cor personalizada"
          onChange={e=>onChange(e.target.value.toUpperCase())}/></label>
    </div>
    {!canRepaint&&<p className="v-color-warning">A pintura deste arquivo 3D não pode ser alterada com segurança. A cor será salva corretamente no cadastro.</p>}
  </div>
}
