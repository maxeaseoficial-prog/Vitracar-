import { Box3, CanvasTexture, Vector3, type Color, type Material, type Mesh, type Object3D, type Texture } from 'three'

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

// ---------------------------------------------------------------------------
// Recoloração por textura: para arquivos em que lataria, faróis e grade estão
// na mesma imagem (um material só). Em vez de trocar o material inteiro, só os
// pixels com a cor da pintura original mudam; brilho e sombras são mantidos.

type RGB = [number, number, number]
const luma = ([r, g, b]: RGB) => (0.299 * r + 0.587 * g + 0.114 * b) / 255
const sat = ([r, g, b]: RGB) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0 }
const hue = ([r, g, b]: RGB) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (!d) return 0
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

function imageData(image: CanvasImageSource & { width: number; height: number }) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width; canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height) }
}

// Cor de pintura = cor mais comum na superfície visível (amostrada pelos UVs
// dos triângulos, ponderada pela área), não a mais comum na imagem.
export function dominantTextureColor(model: Object3D, material: Material & { map?: { image?: unknown } | null }): RGB | null {
  const image = material.map?.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!image?.width) return null
  const { data } = imageData(image)
  const bins = new Map<number, { w: number; c: [number, number, number] }>()
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  model.traverse(o => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!mats.includes(material)) return
    const geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index
    if (!pos || !uv) return
    const count = idx ? idx.count : pos.count
    const step = Math.max(3, Math.floor(count / 3 / 20000) * 3)
    for (let i = 0; i + 2 < count; i += step) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2)
      const w = b.sub(a).cross(c.sub(a)).length()
      if (!w) continue
      let u = (uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3, v = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3
      u = u - Math.floor(u); v = v - Math.floor(v)
      const x = Math.min(data.width - 1, Math.floor(u * data.width)), y = Math.min(data.height - 1, Math.floor(v * data.height))
      const p = (y * data.width + x) * 4, r = data.data[p], g = data.data[p + 1], bl = data.data[p + 2]
      const key = (r >> 4) << 8 | (g >> 4) << 4 | (bl >> 4)
      const bin = bins.get(key) || { w: 0, c: [0, 0, 0] }
      bin.w += w; bin.c[0] += r * w; bin.c[1] += g * w; bin.c[2] += bl * w
      bins.set(key, bin)
    }
  })
  let best: { w: number; c: [number, number, number] } | undefined
  for (const bin of bins.values()) if (!best || bin.w > best.w) best = bin
  return best ? [best.c[0] / best.w, best.c[1] / best.w, best.c[2] / best.w] : null
}

// Pixel pertence à pintura? Cores neutras (preto, branco, prata) comparam
// brilho e saturação; cores vivas comparam o tom.
export function isPaintTexel(px: RGB, base: RGB) {
  const Sb = sat(base), S = sat(px), Lb = luma(base), L = luma(px)
  if (Sb < 0.22) return S < 0.22 && Math.abs(L - Lb) < 0.22
  const dh = Math.abs(hue(px) - hue(base)), h = Math.min(dh, 360 - dh)
  return h < 22 && S > Sb * 0.45 && L > 0.04
}

// Pixels da textura usados por vidros: triângulos acima da linha de cintura
// (inteiros acima de 55% da altura) e não quase horizontais (o teto continua pintável). Na textura,
// vidro escuro e pintura preta têm a mesma cor; a posição no carro separa.
export function glassMask(model: Object3D, material: Material, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  model.updateMatrixWorld(true)
  const box = new Box3().setFromObject(model)
  const belt = box.min.y + (box.max.y - box.min.y) * 0.55
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3(), e1 = new Vector3(), e2 = new Vector3()
  model.traverse(o => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!mats.includes(material)) return
    const geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index
    if (!pos || !uv) return
    const count = idx ? idx.count : pos.count
    for (let i = 0; i + 2 < count; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2
      a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld)
      if (Math.min(a.y, b.y, c.y) < belt) continue
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize()
      if (Math.abs(n.y) > 0.72) continue
      ctx.beginPath()
      ctx.moveTo(uv.getX(i0) * width, uv.getY(i0) * height)
      ctx.lineTo(uv.getX(i1) * width, uv.getY(i1) * height)
      ctx.lineTo(uv.getX(i2) * width, uv.getY(i2) * height)
      ctx.closePath(); ctx.fill()
    }
  })
  return ctx.getImageData(0, 0, width, height).data
}

export function recolorTexture(source: Texture, base: RGB, target: Color, keep?: Uint8ClampedArray): CanvasTexture | null {
  const image = source.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!image?.width) return null
  const { canvas, ctx, data } = imageData(image)
  const Lb = Math.max(luma(base), 0.06)
  // A textura está em sRGB; a cor do three.js fica em espaço linear.
  const t = target.clone().convertLinearToSRGB()
  const tr = t.r * 255, tg = t.g * 255, tb = t.b * 255
  const d = data.data
  for (let i = 0; i < d.length; i += 4) {
    if (keep && keep[i + 3] > 0) continue
    const px: RGB = [d[i], d[i + 1], d[i + 2]]
    if (!isPaintTexel(px, base)) continue
    // Mantém sombra e reflexo: variação de brilho em torno da cor original.
    const shade = Math.min(1.6, Math.max(0.45, 1 + (luma(px) - Lb) * 1.6))
    d[i] = Math.min(255, tr * shade); d[i + 1] = Math.min(255, tg * shade); d[i + 2] = Math.min(255, tb * shade)
  }
  ctx.putImageData(data, 0, 0)
  const out = new CanvasTexture(canvas)
  out.flipY = source.flipY; out.colorSpace = source.colorSpace; out.wrapS = source.wrapS; out.wrapT = source.wrapT
  out.channel = source.channel; out.repeat.copy(source.repeat); out.offset.copy(source.offset)
  out.needsUpdate = true
  return out
}
