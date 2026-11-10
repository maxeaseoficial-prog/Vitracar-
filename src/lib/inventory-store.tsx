import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react'
import {supabase} from './supabase'
import {useStore} from './store'
import {uuid} from './utils'
import {validateProduct,type InventoryProduct,type ProductInput,type InventoryMovement,type MovementKind} from './inventory'
interface InventoryState {products:InventoryProduct[];loading:boolean;error:string|null;ensure():Promise<void>;reload():Promise<void>;saveProduct(product:ProductInput,initial:number,version?:number):Promise<string>;move(id:string,productId:string,kind:MovementKind,quantity:number,cost:number|null,notes:string):Promise<void>;history(productId:string):Promise<InventoryMovement[]>;uploadPhoto(productId:string,file:File):Promise<string>;photoUrl(path:string):Promise<string|null>}
const Context=createContext<InventoryState|null>(null)
/** Mounted inside the authenticated data provider. Catalog loads only when a feature asks for it. */
export function InventoryProvider({children}:{children:ReactNode}){
 const {company,profile,isDemo}=useStore(),cid=company.id
 const [products,setProducts]=useState<InventoryProduct[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null)
 const loaded=useRef(false),flight=useRef<Promise<void>|null>(null),sequence=useRef(0),alive=useRef(true)
 const records=useRef<InventoryProduct[]>([]),demoMoves=useRef<InventoryMovement[]>([])
 const signed=useRef(new Map<string,{until:number;url:string}>())
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;signed.current.clear()}},[])
 const reload=useCallback(async()=>{
  const request=++sequence.current
  if(isDemo){loaded.current=true;return}
  setLoading(true);setError(null)
  try{
   if(!supabase)throw Error('Banco indisponível.')
   const rows:InventoryProduct[]=[]
   for(let from=0;;from+=500){const result=await supabase.from('inventory_products').select('*').eq('company_id',cid).order('id').range(from,from+499);if(result.error)throw result.error;rows.push(...(result.data||[]) as InventoryProduct[]);if(!result.data||result.data.length<500)break}
   if(alive.current&&request===sequence.current){records.current=rows;setProducts(rows);loaded.current=true}
  }catch(cause){if(alive.current&&request===sequence.current){setError(cause instanceof Error?cause.message:(cause as {message?:string})?.message||'Não foi possível carregar o estoque.');loaded.current=false}}
  finally{if(alive.current&&request===sequence.current)setLoading(false)}
 },[cid,isDemo])
 const ensure=useCallback(()=>{if(loaded.current)return Promise.resolve();if(!flight.current)flight.current=reload().finally(()=>{flight.current=null});return flight.current},[reload])
 const commit=useCallback((next:InventoryProduct[])=>{records.current=next;setProducts(next)},[])
 const saveProduct=useCallback(async(p:ProductInput,initial:number,version?:number)=>{
  validateProduct(p)
  if(!Number.isFinite(initial)||initial<0||initial>1000000||Math.abs(initial*1000-Math.round(initial*1000))>1e-6)throw Error('Confira o saldo inicial; use até 3 casas decimais.')
  if(isDemo){const previous=records.current.find(x=>x.id===p.id);if(previous&&version===undefined)return p.id;if(previous&&previous.version!==version)throw Error('Produto alterado. Abra novamente.');const row:InventoryProduct={...previous,...p,company_id:cid,stock_quantity:previous?.stock_quantity??initial,version:(previous?.version??-1)+1,created_at:previous?.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};commit(previous?records.current.map(x=>x.id===p.id?row:x):[row,...records.current]);return p.id}
  if(!supabase)throw Error('Banco indisponível.')
  const result=await supabase.rpc('save_inventory_product',{p_product:p,p_initial_quantity:initial,p_expected_version:version??null});if(result.error)throw result.error
  await reload();return result.data as string
 },[cid,commit,isDemo,reload])
 const move=useCallback(async(id:string,productId:string,kind:MovementKind,quantity:number,cost:number|null,notes:string)=>{
  if(!Number.isFinite(quantity)||quantity===0||Math.abs(quantity)>1000000||Math.abs(quantity*1000-Math.round(quantity*1000))>1e-6)throw Error('Informe uma quantidade válida, com até 3 casas decimais.')
  if(isDemo){if(demoMoves.current.some(m=>m.id===id))return;const p=records.current.find(x=>x.id===productId);if(!p||!p.active)throw Error('Produto indisponível.');if(p.stock_quantity+quantity<0)throw Error('Saldo insuficiente em estoque.');if(kind==='adjustment'&&notes.trim().length<3)throw Error('Explique o motivo do ajuste.');const row:InventoryMovement={id,company_id:cid,product_id:productId,kind,quantity,quantity_before:p.stock_quantity,quantity_after:p.stock_quantity+quantity,unit_cost_cents:cost??p.cost_cents,notes,created_by:profile.id,created_at:new Date().toISOString()};demoMoves.current.unshift(row);commit(records.current.map(x=>x.id===productId?{...x,stock_quantity:row.quantity_after,cost_cents:kind==='purchase'?cost??x.cost_cents:x.cost_cents,version:x.version+1}:x));return}
  if(!supabase)throw Error('Banco indisponível.')
  const result=await supabase.rpc('move_inventory',{p_id:id,p_product_id:productId,p_kind:kind,p_quantity:quantity,p_unit_cost_cents:cost,p_notes:notes.trim()||null});if(result.error)throw result.error
  await reload()
 },[cid,commit,isDemo,profile.id,reload])
 const history=useCallback(async(productId:string)=>{if(isDemo)return demoMoves.current.filter(x=>x.product_id===productId);if(!supabase)throw Error('Banco indisponível.');const result=await supabase.from('inventory_movements').select('*').eq('company_id',cid).eq('product_id',productId).order('created_at',{ascending:false}).order('id').limit(100);if(result.error)throw result.error;return (result.data||[]) as InventoryMovement[]},[cid,isDemo])
 const uploadPhoto=useCallback(async(productId:string,file:File)=>{
  if(isDemo)throw Error('Fotos ficam disponíveis com o banco conectado.')
  if(!supabase)throw Error('Banco indisponível.')
  if(file.size>5242880||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.')
  let blob:Blob=file,extension=file.type==='image/png'?'png':file.type==='image/jpeg'?'jpg':'webp'
  const bitmap=await createImageBitmap(file).catch(()=>{throw Error('Não foi possível ler esta foto. Escolha outra imagem.')})
  try{const factor=Math.min(1,1024/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*factor));canvas.height=Math.max(1,Math.round(bitmap.height*factor));const ctx=canvas.getContext('2d');if(ctx){ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const optimized=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.85));if(optimized){blob=optimized;extension='webp'}}}finally{bitmap.close()}
  const path=`${cid}/${productId}/${uuid()}.${extension}`
  const result=await supabase.storage.from('inventory-photos').upload(path,blob,{contentType:blob.type,upsert:false});if(result.error)throw result.error;return path
 },[cid,isDemo])
 const photoUrl=useCallback(async(path:string)=>{if(!path.startsWith(cid+'/'))return null;const cached=signed.current.get(path);if(cached&&cached.until>Date.now())return cached.url;if(!supabase||isDemo)return null;const {data,error}=await supabase.storage.from('inventory-photos').createSignedUrl(path,3600);if(error||!data?.signedUrl)return null;signed.current.set(path,{url:data.signedUrl,until:Date.now()+3300000});return data.signedUrl},[cid,isDemo])
 const value=useMemo(()=>({products,loading,error,ensure,reload,saveProduct,move,history,uploadPhoto,photoUrl}),[products,loading,error,ensure,reload,saveProduct,move,history,uploadPhoto,photoUrl])
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useInventory(){const ctx=useContext(Context);if(!ctx)throw Error('Estoque não inicializado.');useEffect(()=>{void ctx.ensure()},[ctx.ensure]);return ctx}
