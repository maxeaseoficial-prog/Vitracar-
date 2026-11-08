export type CatalogCar = {
  id:string; brand:string; model:string; years:[number,number]; category:string; file:string
  paint:null | { materials:string[]; textured:boolean; confidence:string }
  credit: { author:string; authorUrl:string|null; sourceName:string|null; sourceUrl:string|null; license:string }
}
type Manifest = { count:number; cars:CatalogCar[] }
const manifestUrl = import.meta.env.VITE_CAR_MANIFEST_URL || 'https://raw.githubusercontent.com/pedrosoandre/carros/main/cars.json'
const assetsUrl = (import.meta.env.VITE_CAR_ASSET_BASE_URL || 'https://cdn.jsdelivr.net/gh/pedrosoandre/carros@main/assets').replace(/\/$/, '')
let cache: Promise<CatalogCar[]> | undefined
export const getCatalog = () => {
  cache ??= fetch(manifestUrl).then(async r => {
    if (!r.ok) throw new Error('Catálogo 3D indisponível')
    const data = await r.json() as Manifest
    if (!Array.isArray(data.cars)) throw new Error('Catálogo inválido')
    return data.cars
  }).catch(error => { cache = undefined; throw error })
  return cache
}
export const getAssetUrl = (car: CatalogCar) => assetsUrl + '/' + encodeURIComponent(car.file)
export const categories: Record<string,string> = {
  hatchback:'Hatch', sedan:'Sedã', suv:'SUV', pickup:'Picape',
  wagon:'Perua', minivan:'Minivan', van:'Van', coupe:'Cupê',
  sports:'Esportivo', utility:'Utilitário'
}
const colors:Record<string,string> = {
  branco:'#f2f4f8', preta:'#141a25', preto:'#141a25', prata:'#9ba5b3',
  cinza:'#646f7c', vermelho:'#b4242f', vermelha:'#b4242f', azul:'#1259bf',
  verde:'#367b61', amarelo:'#f6c343', amarela:'#f6c343', bege:'#d9c9ac'
}
export const paintColor = (color:string) => {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  return colors[color.toLowerCase().trim()] ?? '#697b98'
}
