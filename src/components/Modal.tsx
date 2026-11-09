import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({title,onClose,children,wide=false,showroom=false,className=''}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean;showroom?:boolean;className?:string}){
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow
    const fn=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented)onClose()}
    window.addEventListener('keydown',fn)
    document.body.style.overflow='hidden'
    return()=>{window.removeEventListener('keydown',fn);document.body.style.overflow=previousOverflow}
  },[onClose])
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className={`modal-card ${wide?'modal-wide':''} ${showroom?'modal-showroom':''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19}/></button></div>
      <div className="modal-content">{children}</div>
    </section>
  </div>
}
