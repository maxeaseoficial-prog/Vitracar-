// Catálogo externo fixado num commit: mudanças no repositório de origem
// não alteram a VitraCar sem uma atualização deliberada desta versão.
export type CatalogCar = {
  id:string; brand:string; model:string; years:[number,number]; category:string; file:string; bytes:number
  paint:null | { materials:string[]; textured:boolean; confidence:string }
  credit: { author:string; authorUrl:string|null; sourceName:string|null; sourceUrl:string|null; license:string }
}
type Manifest = { count:number; cars:CatalogCar[] }
const manifestUrl = import.meta.env.VITE_CAR_MANIFEST_URL || 'https://raw.githubusercontent.com/pedrosoandre/carros/2d18dfd9db96bbf0d9cffa949deaf7f571388cbf/cars.json'
const assetsUrl = (import.meta.env.VITE_CAR_ASSET_BASE_URL || 'https://cdn.jsdelivr.net/gh/pedrosoandre/carros@2d18dfd9db96bbf0d9cffa949deaf7f571388cbf/assets').replace(/\/$/, '')
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
  verde:'#2fb66d', amarelo:'#f6c343', amarela:'#f6c343', bege:'#d9c9ac'
}
export const paintColor = (color:string) => {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  return colors[color.toLowerCase().trim()] ?? '#697b98'
}


// Alguns arquivos no catálogo externo não representam veículos completos.
// O arquivo Chevette contém somente o motor; o Caravan contém vários
// elementos dispersos. Não oferecer esses GLBs como carros funcionais.
const invalidModelReasons: Record<string,string> = {
  'chevrolet-chevette': 'O arquivo original contém somente o motor.',
  'chevrolet-caravan': 'O arquivo original possui vários elementos dispersos, não um carro único.'
}
export function modelQualityIssue(car: CatalogCar): string | null {
  if (invalidModelReasons[car.id]) return invalidModelReasons[car.id]
  if (/^(engine|motor)\b/i.test(car.credit.sourceName?.trim() || '')) {
    return 'Este arquivo original representa um componente mecânico, não o carro completo.'
  }
  return null
}
export function isUsableModel(car: CatalogCar): boolean {
  return !modelQualityIssue(car)
}
export function getModelThumbnailUrl(car: CatalogCar): string | null {
  const source = car.credit.sourceUrl || ''
  const match = source.match(/([a-f0-9]{32})(?:\/)?(?:[?#].*)?$/i)
  return match ? '/api/vehicle-image?uid=' + match[1].toLowerCase() : null
}
