import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import './attention-notice.css'

/** Use alert for a failed action; status for a contextual warning already on the page. */
export function AttentionNotice({children,urgent=false,className='',id}:{children:ReactNode;urgent?:boolean;className?:string;id?:string}){
  return <div id={id} className={`vc-attention ${className}`} role={urgent?'alert':'status'} aria-atomic="true">
    <span className="vc-attention-tag"><TriangleAlert size={13} aria-hidden="true"/>ATENÇÃO</span>
    <div className="vc-attention-content">{children}</div>
  </div>
}
