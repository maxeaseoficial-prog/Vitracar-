import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ArrowRight, LoaderCircle, Search, Coins, Inbox } from 'lucide-react'
import type { Client } from '../types'
import { supabase } from '../lib/supabase'
import { initials, statusLabel } from '../lib/utils'

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

export function Avatar({client,size='medium'}:{client:Pick<Client,'id'|'name'|'avatar_kind'|'photo_path'>;size?:'tiny'|'medium'|'large'}){
  const [url,setUrl]=useState<string|null>(null)
  const uid=useId().replace(/:/g,'')
  useEffect(()=>{
    let active=true
    setUrl(null)
    if(!client.photo_path||!supabase)return
    void supabase.storage.from('client-photos').createSignedUrl(client.photo_path,3600).then(({data})=>{
      if(active&&data?.signedUrl)setUrl(data.signedUrl)
    })
    return()=>{active=false}
  },[client.photo_path])
  const girl=client.avatar_kind==='female'
  return <div className={`avatar avatar-${size} ${girl?'avatar-purple':'avatar-blue'}`} title={client.name}>
    {url?<img src={url} alt={`Foto de ${client.name}`}/>:<svg viewBox="0 0 100 100" role="img" aria-label={`Avatar ilustrado de ${client.name}`}>
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={girl?'#ebe4ff':'#e1eafb'}/><stop offset="1" stopColor={girl?'#bda8fc':'#a9c9f4'}/></linearGradient>
        <linearGradient id={`shirt-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={girl?'#705ad0':'#224f8c'}/><stop offset="1" stopColor={girl?'#443c9c':'#122e5a'}/></linearGradient>
      </defs>
      <rect width="100" height="100" rx="50" fill={`url(#bg-${uid})`}/>
      <ellipse cx="50" cy="109" rx="42" ry="33" fill={`url(#shirt-${uid})`}/>
      <path d="M40 73 L40 60 L60 60 L60 73 Q50 84 40 73Z" fill="#d89c78"/>
      {girl?<path d="M29 50 Q23 11 50 12 Q77 11 73 50 L79 83 L21 83Z" fill="#282434"/>:
        <path d="M27 45 Q23 17 43 16 Q56 7 70 24 L73 45 Q64 27 49 31 Q36 28 27 45" fill="#27242b"/>}
      <ellipse cx="50" cy="47" rx="22" ry="27" fill="#f0bb97"/>
      {girl&&<path d="M29 50 Q25 12 48 15 Q74 13 73 51 Q67 33 58 32 Q43 42 29 39Z" fill="#282434"/>}
      <circle cx="42" cy="48" r="2.1" fill="#2a2830"/><circle cx="58" cy="48" r="2.1" fill="#2a2830"/>
      <path d="M46 61 Q50 65 55 61" stroke="#a85d56" fill="none" strokeWidth="2" strokeLinecap="round"/>
      {!girl&&<path d="M38 63 Q50 77 62 63 Q63 72 51 76 Q39 75 38 63" fill="#49342c"/>}
      <path d="M38 72 Q50 83 62 72" stroke="#fff" strokeWidth="3" opacity=".35" fill="none"/>
      <text x="84" y="92" fontSize="11" fontWeight="700" textAnchor="middle" fill="#fff" opacity=".65">{initials(client.name).slice(0,1)}</text>
    </svg>}
  </div>
}
