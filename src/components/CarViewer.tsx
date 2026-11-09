import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, CanvasTexture, DoubleSide, Mesh, MeshStandardMaterial, PMREMGenerator, SRGBColorSpace, Vector3, type Material } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { materialOrder } from '../lib/paint'
import { AlertCircle, Box, ExternalLink, RotateCcw } from 'lucide-react'
import { getAssetUrl, getCatalog, getModelThumbnailUrl, isOriginalColor, modelQualityIssue, paintColor, type CatalogCar } from '../lib/catalog'
import { normalizePlate } from '../lib/utils'
import { Loading } from './UI'

class SceneBoundary extends Component<{children:ReactNode;onError:()=>void},{hasError:boolean}>{
  state={hasError:false}
  static getDerivedStateFromError(){return {hasError:true}}
  componentDidCatch(){this.props.onError()}
  render(){return this.state.hasError?null:this.props.children}
}

function createMercosulTexture(plate:string) {
  const canvas=document.createElement('canvas')
  canvas.width=768;canvas.height=244
  const ctx=canvas.getContext('2d')
  if(!ctx)return null
  const label=normalizePlate(plate).slice(0,7)||'ABC1D23'
  ctx.fillStyle='#101827'
  ctx.fillRect(0,0,768,244)
  ctx.fillStyle='#f7f8f9'
  ctx.fillRect(12,12,744,220)
  ctx.fillStyle='#003da5'
  ctx.fillRect(12,12,744,61)
  ctx.fillStyle='#fff'
  ctx.font='700 35px Arial, sans-serif'
  ctx.textAlign='center'
  ctx.fillText('BRASIL',384,54)
  ctx.fillStyle='#171b24'
  ctx.font='700 126px Arial, sans-serif'
  ctx.fillText(label,384,191)
  const texture=new CanvasTexture(canvas)
  texture.colorSpace=SRGBColorSpace
  texture.anisotropy=4
  return texture
}

function PhysicalPlates({bounds,texture}:{bounds:Box3;texture:CanvasTexture}){
  const {size,center,isLongX,width,height}=useMemo(()=>{
    const size=bounds.getSize(new Vector3())
    const center=bounds.getCenter(new Vector3())
    const isLongX=size.x>size.z*1.18
    const transverse=isLongX?size.z:size.x
    const width=Math.max(transverse*.26,transverse*.2)
    const height=width/3.25
    return {size,center,isLongX,width,height}
  },[bounds])
  if(!Number.isFinite(width)||width<=0)return null
  const plateY=bounds.min.y+size.y*.31
  const gap=Math.max(.004,(isLongX?size.x:size.z)*.006)
  const positions=isLongX?[
    {x:bounds.min.x-gap,z:center.z,angle:-Math.PI/2},
    {x:bounds.max.x+gap,z:center.z,angle:Math.PI/2}
  ]:[
    {x:center.x,z:bounds.min.z-gap,angle:Math.PI},
    {x:center.x,z:bounds.max.z+gap,angle:0}
  ]
  return <group>
    {positions.map((p,i)=><mesh key={i} position={[p.x,plateY,p.z]} rotation={[0,p.angle,0]} renderOrder={10}>
      <planeGeometry args={[width,height]}/>
      <meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
    </mesh>)}
  </group>
}

function Model({car,color,plate,onReady}:{car:CatalogCar;color:string;plate:string;onReady:()=>void}){
  const {scene}=useGLTF(getAssetUrl(car))
  const original=isOriginalColor(color)
  const {model,bounds,paintMaterials}=useMemo(()=>{
    const model=scene.clone(true)
    model.traverse(o=>{if(o instanceof Mesh)o.castShadow=true})
    const paintMaterials:MeshStandardMaterial[]=[]
    // Só a lataria detectada pelo gerador do catálogo recebe a cor; faróis,
    // lanternas e vidros mantêm o material original. Na cor "Original" nada
    // é alterado.
    if(!original&&car.paint.length){
      const order=materialOrder(model)
      const body=new Set(car.paint.map(i=>order[i]).filter(Boolean))
      const own=new Map<Material,Material>()
      const repaint=(mat:Material):Material=>{
        if(!body.has(mat)||!(mat instanceof MeshStandardMaterial))return mat
        // Jamais modificar o material em cache: outros carros usam o mesmo GLB.
        if(!own.has(mat)){const c=mat.clone();paintMaterials.push(c);own.set(mat,c)}
        return own.get(mat)!
      }
      model.traverse(child=>{
        if(!(child instanceof Mesh))return
        child.material=Array.isArray(child.material)?child.material.map(repaint):repaint(child.material)
      })
    }
    return {model,bounds:new Box3().setFromObject(model),paintMaterials}
  },[car,scene,original])
  const texture=useMemo(()=>createMercosulTexture(plate),[plate])
  useEffect(()=>{
    const hex=paintColor(color)
    for(const material of paintMaterials){
      // A textura original multiplicaria a nova cor (verde e vermelho virariam quase preto).
      material.map=null
      material.vertexColors=false
      material.color.set(hex)
      material.transparent=false
      material.opacity=1
      material.needsUpdate=true
    }
  },[color,paintMaterials])
  useEffect(()=>{onReady()},[onReady])
  useEffect(()=>()=>{paintMaterials.forEach(m=>m.dispose())},[paintMaterials])
  useEffect(()=>()=>{texture?.dispose()},[texture])
  // Cada arquivo vem numa escala (milímetros, metros, unidades soltas). Normaliza
  // para ~4,5 m de comprimento, centralizado e apoiado no chão, para que a câmera
  // e a sombra fiquem iguais em todos os carros.
  const size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3())
  const k=4.5/Math.max(size.x,size.z,1e-6)
  return <group scale={k} position={[-center.x*k,-bounds.min.y*k,-center.z*k]}>
    <primitive object={model}/>
    {texture&&<PhysicalPlates bounds={bounds} texture={texture}/>}
  </group>
}
// Reflexos de estúdio gerados localmente (sem baixar HDR de CDN), como na foto do catálogo.
function StudioLight(){
  const {gl,scene}=useThree()
  useEffect(()=>{
    const pmrem=new PMREMGenerator(gl)
    const env=pmrem.fromScene(new RoomEnvironment(),.04).texture
    scene.environment=env
    return()=>{scene.environment=null;env.dispose();pmrem.dispose()}
  },[gl,scene])
  return null
}
function Fallback({reason}:{reason:string}){
  return <div className="viewer-fallback"><div className="viewer-fallback-icon"><Box size={32}/></div>
    <strong>Visualização 3D indisponível</strong><p>{reason}</p></div>
}

type Props={
  modelId:string|null
  color:string
  plate?:string
  car?:CatalogCar|null
  variant?:'standard'|'studio'
}

export function CarViewer({modelId,color,plate='',car:providedCar,variant='standard'}:Props){
  const [catalog,setCatalog]=useState<CatalogCar[]>([])
  const [error,setError]=useState<string|null>(null)
  const [auto,setAuto]=useState(true)
  const [cameraKey,setCameraKey]=useState(0)
  const [readyId,setReadyId]=useState<string|null>(null)
  const [modelFailed,setModelFailed]=useState(false)
  const [photoFailed,setPhotoFailed]=useState(false)
  const markReady=useCallback((id:string)=>{setReadyId(id)},[])
  const [webgl]=useState(()=>{
    try{
      const canvas=document.createElement('canvas')
      return Boolean(canvas.getContext('webgl2')||canvas.getContext('webgl'))
    }catch{return false}
  })
  useEffect(()=>{
    if(providedCar||!modelId)return
    let mounted=true
    getCatalog().then(cars=>{if(mounted){setCatalog(cars);setError(null)}})
      .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Falha ao carregar catálogo')})
    return()=>{mounted=false}
  },[providedCar,modelId])
  useEffect(()=>{setModelFailed(false);setPhotoFailed(false)},[modelId])
  const car=providedCar||catalog.find(c=>c.id===modelId)
  if(!modelId)return <div className="viewer-shell"><Fallback reason="Selecione um modelo 3D no cadastro do veículo."/></div>
  if(error&&!providedCar)return <div className="viewer-shell"><Fallback reason={error}/></div>
  if(!car){
    if(catalog.length)return <div className="viewer-shell"><Fallback reason="Modelo 3D não encontrado na biblioteca."/></div>
    return <div className="viewer-shell viewer-centered"><Loading label="Preparando modelo 3D..."/></div>
  }
  const invalid=modelQualityIssue(car)
  const photo=getModelThumbnailUrl(car)
  const plateLabel=normalizePlate(plate).slice(0,7)||'ABC1D23'
  const ready=readyId===car.id && !modelFailed
  const canDraw=webgl&&!modelFailed&&!invalid
  return <div className={`viewer-frame ${variant==='studio'?'viewer-studio-mode':''}`}>
    <div className="viewer-topline"><span className="viewer-live-dot"/>SHOWROOM INTERATIVO
      <span className="viewer-tag">{canDraw?'360°':'PRÉVIA'}</span></div>
    <div className="viewer-shell">
      {canDraw&&<Canvas camera={{position:[4.7,2.2,5.4],fov:36}} shadows dpr={[1,1.5]}
        gl={{antialias:true,alpha:false}} onCreated={({gl})=>{gl.toneMappingExposure=1}}>
        <color attach="background" args={['#ffffff']}/>
        <StudioLight/>
        <directionalLight position={[4,10,5]} intensity={1.2} castShadow shadow-mapSize={[1024,1024]}
          shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-camera-far={30}/>
        <Suspense fallback={null}>
          <SceneBoundary key={car.id} onError={()=>setModelFailed(true)}>
            <Model key={`${car.id}-${cameraKey}`} car={car} color={color} plate={plate}
              onReady={()=>markReady(car.id)}/>
          </SceneBoundary>
        </Suspense>
        <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[40,40]}/><shadowMaterial opacity={.13}/></mesh>
        <OrbitControls key={cameraKey} makeDefault enableDamping dampingFactor={.08} target={[0,.7,0]}
          autoRotate={auto} autoRotateSpeed={.55} minDistance={3.5} maxDistance={14} enablePan={false}
          minPolarAngle={.2} maxPolarAngle={Math.PI*.48}/>
      </Canvas>}
      {(invalid||!webgl||modelFailed||!ready)&&<div className={`viewer-poster ${invalid||modelFailed?'viewer-poster-static':''}`}>
        {photo&&!photoFailed&&<img src={photo} alt={`Fotografia de referência de ${car.brand} ${car.model}`}
          onError={()=>setPhotoFailed(true)} className="viewer-poster-photo"/>}
        <div className="viewer-poster-message">
          {invalid?<><strong>Modelo 3D original incompleto</strong><span>{invalid} O cadastro continua disponível sem exibir um carro incorreto.</span></>:
            modelFailed?<><strong>3D indisponível</strong><span>Não foi possível carregar este arquivo. Você ainda pode salvar o veículo.</span></>:
            !webgl?<><strong>3D não suportado</strong><span>O navegador não permite renderização WebGL.</span></>:
            <><span className="viewer-poster-spinner"/><strong>Preparando showroom 3D...</strong><span>Prévia fotográfica imediata enquanto carrega o modelo.</span></>}
        </div>
      </div>}
      <div className="viewer-controls">
        <button type="button" title="Reenquadrar câmera" disabled={!canDraw}
          onClick={()=>{setCameraKey(k=>k+1);setReadyId(null)}}><RotateCcw size={16}/></button>
        <button type="button" disabled={!canDraw} onClick={()=>setAuto(p=>!p)}
          className={auto?'control-active':''}
          title="Alternar rotação automática">{auto?'Pausar giro':'Girar'}</button>
      </div>
      {variant==='studio'&&<div className="v-live-plate" aria-label={`Placa prévia ${plateLabel}`}>
        <span>BRASIL</span><strong>{plateLabel}</strong>
      </div>}
    </div>
    <div className="viewer-caption">
      <span><AlertCircle size={14}/>{invalid?'Arquivo original incompatível com showroom.':'Gire com o mouse ou dedo · Role para zoom'}</span>
      {car.credit.sourceUrl?<a href={car.credit.sourceUrl} target="_blank" rel="noreferrer">
        3D: {car.credit.author} · {car.credit.license} <ExternalLink size={12}/></a>:
        <span>3D: {car.credit.author} · {car.credit.license}</span>}
    </div>
  </div>
}
