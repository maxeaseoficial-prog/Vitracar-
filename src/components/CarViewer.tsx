import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Center, ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Mesh, MeshStandardMaterial, type Material } from 'three'
import { AlertCircle, Box, ExternalLink, RotateCcw } from 'lucide-react'
import { getAssetUrl, getCatalog, paintColor, type CatalogCar } from '../lib/catalog'
import { Loading } from './UI'

class SceneBoundary extends Component<{children:ReactNode;onError:()=>void},{hasError:boolean}>{
  state={hasError:false}
  static getDerivedStateFromError(){return {hasError:true}}
  componentDidCatch(){this.props.onError()}
  render(){return this.state.hasError?null:this.props.children}
}
function Model({car,color}:{car:CatalogCar;color:string}){
  const {scene}=useGLTF(getAssetUrl(car))
  const clone=useMemo(()=>{
    const obj=scene.clone(true)
    if(car.paint&&car.paint.confidence!=='baixa'){
      obj.traverse(child=>{
        if(!(child instanceof Mesh))return
        const materials:Material[]=Array.isArray(child.material)?child.material:[child.material]
        child.material=materials.map(mat=>{
          if(!car.paint?.materials.includes(mat.name)||!(mat instanceof MeshStandardMaterial))return mat
          const painted=mat.clone()
          painted.color.set(paintColor(color))
          return painted
        })
      })
    }
    return obj
  },[scene,car,color])
  return <Bounds fit clip observe margin={1.28}><Center><primitive object={clone}/></Center></Bounds>
}
function Fallback({reason}:{reason:string}){
  return <div className="viewer-fallback"><div className="viewer-fallback-icon"><Box size={32}/></div>
    <strong>Visualização 3D indisponível</strong><p>{reason}</p></div>
}
export function CarViewer({modelId,color}:{modelId:string|null;color:string}){
  const [catalog,setCatalog]=useState<CatalogCar[]>([])
  const [error,setError]=useState<string|null>(null)
  const [auto,setAuto]=useState(true)
  const [resetKey,setResetKey]=useState(0)
  const [modelFailed,setModelFailed]=useState(false)
  const [webgl]=useState(()=>{
    try{
      const canvas=document.createElement('canvas')
      return Boolean(canvas.getContext('webgl2')||canvas.getContext('webgl'))
    }catch{return false}
  })
  useEffect(()=>{
    let mounted=true
    getCatalog().then(cars=>{if(mounted){setCatalog(cars);setError(null)}})
      .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Falha ao carregar catálogo')})
    return()=>{mounted=false}
  },[])
  useEffect(()=>{setModelFailed(false);setResetKey(k=>k+1)},[modelId])
  const car=catalog.find(c=>c.id===modelId)
  if(!modelId)return <div className="viewer-shell"><Fallback reason="Este veículo não possui modelo 3D associado. Selecione um modelo na edição do cadastro."/></div>
  if(error)return <div className="viewer-shell"><Fallback reason={error}/></div>
  if(!catalog.length)return <div className="viewer-shell viewer-centered"><Loading label="Preparando catálogo 3D..."/></div>
  if(!car)return <div className="viewer-shell"><Fallback reason="Modelo não encontrado no catálogo; o cadastro permanece preservado."/></div>
  return <div className="viewer-frame">
    <div className="viewer-topline"><span className="viewer-live-dot"/>SHOWROOM INTERATIVO <span className="viewer-tag">360°</span></div>
    <div className="viewer-shell">
      {!webgl||modelFailed?<Fallback reason={modelFailed?'Falha ao carregar o arquivo GLB. Confira a CDN e as permissões do modelo.':'Este navegador não suporta WebGL.'}/>:
        <SceneBoundary key={`${car.id}-${resetKey}`} onError={()=>setModelFailed(true)}>
          <Canvas camera={{position:[5,2.6,6],fov:40}} shadows dpr={[1,1.8]} gl={{antialias:true}}>
            <color attach="background" args={['#f7faff']}/>
            <ambientLight intensity={2.5}/>
            <directionalLight position={[7,11,7]} intensity={3} castShadow/>
            <directionalLight position={[-6,5,-5]} intensity={1.5}/>
            <Suspense fallback={<Html center><div className="viewer-loading">Carregando veículo 3D…</div></Html>}>
              <Model car={car} color={color}/>
              <ContactShadows position={[0,-1,0]} opacity={0.2} scale={18} blur={2.4} far={5}/>
            </Suspense>
            <OrbitControls makeDefault enableDamping dampingFactor={0.08} autoRotate={auto} autoRotateSpeed={0.7}
              minDistance={1} maxDistance={30} enablePan={false}/>
          </Canvas>
        </SceneBoundary>}
      <div className="viewer-controls">
        <button title="Reenquadrar câmera" onClick={()=>setResetKey(k=>k+1)}><RotateCcw size={16}/></button>
        <button onClick={()=>setAuto(p=>!p)} className={auto?'control-active':''} title="Alternar rotação automática">
          {auto?'Pausar giro':'Girar'}
        </button>
      </div>
    </div>
    <div className="viewer-caption">
      <span><AlertCircle size={14}/> Arraste para girar · Use o scroll para zoom</span>
      {car.credit.sourceUrl?<a href={car.credit.sourceUrl} target="_blank" rel="noreferrer">
        3D por {car.credit.author} · {car.credit.license} <ExternalLink size={12}/></a>:
        <span>3D por {car.credit.author} · {car.credit.license}</span>}
    </div>
  </div>
}
