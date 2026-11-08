import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button, ErrorText, Field, Input } from '../components/UI'
import { supabase } from '../lib/supabase'

export function Login(){
  const [signup,setSignup]=useState(false)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState<string|null>(null)
  const [message,setMessage]=useState<string|null>(null)
  const [loading,setLoading]=useState(false)
  async function submit(e:FormEvent){
    e.preventDefault();setError(null);setMessage(null);setLoading(true)
    if(!supabase)return
    try {
      if(signup){
        const result=await supabase.auth.signUp({email,password})
        if(result.error)throw result.error
        setMessage(result.data.session?'Conta criada com sucesso.':'Cadastro recebido. Confirme seu e-mail antes de entrar.')
      } else {
        const result=await supabase.auth.signInWithPassword({email,password})
        if(result.error)throw result.error
      }
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setLoading(false)}
  }
  return <div className="auth-shell">
    <div className="auth-brand">
      <div className="auth-logo">VITRA<span>CAR</span></div>
      <div className="auth-hero">
        <h1>Seu negócio merece uma <span>gestão de alto nível.</span></h1>
        <p>Clientes, veículos, orçamentos, finanças e fidelidade em uma plataforma feita para estética automotiva.</p>
      </div>
      <div className="auth-foot">VitraCar · Sistema de gestão automotiva</div>
    </div>
    <div className="auth-side"><div className="auth-form">
      <span className="eyebrow"><ShieldCheck size={13} style={{display:'inline-block',verticalAlign:'middle',marginRight:6}}/> ÁREA SEGURA</span>
      <h2>{signup?'Criar sua conta':'Bem-vindo de volta'}</h2>
      <p>{signup?'Comece configurando seu estabelecimento.':'Entre com suas credenciais para acessar o painel.'}</p>
      <form onSubmit={submit}>
        <Field label="E-mail"><Input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com" autoComplete="email"/></Field>
        <Field label="Senha"><Input required type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" autoComplete={signup?'new-password':'current-password'}/></Field>
        <ErrorText message={error}/>
        {message&&<div className="success-text">{message}</div>}
        <Button disabled={loading} type="submit"><LockKeyhole size={16}/>{loading?'Aguarde...':signup?'Criar conta':'Entrar no sistema'}<ArrowRight size={15}/></Button>
      </form>
      <div className="auth-switch">
        {signup?'Já tem uma conta?':'Ainda não tem uma conta?'}{' '}
        <button onClick={()=>{setSignup(s=>!s);setError(null);setMessage(null)}}>{signup?'Fazer login':'Criar conta'}</button>
      </div>
    </div></div>
  </div>
}
export function Onboarding({onDone}:{onDone:()=>Promise<void>}){
  const [name,setName]=useState('')
  const [error,setError]=useState<string|null>(null)
  const [working,setWorking]=useState(false)
  async function submit(e:FormEvent){
    e.preventDefault();setWorking(true);setError(null)
    try {
      if(!supabase)throw new Error('Conexão indisponível')
      const {error}=await supabase.rpc('create_company',{p_name:name.trim()})
      if(error)throw error
      await onDone()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setWorking(false)}
  }
  return <div className="auth-shell">
    <div className="auth-brand"><div className="auth-logo">VITRA<span>CAR</span></div>
      <div className="auth-hero"><h1>Vamos preparar sua <span>operação.</span></h1>
        <p>Um painel exclusivo para seu estabelecimento, com dados protegidos por empresa.</p></div>
      <div className="auth-foot">Acesso restrito a membros autorizados.</div></div>
    <div className="auth-side"><div className="auth-form">
      <span className="eyebrow">PRIMEIRA CONFIGURAÇÃO</span><h2>Nome do estabelecimento</h2>
      <p>Esta será a identificação principal no dashboard e nos orçamentos.</p>
      <form onSubmit={submit}>
        <Field label="Estabelecimento"><Input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: VitraCar Studio"/></Field>
        <ErrorText message={error}/>
        <Button type="submit" disabled={working}>{working?'Criando...':'Criar estabelecimento'}<ArrowRight size={16}/></Button>
      </form>
      <p className="small-note" style={{marginTop:20}}>O usuário inicial será cadastrado como administrador do estabelecimento.</p>
    </div></div>
  </div>
}
