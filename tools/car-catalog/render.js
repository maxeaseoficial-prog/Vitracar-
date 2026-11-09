// Renderiza cada GLB do catálogo com fundo branco (foto do card) e descobre,
// por teste visual, quais materiais formam a lataria. Executado por build.mjs.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { paintableMaterials, NON_BODY, dominantTextureColor, recolorTexture, glassMask } from '../../src/lib/paint.ts'

const W = 640, H = 400
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(W, H)
renderer.setPixelRatio(1)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)
const pmrem = new THREE.PMREMGenerator(renderer)
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

const draco = new DRACOLoader().setDecoderPath('/node_modules/three/examples/jsm/libs/draco/gltf/')
const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder)

function makeScene() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#ffffff')
  scene.environment = envMap
  const sun = new THREE.DirectionalLight('#ffffff', 1.2)
  sun.position.set(3, 8, 4)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  scene.add(sun, sun.target)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.12 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
  return { scene, sun }
}

function pixels() {
  const gl = renderer.getContext()
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
  const buf = new Uint8Array(w * h * 4)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
  return buf
}
// Pixels do carro = diferentes do branco do fundo (a sombra é bem clara).
function silhouette(buf) {
  let n = 0
  for (let i = 0; i < buf.length; i += 4) if (buf[i] < 225 || buf[i + 1] < 225 || buf[i + 2] < 225) n++
  return n
}
function changed(a, b) {
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 70) n++
  }
  return n
}

window.renderCar = async function renderCar(url) {
  const gltf = await loader.loadAsync(url)
  const model = gltf.scene
  const { scene, sun } = makeScene()
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false } })
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  if (!isFinite(size.x) || size.length() === 0) return { error: 'modelo vazio' }
  model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z))
  scene.add(model)
  const longX = size.x >= size.z
  const length = Math.max(size.x, size.z), width = Math.min(size.x, size.z), height = size.y
  // Câmera em 3/4, ajustada ao tamanho do carro.
  const radius = Math.hypot(length, width, height) / 2
  const camera = new THREE.PerspectiveCamera(30, W / H, radius / 100, radius * 100)
  const dir = longX ? new THREE.Vector3(0.78, 0.36, 0.95) : new THREE.Vector3(0.95, 0.36, 0.78)
  camera.position.copy(dir.normalize().multiplyScalar(radius / Math.sin(THREE.MathUtils.degToRad(15)) * 0.62))
  camera.position.y += height * 0.4
  camera.lookAt(0, height * 0.42, 0)
  sun.position.set(radius * 2, radius * 5, radius * 2.5)
  const sc = sun.shadow.camera
  sc.left = sc.bottom = -radius * 1.5; sc.right = sc.top = radius * 1.5; sc.far = radius * 12; sc.updateProjectionMatrix()

  renderer.render(scene, camera)
  const base = pixels()
  const photo = renderer.domElement.toDataURL('image/webp', 0.86)
  // As medições abaixo usam 1/4 dos pixels: bem mais rápido e a proporção é a mesma.
  renderer.setSize(W / 2, H / 2)
  camera.updateProjectionMatrix()
  // Contorno do carro numa renderização em silhueta preta: medir pelo próprio
  // render falharia em carros brancos (lataria igual ao fundo).
  const black = new THREE.MeshBasicMaterial({ color: '#000000' })
  const saved = new Map()
  model.traverse(o => { if (o.isMesh) { saved.set(o, o.material); o.material = black } })
  const shadowVisible = scene.children.find(c => c.material?.isShadowMaterial)
  if (shadowVisible) shadowVisible.visible = false
  renderer.render(scene, camera)
  const carPixels = silhouette(pixels())
  saved.forEach((m, o) => { o.material = m })
  if (shadowVisible) shadowVisible.visible = true

  // Testa cada conjunto candidato de lataria: pinta de magenta e mede quanto do carro mudou.
  const { order, area, candidates } = paintableMaterials(model)
  // Durante os testes, vidros ficam opacos: o interior visto pela janela não
  // pode contar como lataria.
  const glassCover = new THREE.MeshStandardMaterial({ color: '#555b63', roughness: 0.4 })
  const glassSaved = new Map()
  model.traverse(o => {
    if (!o.isMesh) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    if (!mats.some(m => m.transparent || m.opacity < 0.9 || m.transmission > 0.2 || /glass|vidro|window|windshield/i.test(m.name || ''))) return
    glassSaved.set(o, o.material)
    o.material = Array.isArray(o.material) ? mats.map(m => (m.transparent || m.opacity < 0.9 || m.transmission > 0.2 || /glass|vidro|window|windshield/i.test(m.name || '')) ? glassCover : m) : glassCover
  })
  renderer.render(scene, camera)
  const testBase = pixels()
  const tests = []
  const tried = new Set()
  const paintWith = (set, color) => {
    const originals = new Map()
    model.traverse(o => {
      if (!o.isMesh) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      const next = mats.map(m => {
        if (!set.includes(order.indexOf(m))) return m
        const c = m.clone(); c.map = null; c.vertexColors = false
        c.color = new THREE.Color(color); c.transparent = false; c.opacity = 1
        return c
      })
      originals.set(o, o.material)
      o.material = Array.isArray(o.material) ? next : next[0]
    })
    renderer.render(scene, camera)
    const share = carPixels ? changed(testBase, pixels()) / carPixels : 0
    if (window.__preview && window.__preview.join() === set.join()) window.__previewImg = renderer.domElement.toDataURL('image/png')
    originals.forEach((m, o) => { o.material = m })
    return share
  }
  // Duas cores de teste: magenta muda bem carros escuros; verde forte muda bem
  // carros brancos e prata (e carros verdes ou magenta são cobertos pela outra).
  const test = set => {
    const key = [...set].sort((a, b) => a - b).join()
    if (!set.length || tried.has(key)) return
    tried.add(key)
    let share = paintWith(set, '#ff00ff')
    if (share < 0.35) share = Math.max(share, paintWith(set, '#00b000'))
    tests.push({ set, share: Math.min(1, Math.round(share * 1000) / 1000) })
    return share
  }
  if (window.__preview) test(window.__preview)
  candidates.forEach(test)
  // Lataria dividida em várias peças: mede cada material sozinho e junta os que
  // cobrem uma parte relevante do carro.
  if (Math.max(0, ...tests.map(t => t.share)) < 0.35) {
    const eligible = order.map((m, i) => i)
      .filter(i => !NON_BODY.test(order[i].name || '') && order[i].opacity >= 0.9)
      .sort((x, y) => area[y] - area[x]).slice(0, 14)
    const singles = eligible.map(i => ({ i, share: test([i]) ?? tests.find(t => t.set.length === 1 && t.set[0] === i)?.share ?? 0 }))
    const strong = singles.filter(x => x.share >= 0.03).sort((a, b) => b.share - a.share).map(x => x.i)
    for (let n = 2; n <= strong.length; n++) test(strong.slice(0, n))
  }
  // Sem lataria separável (ou só pintaria o carro inteiro): tenta recolorir só os
  // pixels de pintura na textura do maior material texturizado.
  const topShare = Math.max(0, ...tests.map(t => t.share))
  let tint = null
  if (topShare < 0.2 || topShare >= 0.97) {
    const textured = order.map((m, i) => i).filter(i => order[i].map && !NON_BODY.test(order[i].name || '') && order[i].opacity >= 0.9)
      .sort((x, y) => area[y] - area[x]).slice(0, 2)
    for (const i of textured) {
      const mat = order[i]
      const base = dominantTextureColor(model, mat)
      if (!base) continue
      const tex = recolorTexture(mat.map, base, new THREE.Color('#00b000'), glassMask(model, mat, mat.map.image.width, mat.map.image.height))
      if (!tex) continue
      const saved = new Map()
      model.traverse(o => {
        if (!o.isMesh) return
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        if (!mats.includes(mat)) return
        saved.set(o, o.material)
        const c = mat.clone(); c.map = tex
        o.material = Array.isArray(o.material) ? mats.map(m => m === mat ? c : m) : c
      })
      renderer.render(scene, camera)
      const share = carPixels ? changed(testBase, pixels()) / carPixels : 0
      if (window.__tintPreview) window.__previewImg = renderer.domElement.toDataURL('image/png')
      saved.forEach((m, o) => { o.material = m })
      tex.dispose()
      if (share >= 0.2 && share <= 0.92) { tint = { materials: [i], base: base.map(v => Math.round(v)), share: Math.round(share * 1000) / 1000 }; break }
    }
  }
  glassSaved.forEach((m, o) => { o.material = m })
  renderer.setSize(W, H)
  // Libera a memória da GPU: sem isso, depois de algumas centenas de carros o
  // contexto WebGL se perde e as fotos saem pretas.
  model.traverse(o => {
    if (!o.isMesh) return
    o.geometry.dispose()
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose()
      m.dispose()
    }
  })
  renderer.renderLists.dispose()
  if (!carPixels) return { error: 'render vazio' }
  tests.sort((a, b) => b.share - a.share)
  // Menor conjunto que cobre quase tanto quanto o melhor: evita pintar bancos ou frisos junto.
  const top = tests[0]?.share || 0
  const best = tests.filter(t => t.share >= top * 0.95).sort((a, b) => a.set.length - b.set.length || b.share - a.share)[0]
  return {
    photo,
    frame: Math.round(carPixels / (W * H / 4) * 1000) / 1000,
    dims: { length: +length.toFixed(3), width: +width.toFixed(3), height: +height.toFixed(3) },
    materials: order.map(m => m.name || ''),
    nonBody: order.map((m, i) => NON_BODY.test(m.name || '') ? i : -1).filter(i => i >= 0),
    paint: best && best.share >= 0.2 ? best.set : [],
    paintShare: best ? best.share : 0,
    tests: tests.slice(0, 4),
    tint,
    preview: window.__previewImg
  }
}
window.ready = true

// Diagnóstico: lista os materiais de um GLB (node tools/car-catalog/inspect.mjs <id>).
window.paintPreview = async function (url, set) {
  window.__preview = set
  return (await window.renderCar(url)).preview
}
window.inspectCar = async function (url) {
  const g = await loader.loadAsync(url)
  const mats = []
  g.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (!mats.includes(m)) mats.push(m) })
  return mats.map((m, i) => `${i} ${m.name} ${m.type} op=${m.opacity} tr=${m.transmission || 0} map=${!!m.map} vc=${m.vertexColors} cor=#${m.color?.getHexString()}`)
}
