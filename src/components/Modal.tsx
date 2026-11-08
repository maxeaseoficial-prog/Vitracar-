import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()}
    window.addEventListener('keydown',fn)
    document.body.style.overflow='hidden'
    return()=>{window.removeEventListener('keydown',fn);document.body.style.overflow=''}
  },[onClose])
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className={`modal-card ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19}/></button></div>
      <div className="modal-content">{children}</div>
    </section>
  </div>
}
