import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

const focusable='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])'

export function Modal({title,onClose,children,wide=false,showroom=false,className=''}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean;showroom?:boolean;className?:string}){
  const panel=useRef<HTMLElement>(null)
  const close=useRef(onClose);close.current=onClose
  const previousFocus=useRef<HTMLElement|null>(typeof document!=='undefined'?document.activeElement as HTMLElement:null)
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow
    const isTop=()=>{const dialogs=document.querySelectorAll('[data-vc-modal]');return dialogs[dialogs.length-1]===panel.current}
    const controls=()=>Array.from(panel.current?.querySelectorAll<HTMLElement>(focusable)||[]).filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden')
    const fn=(e:KeyboardEvent)=>{
      if(!isTop()||e.defaultPrevented)return
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close.current();return}
      if(e.key==='Tab'){
        const list=controls(),first=list[0],last=list[list.length-1]
        if(!first){e.preventDefault();panel.current?.focus();return}
        if(e.shiftKey&&(document.activeElement===first||!panel.current?.contains(document.activeElement))){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&(document.activeElement===last||!panel.current?.contains(document.activeElement))){e.preventDefault();first.focus()}
      }
    }
    window.addEventListener('keydown',fn)
    document.body.style.overflow='hidden'
    const frame=requestAnimationFrame(()=>{if(isTop()&&!panel.current?.contains(document.activeElement))(controls()[0]||panel.current)?.focus()})
    return()=>{
      cancelAnimationFrame(frame);window.removeEventListener('keydown',fn);document.body.style.overflow=previousOverflow
      if(previousFocus.current?.isConnected)previousFocus.current.focus()
    }
  },[])
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section ref={panel} data-vc-modal tabIndex={-1} className={`modal-card ${wide?'modal-wide':''} ${showroom?'modal-showroom':''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19}/></button></div>
      <div className="modal-content">{children}</div>
    </section>
  </div>
}
