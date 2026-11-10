import {useMemo,useState} from 'react'
import {Search,Package,Plus,Check} from 'lucide-react'
import {Link} from 'react-router-dom'
import {Modal} from '../Modal'
import {Button,ErrorText,Loading} from '../UI'
import {ProductPhoto} from './ProductPhoto'
import {useInventory} from '../../lib/inventory-store'
import {packageLabel,quantityLabel,type InventoryProduct} from '../../lib/inventory'
import {escapeSearch,money} from '../../lib/utils'
import './inventory.css'
export function InventoryPicker({onChoose,onClose,selected=[]}:{onChoose:(p:InventoryProduct)=>void;onClose:()=>void;selected?:string[]}){
 const {products,loading,error,reload}=useInventory(),[search,setSearch]=useState('')
 const rows=useMemo(()=>products.filter(p=>p.active&&escapeSearch(p.name+' '+p.category).includes(escapeSearch(search))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),[products,search])
 return <Modal title='Selecionar produto do estoque' onClose={onClose} wide><p className='inv-help'>Custo de compra e embalagem vêm do cadastro. Você informa apenas quanto usará na lavagem. Esta seleção não dá baixa no estoque.</p><div className='inv-search'><Search size={17}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} aria-label='Buscar produto no estoque' placeholder='Buscar shampoo, cera, aromatizante...'/></div><ErrorText message={error}/>{error&&<Button variant='secondary' onClick={()=>void reload()}>Tentar novamente</Button>}{loading?<Loading label='Carregando produtos...'/>:<div className='inv-picker-list'>{rows.map(p=><button type='button' key={p.id} className='inv-picker-row' disabled={selected.includes(p.id)} onClick={()=>onChoose(p)}><ProductPhoto product={p}/><span><strong>{p.name}</strong><small>{packageLabel(p)} · {quantityLabel(p.stock_quantity)} embalagens / un. em estoque</small></span><b>{money(p.cost_cents)}</b>{selected.includes(p.id)?<Check size={18}/>:<Plus size={18}/>}</button>)}{!rows.length&&<div className='inv-empty'><Package size={32}/><strong>{search?'Nenhum produto encontrado':'Cadastre seus primeiros produtos'}</strong><Link to='/estoque'>Abrir estoque</Link></div>}</div>}</Modal>
}
