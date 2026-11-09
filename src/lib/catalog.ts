// Catálogo externo fixado num commit: mudanças no repositório de origem
// não alteram a VitraCar sem uma atualização deliberada desta versão.
export type CatalogCar = {
  id:string; brand:string; model:string; years:[number,number]; category:string; file:string; bytes:number
  // Índices (na ordem de materialOrder) dos materiais da lataria, detectados
  // pelo gerador do catálogo. Vazio: a cor original não pode ser trocada.
  paint:number[]
  // Alternativa para arquivos de textura única: recolore só os pixels de
  // pintura (cor base) da textura destes materiais, preservando vidros e faróis.
  tint?:{materials:number[];base:[number,number,number]}|null
  // Foto com fundo branco gerada a partir do próprio modelo 3D.
  photo:boolean
  // Motivo pelo qual o arquivo não representa um carro completo.
  issue:string|null
  credit: { author:string; authorUrl:string|null; sourceName:string|null; sourceUrl:string|null; license:string }
}
const assetsUrl = (import.meta.env.VITE_CAR_ASSET_BASE_URL || 'https://cdn.jsdelivr.net/gh/pedrosoandre/carros@2d18dfd9db96bbf0d9cffa949deaf7f571388cbf/assets').replace(/\/$/, '')
let cache: Promise<CatalogCar[]> | undefined
// Catálogo gerado por tools/car-catalog (fotos, lataria e validação de cada GLB).
// Carregado sob demanda para não pesar na primeira tela.
export const getCatalog = () => {
  cache ??= import('../data/car-catalog.json').then(m => (m.default.cars as unknown as CatalogCar[]))
    .catch(error => { cache = undefined; throw error })
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
export const ORIGINAL_COLOR = 'Original'
export const isOriginalColor = (color:string) => color.trim().toLowerCase() === 'original'
export const paintColor = (color:string) => {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (isOriginalColor(color)) return '#9ba5b3'
  return colors[color.toLowerCase().trim()] ?? '#697b98'
}


export function modelQualityIssue(car: CatalogCar): string | null {
  return car.issue
}
export function isUsableModel(car: CatalogCar): boolean {
  return !modelQualityIssue(car)
}
export function getModelThumbnailUrl(car: CatalogCar): string | null {
  return car.photo ? '/car-thumbs/' + car.id + '.webp' : null
}
