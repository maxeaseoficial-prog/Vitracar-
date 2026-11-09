import { Vector3, type Material, type Mesh, type Object3D } from 'three'

// Nomes que quase nunca são lataria (faróis, lanternas, vidros, pneus etc.).
// Termos longos valem como parte do nome (headlight, sidewindow); os curtos
// precisam ser palavra inteira ("rim" não pode pegar "primary").
export const NON_BODY = /glass|vidro|window|windshield|light|lamp|farol|lantern|tire|tyre|pneu|rubber|wheel|chrome|cromo|interior|mirror|engine|exhaust|brake|caliper|indicator|signal|reflector|emblem|badge|grill|plate|placa|banco|seat|(?:^|[^a-z])(?:rim|roda|led|lens|logo|disc|neon|grade|tail|head|motor)(?:[^a-z]|$)/i

export const BODY_HINT = /body|paint|lataria|pintura|carroceria|primary|exterior|shell|chassis|carpaint/i

// Materiais em ordem de percurso (índice estável para o mesmo GLB). O gerador
// do catálogo e o visualizador usam esta mesma ordem para achar a lataria.
export function materialOrder(model: Object3D): Material[] {
  const order: Material[] = []
  model.traverse(o => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (!order.includes(m)) order.push(m)
  })
  return order
}

function triangleArea(mesh: Mesh, start: number, count: number) {
  const geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index
  if (!pos) return 0
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), s = new Vector3()
  mesh.getWorldScale(s)
  const scale = Math.abs(s.x * s.y * s.z) ** (2 / 3)
  let total = 0
  const end = Math.min(start + count, idx ? idx.count : pos.count)
  for (let i = start; i + 2 < end; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2)
    total += b.sub(a).cross(c.sub(a)).length() / 2
  }
  return total * scale
}

// Conjuntos candidatos a lataria: os materiais de maior área visível que não
// parecem vidro, farol, pneu etc. O gerador testa cada um e grava o melhor.
export function paintableMaterials(model: Object3D) {
  model.updateMatrixWorld(true)
  const order = materialOrder(model)
  const area = new Array(order.length).fill(0)
  model.traverse(o => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const groups = mesh.geometry.groups.length ? mesh.geometry.groups : [{ start: 0, count: Infinity, materialIndex: 0 }]
    for (const g of groups) {
      const m = mats[g.materialIndex ?? 0]
      if (m) area[order.indexOf(m)] += triangleArea(mesh, g.start, g.count)
    }
  })
  const eligible = order.map((m, i) => i).filter(i => {
    const m = order[i] as Material & { transmission?: number }
    return !NON_BODY.test(m.name || '') && m.opacity >= 0.9 && !(m.transmission && m.transmission > 0.2)
  }).sort((x, y) => area[y] - area[x])
  const candidates: number[][] = []
  const add = (set: number[]) => { if (set.length && !candidates.some(c => c.join() === set.join())) candidates.push(set) }
  // Maiores áreas, isoladas e somadas (a lataria às vezes vem dividida em várias peças).
  eligible.slice(0, 3).forEach(i => add([i]))
  for (let n = 2; n <= Math.min(6, eligible.length); n++) add(eligible.slice(0, n))
  // Lataria dividida em peças costuma repetir a mesma cor de fábrica: testa
  // cada grupo de materiais com a mesma cor base entre os de maior área.
  const byColor = new Map<string, number[]>()
  for (const i of eligible.slice(0, 24)) {
    const m = order[i] as Material & { color?: { getHexString(): string }, map?: unknown }
    const key = (m.color ? m.color.getHexString() : '') + (m.map ? '+tex' : '')
    byColor.set(key, [...(byColor.get(key) || []), i])
  }
  for (const group of byColor.values()) if (group.length > 1) add(group)
  // Materiais cujo nome indica lataria, juntos e separados.
  const named = eligible.filter(i => BODY_HINT.test(order[i].name || ''))
  add(named)
  named.forEach(i => add([i]))
  return { order, area, candidates }
}
