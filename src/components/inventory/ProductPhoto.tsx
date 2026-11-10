import {useEffect,useState} from 'react'
import {Package,ShoppingBag,SprayCan} from 'lucide-react'
import {useInventory} from '../../lib/inventory-store'
import type {InventoryProduct} from '../../lib/inventory'
export function ProductPhoto({product,className='',preview}:{product:Pick<InventoryProduct,'name'|'kind'|'photo_path'>;className?:string;preview?:string|null}){
 const {photoUrl}=useInventory(),[url,setUrl]=useState<string|null>(null),[failed,setFailed]=useState(false)
 useEffect(()=>{let active=true;setUrl(null);setFailed(false);if(product.photo_path)void photoUrl(product.photo_path).then(u=>{if(active)setUrl(u)});return()=>{active=false}},[product.photo_path,photoUrl,preview])
 const Icon=product.kind==='supply'?SprayCan:product.kind==='resale'?ShoppingBag:Package
 return <div className={`inventory-photo ${className}`}>{!failed&&(preview||url)?<img src={preview||url!} alt={product.name} loading='lazy' decoding='async' onError={()=>setFailed(true)}/>:<Icon size={38} strokeWidth={1.4} aria-hidden='true'/>}</div>
}
