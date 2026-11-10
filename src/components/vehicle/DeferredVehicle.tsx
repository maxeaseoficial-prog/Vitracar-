import { lazy, Suspense, type ComponentProps } from 'react'
import { Loading } from '../UI'
const Original = lazy(() => import('../CarViewer').then(m => ({ default: m.CarViewer })))
const Quick = lazy(() => import('./QuickCarViewer').then(m => ({ default: m.QuickCarViewer })))
const Studio = lazy(() => import('./VehicleStudioForm').then(m => ({ default: m.VehicleStudioForm })))
const previewLoading = <div className="viewer-shell viewer-centered"><Loading label="Preparando visualização 3D..."/></div>
export function CarViewer(props: ComponentProps<typeof Original>) {
  return <Suspense fallback={previewLoading}><Original {...props}/></Suspense>
}
export function QuickCarViewer(props: ComponentProps<typeof Quick>) {
  return <Suspense fallback={previewLoading}><Quick {...props}/></Suspense>
}
export function VehicleStudioForm(props: ComponentProps<typeof Studio>) {
  return <Suspense fallback={<Loading label="Abrindo cadastro do veículo..."/>}><Studio {...props}/></Suspense>
}
