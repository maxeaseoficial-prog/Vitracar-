import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { normalizePlate } from '../../lib/utils'
import { QuickCarModel } from './QuickCarModel'

type Props={category:string;color:string;plate:string;variant?:'standard'|'studio'}

export function QuickCarViewer({category,color,plate,variant='studio'}:Props){
  const [auto,setAuto]=useState(true)
  const [resetKey,setResetKey]=useState(0)
  const [webgl]=useState(()=>{
    try{
      const el=document.createElement('canvas')
      return Boolean(el.getContext('webgl2')||el.getContext('webgl'))
    }catch{return false}
  })
  const plateLabel=normalizePlate(plate).slice(0,7)||'ABC1D23'
  return <div className={`viewer-frame viewer-quick ${variant==='studio'?'viewer-studio-mode':''}`}>
    <div className="viewer-topline"><span className="viewer-live-dot"/>
      SHOWROOM 3D LEVE <span className="viewer-tag">360°</span>
    </div>
    <div className="viewer-shell">
      {webgl?
        <Canvas key={resetKey} camera={{position:[6.2,3.2,5.8],fov:37,near:.1,far:100}}
          dpr={[1,1.5]} gl={{antialias:true,powerPreference:'high-performance'}}
          onCreated={({gl})=>{gl.toneMappingExposure=1.25}}>
          <color attach="background" args={['#f7fbff']}/>
          <ambientLight intensity={2.25}/>
          <hemisphereLight args={['#ffffff','#d0dfed',2.2]}/>
          <directionalLight position={[6,10,5]} intensity={3} castShadow/>
          <directionalLight position={[-4,5,-6]} intensity={1.4}/>
          <QuickCarModel category={category} color={color} plate={plate}/>
          <ContactShadows position={[0,.018,0]} opacity={.21} blur={2.7}
            scale={10} far={6} resolution={256} frames={1}/>
          <OrbitControls makeDefault target={[0,.87,0]} enableDamping dampingFactor={.08}
            enablePan={false} autoRotate={auto} autoRotateSpeed={.68}
            minPolarAngle={.18} maxPolarAngle={Math.PI*.48}
            minDistance={3.8} maxDistance={13}/>
        </Canvas>:
        <div className="viewer-fallback"><strong>Seu navegador não suporta WebGL</strong>
          <p>Os dados de cor e placa podem ser salvos normalmente.</p></div>}
      <div className="viewer-controls">
        <button type="button" title="Reenquadrar câmera" onClick={()=>setResetKey(k=>k+1)}>
          <RotateCcw size={16}/>
        </button>
        <button type="button" className={auto?'control-active':''} onClick={()=>setAuto(v=>!v)}>
          {auto?'Pausar giro':'Girar'}
        </button>
      </div>
      {variant==='studio'&&<div className="v-live-plate" aria-label={`Placa ${plateLabel}`}>
        <span>BRASIL</span><strong>{plateLabel}</strong>
      </div>}
      <span className="v-quick-badge">MODELO ILUSTRATIVO</span>
    </div>
    <div className="viewer-caption"><span><AlertCircle size={14}/>
      3D por categoria · Giro e zoom · Pintura e placa em tempo real, sem downloads externos</span></div>
  </div>
}
