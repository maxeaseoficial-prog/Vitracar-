import { useGLTF } from '@react-three/drei'
import { getAssetUrl, isUsableModel, type CatalogCar } from './catalog'

// Drei já compartilha GLBs decodificados em memória por URL.
// O pré-carregamento seletivo aquece esse cache sem baixar os 2 GB do catálogo.
// Nunca iniciar downloads de arquivos grandes apenas porque o mouse passou no card.
const preloading = new Set<string>()
export function warmModel(car: CatalogCar | null | undefined) {
  if (!car || !isUsableModel(car) || car.bytes <= 0 || car.bytes > 4_000_000) return
  const url = getAssetUrl(car)
  if (preloading.has(url)) return
  preloading.add(url)
  try { useGLTF.preload(url) }
  catch { preloading.delete(url) }
}
