import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ArrowRight, LoaderCircle, Search, Coins, Inbox } from 'lucide-react'
import type { Client } from '../types'
import { supabase } from '../lib/supabase'
import { statusLabel } from '../lib/utils'
import { avatarUri, genderOf } from '../lib/avatar'

export function Button({variant='primary',size='normal',className='',children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{
  variant?:'primary'|'secondary'|'ghost'|'danger';size?:'normal'|'small';children:ReactNode
}){
  return <button {...props} className={`btn btn-${variant} btn-${size} ${className}`}>{children}</button>
}
export function Panel({title,action,children,className=''}:{title?:string;action?:ReactNode;children:ReactNode;className?:string}){
  return <section className={`panel ${className}`}>
    {(title||action)&&<div className="panel-header"><h2>{title}</h2>{action}</div>}
    {children}
  </section>
}
export function PageHeading({eyebrow,title,subtitle,actions}:{eyebrow?:string;title:string;subtitle?:string;actions?:ReactNode}){
  return <div className="page-heading">
    <div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>
    {actions&&<div className="heading-actions">{actions}</div>}
  </div>
}
export function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}){
  return <label className="field"><span className="field-label">{label}</span>{children}{hint&&<small>{hint}</small>}</label>
}
export function Input({className='',...props}:InputHTMLAttributes<HTMLInputElement>){
  return <input {...props} className={`form-input ${className}`} />
}
export function Select({className='',...props}:SelectHTMLAttributes<HTMLSelectElement>){
  return <select {...props} className={`form-input form-select ${className}`} />
}
export function Textarea({className='',...props}:TextareaHTMLAttributes<HTMLTextAreaElement>){
  return <textarea {...props} className={`form-input form-textarea ${className}`} />
}
export function Empty({title='Nada por aqui',description,action}:{title?:string;description?:string;action?:ReactNode}){
  return <div className="empty-state"><div className="empty-icon"><Inbox size={24}/></div><strong>{title}</strong>
    {description&&<p>{description}</p>}{action}</div>
}
export function SearchInput({value,onChange,placeholder='Buscar...'}:{value:string;onChange:(value:string)=>void;placeholder?:string}){
  return <div className="search-box"><Search size={17}/><input aria-label="Buscar" value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></div>
}
export function Status({status}:{status:string}){
  const color=['approved','completed','paid'].includes(status)?'green'
    :['cancelled','declined'].includes(status)?'red'
    :['in_progress'].includes(status)?'amber':'blue'
  return <span className={`status status-${color}`}><span className="status-dot"/>{statusLabel[status]||status}</span>
}
export function Loading({label='Carregando dados...'}:{label?:string}){
  return <div className="loading"><LoaderCircle className="spin" size={20}/>{label}</div>
}
export function TableWrap({children}:{children:ReactNode}){return <div className="table-scroll"><table className="data-table">{children}</table></div>}
export function ErrorText({message}:{message:string|null}){return message?<div className="error-text" role="alert">{message}</div>:null}
export function LinkAction({onClick,children}:{onClick:()=>void;children:ReactNode}){
  return <button className="text-action" onClick={onClick}>{children}<ArrowRight size={15}/></button>
}
export function CoinCount({value}:{value:number}){return <span className="coin-count"><Coins size={15}/>{new Intl.NumberFormat('pt-BR').format(value)}</span>}

export function Avatar({client,size='medium'}:{client:Pick<Client,'id'|'name'|'avatar_kind'|'photo_path'>;size?:'tiny'|'medium'|'large'|'xl'}){
  const [url,setUrl]=useState<string|null>(null)
  useEffect(()=>{
    let active=true
    setUrl(null)
    if(!client.photo_path||!supabase)return
    void supabase.storage.from('client-photos').createSignedUrl(client.photo_path,3600).then(({data})=>{
      if(active&&data?.signedUrl)setUrl(data.signedUrl)
    })
    return()=>{active=false}
  },[client.photo_path])
  return <div className={`avatar avatar-${size} ${genderOf(client.avatar_kind)==='female'?'avatar-female':'avatar-male'}`} title={client.name}>
    <img src={url||avatarUri(client.avatar_kind)} alt={url?`Foto de ${client.name}`:`Personagem de ${client.name}`}/>
  </div>
}
