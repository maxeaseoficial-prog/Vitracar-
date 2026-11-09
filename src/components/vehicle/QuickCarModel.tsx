import { useEffect, useMemo } from 'react'
import { DoubleSide, CanvasTexture, SRGBColorSpace, Shape } from 'three'
import { Line, RoundedBox } from '@react-three/drei'
import { paintColor } from '../../lib/catalog'

type Vec2=[number,number]
type Specs={length:number;width:number;roofY:number;roofRear:number;roofFront:number;baseRear:number;baseFront:number;wheelX:number;kind:string;lift?:number;wheelR?:number}

function specsFor(category:string):Specs {
  switch(category){
    case 'hatchback':return {length:4.1,width:1.83,roofY:1.65,roofRear:-1.28,roofFront:.73,baseRear:-1.76,baseFront:1.21,wheelX:1.32,kind:'hatch'}
    case 'coupe':
    case 'sports':return {length:4.45,width:1.91,roofY:1.47,roofRear:-1.1,roofFront:.73,baseRear:-1.66,baseFront:1.42,wheelX:1.5,kind:'sports'}
    case 'suv':return {length:4.75,width:2.04,roofY:2,roofRear:-1.58,roofFront:.93,baseRear:-1.88,baseFront:1.45,wheelX:1.54,kind:'suv',lift:.16,wheelR:.44}
    case 'pickup':return {length:5.05,width:2.01,roofY:1.92,roofRear:-.32,roofFront:1.13,baseRear:-.62,baseFront:1.65,wheelX:1.74,kind:'pickup',lift:.18,wheelR:.45}
    case 'minivan':
    case 'van':return {length:4.83,width:2.03,roofY:2.09,roofRear:-1.82,roofFront:1.04,baseRear:-2.07,baseFront:1.68,wheelX:1.53,kind:'van',lift:.08,wheelR:.40}
    case 'wagon':return {length:4.72,width:1.92,roofY:1.72,roofRear:-1.55,roofFront:.76,baseRear:-1.85,baseFront:1.44,wheelX:1.51,kind:'sedan'}
    default:return {length:4.57,width:1.89,roofY:1.65,roofRear:-1.12,roofFront:.73,baseRear:-1.71,baseFront:1.34,wheelX:1.46,kind:'sedan'}
  }
}
function polygon(points:Vec2[]):Shape{
  const shape=new Shape()
  points.forEach(([x,y],i)=>{if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y)})
  shape.closePath()
  return shape
}
function plateTexture(plate:string){
  const canvas=document.createElement('canvas')
  canvas.width=600;canvas.height=190
  const ctx=canvas.getContext('2d')
  if(!ctx)return null
  ctx.fillStyle='#17253b';ctx.fillRect(0,0,600,190)
  ctx.fillStyle='#f6f8fa';ctx.fillRect(7,7,586,176)
  ctx.fillStyle='#0131cd';ctx.fillRect(7,7,586,46)
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 27px Arial';ctx.fillText('BRASIL',300,41)
  ctx.fillStyle='#17253b';ctx.font='bold 99px monospace'
  ctx.fillText((plate.toUpperCase().replace(/[^A-Z0-9]/g,'')||'ABC1D23').slice(0,7),300,155)
  const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace
  return map
}
function Plate3D({plate,length}:{plate:string;length:number}){
  const texture=useMemo(()=>plateTexture(plate),[plate])
  useEffect(()=>()=>texture?.dispose(),[texture])
  if(!texture)return null
  // Fica à frente da grade (que vai até comprimento/2 + 0,117) para não ser encoberta.
  return <group>{[-1,1].map(side=><mesh key={side} position={[side*(length/2+.135),.62,0]}
    rotation={[0,side*Math.PI/2,0]} renderOrder={4}>
    <planeGeometry args={[.58,.19]}/>
    <meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false}/>
  </mesh>)}</group>
}
function Wheel({x,z,r=.37}:{x:number;z:number;r?:number}){
  const k=r/.37
  return <group position={[x,r+.01,z]} scale={[k,k,1]}>
    <mesh rotation={[Math.PI/2,0,0]} castShadow>
      <cylinderGeometry args={[.37,.37,.18,24]}/>
      <meshStandardMaterial color="#161f2b" roughness={.85}/>
    </mesh>
    <mesh rotation={[Math.PI/2,0,0]} position={[0,0,z>0?.103:-.103]}>
      <cylinderGeometry args={[.235,.235,.015,24]}/>
      <meshStandardMaterial color="#becbdd" metalness={.4} roughness={.4}/>
    </mesh>
    <mesh rotation={[Math.PI/2,0,0]} position={[0,0,z>0?.118:-.118]}>
      <cylinderGeometry args={[.11,.11,.019,10]}/>
      <meshStandardMaterial color="#52657d" metalness={.5} roughness={.34}/>
    </mesh>
  </group>
}
// Vidro inclinado (para-brisa ou vidro traseiro) apoiado na rampa da cabine,
// de `from` (base) até `to` (teto), afastado um pouco para fora da lataria.
function SlopedGlass({from,to,depth,outward}:{from:Vec2;to:Vec2;depth:number;outward:1|-1}){
  const dx=to[0]-from[0],dy=to[1]-from[1],len=Math.hypot(dx,dy)
  if(len<.05)return null
  const normal:Vec2=outward===1?[dy/len,-dx/len]:[-dy/len,dx/len]
  const off=.045
  return <mesh position={[(from[0]+to[0])/2+normal[0]*off,(from[1]+to[1])/2+normal[1]*off,0]}
    rotation={[0,0,Math.atan2(dy,dx)]}>
    <boxGeometry args={[len*.9,.012,depth*.86]}/>
    <meshStandardMaterial color="#1f3c56" metalness={.3} roughness={.18}/>
  </mesh>
}
export function QuickCarModel({category,color,plate}:{category:string;color:string;plate:string}){
  const spec=useMemo(()=>specsFor(category),[category])
  const hex=paintColor(color)
  const cabin=useMemo(()=>polygon([
    [spec.baseRear,1],[spec.roofRear,spec.roofY-.07],
    [spec.roofRear+.17,spec.roofY],[spec.roofFront-.15,spec.roofY],
    [spec.roofFront,spec.roofY-.12],[spec.baseFront,1]
  ]),[spec])
  const middle=(spec.roofRear+spec.roofFront)/2
  const windows=useMemo(()=>{
    const top=spec.roofY-.13,low=1.15
    return [
      polygon([[spec.baseRear+.14,low],[middle-.065,low],[middle-.065,top],[spec.roofRear+.115,top]]),
      polygon([[middle+.065,low],[spec.baseFront-.17,low],[spec.roofFront-.095,top],[middle+.065,top]])
    ]
  },[spec,middle])
  const cabinDepth=spec.width*.79
  const lift=spec.lift||0
  const wheelR=spec.wheelR||.37
  return <group>
    {([-1,1] as const).map(side=><group key={'w'+side}>
      <Wheel x={spec.wheelX} z={side*(spec.width/2+.04)} r={wheelR}/>
      <Wheel x={-spec.wheelX} z={side*(spec.width/2+.04)} r={wheelR}/>
    </group>)}
    <group position={[0,lift,0]}>
    <SlopedGlass from={[spec.baseFront,1]} to={[spec.roofFront,spec.roofY-.12]} depth={cabinDepth} outward={1}/>
    <SlopedGlass from={[spec.baseRear,1]} to={[spec.roofRear,spec.roofY-.07]} depth={cabinDepth} outward={-1}/>
    {(spec.kind==='suv'||spec.kind==='pickup')&&<RoundedBox args={[spec.length*.98,.16,spec.width+.02]} radius={.05} smoothness={2}
      position={[0,.44,0]}><meshStandardMaterial color="#2a3442" roughness={.8}/></RoundedBox>}
    <RoundedBox args={[spec.length,.65,spec.width]} radius={.12} smoothness={3}
      position={[0,.7,0]} castShadow receiveShadow>
      <meshPhysicalMaterial color={hex} metalness={.14} roughness={.31} clearcoat={.76} clearcoatRoughness={.22}/>
    </RoundedBox>
    <mesh position={[0,0,-cabinDepth/2]} castShadow>
      <extrudeGeometry args={[cabin,{depth:cabinDepth,bevelEnabled:true,bevelThickness:.04,bevelSize:.035,bevelSegments:2,steps:1}]}/>
      <meshPhysicalMaterial color={hex} metalness={.12} roughness={.32} clearcoat={.75} clearcoatRoughness={.23}/>
    </mesh>
    {([-1,1] as const).map(side=><group key={side}>
      {windows.map((shape,i)=><mesh key={i} position={[0,0,side*(cabinDepth/2+.05)]}>
        <shapeGeometry args={[shape]}/>
        <meshStandardMaterial side={DoubleSide} color="#294b68" metalness={.22} roughness={.23}/>
      </mesh>)}
      <Line points={[[middle,1.10,side*(spec.width/2+.006)],[middle,.55,side*(spec.width/2+.006)]]}
        color="#163b58" lineWidth={1} transparent opacity={.33}/>
      <RoundedBox args={[.28,.17,.22]} radius={.055} smoothness={2}
        position={[spec.baseFront-.04,1.08,side*(spec.width/2+.075)]} castShadow>
        <meshStandardMaterial color={hex} roughness={.32} metalness={.1}/>
      </RoundedBox>
      <RoundedBox args={[.06,.15,.34]} radius={.028} smoothness={2}
        position={[spec.length/2+.025,.91,side*(spec.width*.33)]}>
        <meshStandardMaterial color="#eaf5ff" emissive="#d8ecff" emissiveIntensity={.25}/>
      </RoundedBox>
      <RoundedBox args={[.07,.16,.34]} radius={.028} smoothness={2}
        position={[-spec.length/2-.028,.85,side*(spec.width*.33)]}>
        <meshStandardMaterial color="#ef4354" emissive="#8d101b" emissiveIntensity={.3}/>
      </RoundedBox>
    </group>)}
    <RoundedBox args={[.10,.22,spec.width*.53]} radius={.055} smoothness={2}
      position={[spec.length/2+.067,.76,0]}>
      <meshStandardMaterial color="#152a40" roughness={.72}/>
    </RoundedBox>
    <RoundedBox args={[.14,.13,spec.width*.93]} radius={.04} smoothness={2}
      position={[spec.length/2+.028,.48,0]}><meshStandardMaterial color="#34445a" roughness={.66}/></RoundedBox>
    <RoundedBox args={[.11,.12,spec.width*.91]} radius={.04} smoothness={2}
      position={[-spec.length/2-.023,.49,0]}><meshStandardMaterial color="#34445a" roughness={.66}/></RoundedBox>
    {spec.kind==='pickup'&&<group position={[-spec.length*.25,1.06,0]}>
      <RoundedBox args={[spec.length*.44,.10,spec.width*.87]} radius={.02} smoothness={1}>
        <meshStandardMaterial color="#29384a" roughness={.8}/>
      </RoundedBox>
      {([-1,1] as const).map(side=><RoundedBox key={side} args={[spec.length*.42,.08,.055]} radius={.02}
        position={[0,.065,side*spec.width*.40]}>
        <meshStandardMaterial color={hex} roughness={.32}/>
      </RoundedBox>)}
    </group>}
    {(spec.kind==='suv'||spec.kind==='van')&&([-1,1] as const).map(side=><RoundedBox key={side}
      args={[Math.max(.4,spec.roofFront-spec.roofRear-.3),.055,.045]} radius={.018}
      position={[(spec.roofRear+spec.roofFront)/2,spec.roofY+.055,side*spec.width*.31]}>
      <meshStandardMaterial color="#6f8095" metalness={.52} roughness={.37}/>
    </RoundedBox>)}
    <Plate3D plate={plate} length={spec.length}/>
    </group>
  </group>
}
