import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Circle, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { Button, ErrorText, Field, Input } from '../components/UI'
import { supabase } from '../lib/supabase'
import { enterWithRegistration } from '../lib/direct-registration'
import { MAX_PASSWORD_LENGTH, passwordChecks, validEmail, validateRegistration } from '../lib/password-policy'
import '../auth-brand.css'
import '../auth-registration.css'

function AuthLogo(){
  return <div className="auth-logo">
    <img src="/logo-lavoo-white.png" alt="Lavoo" className="auth-logo-image" loading="eager" decoding="async"/>
  </div>
}

function PasswordInput({id,label,value,onChange,visible,onToggle,disabled,signup,autoFocus=false,invalid=false,describedBy}:{
  id:string; label:string; value:string; onChange:(v:string)=>void; visible:boolean; onToggle:()=>void;
  disabled:boolean; signup:boolean; autoFocus?:boolean; invalid?:boolean; describedBy?:string
}){
  return <div className="field auth-password-field">
    <label className="field-label" htmlFor={id}>{label}</label>
    <div className="auth-password-wrap">
      <input id={id} className="form-input" required type={visible?'text':'password'} value={value}
        onChange={e=>onChange(e.target.value)} autoComplete={signup?'new-password':'current-password'}
        maxLength={signup?MAX_PASSWORD_LENGTH:undefined} disabled={disabled} autoFocus={autoFocus}
        aria-invalid={invalid||undefined} aria-describedby={describedBy}
        placeholder={id==='password-confirm'?'Digite a mesma senha novamente':'Sua senha'}/>
      <button type="button" className="auth-password-toggle" aria-label={visible?`Ocultar ${label.toLowerCase()}`:`Mostrar ${label.toLowerCase()}`}
        aria-pressed={visible} onClick={onToggle} disabled={disabled}>
        {visible?<EyeOff size={18}/>:<Eye size={18}/>}
      </button>
    </div>
  </div>
}

export function Login(){
  const [signup,setSignup]=useState(false)
  const [step,setStep]=useState<1|2>(1)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [showConfirm,setShowConfirm]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [loading,setLoading]=useState(false)
  const inFlight=useRef(false)
  const checks=passwordChecks(password)
  const passwordValid=password.length<=MAX_PASSWORD_LENGTH&&checks.every(check=>check.valid)
  const passwordsMatch=confirmPassword.length>0&&password===confirmPassword

  function switchMode(){
    if(inFlight.current)return
    setSignup(value=>!value);setStep(1);setPassword('');setConfirmPassword('')
    setShowPassword(false);setShowConfirm(false);setError(null)
  }
  async function submit(e:FormEvent){
    e.preventDefault()
    if(inFlight.current)return
    setError(null)
    if(signup&&step===1){
      if(!validEmail(email.trim())){setError('Informe um e-mail válido.');return}
      if(!passwordValid){setError('A senha precisa ter pelo menos 8 caracteres, letras, números e símbolos.');return}
      setConfirmPassword('');setShowPassword(false);setShowConfirm(false);setStep(2)
      return
    }
    if(signup){
      const checked=validateRegistration({email,password,confirmPassword})
      if(!checked.ok){setError(checked.message);return}
    }
    inFlight.current=true;setLoading(true)
    try{
      if(!supabase)throw new Error('Conexão indisponível. Tente novamente em instantes.')
      if(signup){
        await enterWithRegistration({action:'signup',email,password,confirmPassword})
      }else{
        const result=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
        if(result.error){
          if(result.error.code==='email_not_confirmed'||/email not confirmed/i.test(result.error.message)){
            // Finish a previous pending registration only after server-side password verification.
            await enterWithRegistration({action:'finish-pending',email,password})
          }else{
            throw result.error
          }
        }else if(!result.data.session){
          throw new Error('Não foi possível iniciar a sessão. Tente fazer login novamente.')
        }
      }
      setPassword('');setConfirmPassword('')
    }catch(cause){
      const code=(cause as {code?:string})?.code
      const detail=cause instanceof Error?cause.message:''
      setError(code==='invalid_credentials'||/invalid login credentials/i.test(detail)?'E-mail ou senha incorretos.':
        cause instanceof Error?cause.message:'Não foi possível concluir. Tente novamente.')
    }finally{inFlight.current=false;setLoading(false)}
  }

  return <div className="auth-shell">
    <div className="auth-brand">
      <AuthLogo/>
      <div className="auth-hero">
        <h1>Seu negócio merece uma <span>gestão de alto nível.</span></h1>
        <p>Clientes, veículos, orçamentos, finanças e fidelidade em uma plataforma feita para estética automotiva.</p>
      </div>
      <div className="auth-foot">Lavoo · Sistema de gestão automotiva</div>
    </div>
    <div className="auth-side"><div className="auth-form">
      <span className="eyebrow"><ShieldCheck size={13} style={{display:'inline-block',verticalAlign:'middle',marginRight:6}}/> ÁREA SEGURA</span>
      <h2>{signup?step===1?'Criar sua conta':'Confirme sua senha':'Bem-vindo de volta'}</h2>
      <p>{signup?step===1?'Defina seu acesso. Na próxima etapa, repita a senha.':'Digite novamente a senha que você acabou de escolher.':'Entre com suas credenciais para acessar o painel.'}</p>
      {signup&&<ol className="auth-steps" aria-label="Etapas do cadastro">
        <li className={step===1?'current':'complete'} aria-current={step===1?'step':undefined}>
          <span>{step===2?<Check size={14}/>:1}</span> E-mail e senha
        </li>
        <li className={step===2?'current':''} aria-current={step===2?'step':undefined}><span>2</span> Confirmar senha</li>
      </ol>}
      <form onSubmit={submit} aria-busy={loading}>
        {(!signup||step===1)?<>
          <Field label="E-mail"><Input required type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="voce@empresa.com" autoComplete="email" disabled={loading} maxLength={254}/></Field>
          <PasswordInput id="account-password" label="Senha" value={password} onChange={setPassword}
            visible={showPassword} onToggle={()=>setShowPassword(v=>!v)} disabled={loading} signup={signup}
            describedBy={signup?'password-rules':undefined}/>
          {signup&&<ul className="auth-password-rules" id="password-rules" aria-label="Requisitos da senha">
            {checks.map(check=><li key={check.id} className={check.valid?'met':''}>
              {check.valid?<Check size={14} aria-hidden="true"/>:<Circle size={12} aria-hidden="true"/>}
              <span>{check.label}</span><span className="sr-only">{check.valid?' — atendido':' — pendente'}</span>
            </li>)}
          </ul>}
        </>:<>
          <div className="auth-account-summary"><Mail size={19}/><div><small>Seu e-mail de acesso</small><strong>{email.trim()}</strong></div></div>
          <PasswordInput id="password-confirm" label="Confirmar senha" value={confirmPassword} onChange={setConfirmPassword}
            visible={showConfirm} onToggle={()=>setShowConfirm(v=>!v)} disabled={loading} signup autoFocus
            invalid={confirmPassword.length>0&&!passwordsMatch} describedBy="password-match"/>
          <p id="password-match" className={`auth-password-match ${passwordsMatch?'match':confirmPassword?'mismatch':''}`} aria-live="polite">
            {passwordsMatch?'As senhas coincidem.':confirmPassword?'As senhas não coincidem.':'Repita a senha da primeira etapa.'}
          </p>
        </>}
        <ErrorText message={error}/>
        <Button disabled={loading||(signup&&(step===1?(!validEmail(email.trim())||!passwordValid):!passwordsMatch))} type="submit">
          {signup&&step===1?<ArrowRight size={16}/>:<LockKeyhole size={16}/>}
          {loading?signup?'Criando sua conta...':'Entrando...':signup?step===1?'Continuar':'Criar conta e entrar':'Entrar no sistema'}
        </Button>
        {signup&&step===2&&<button type="button" className="auth-back" disabled={loading}
          onClick={()=>{setStep(1);setConfirmPassword('');setShowConfirm(false);setError(null)}}><ArrowLeft size={15}/> Voltar e editar</button>}
        {signup&&<p className="auth-direct-access"><ShieldCheck size={14}/> Ao concluir, você entra automaticamente. Sem confirmação por e-mail.</p>}
      </form>
      <div className="auth-switch">
        {signup?'Já tem uma conta?':'Ainda não tem uma conta?'}{' '}
        <button type="button" disabled={loading} onClick={switchMode}>{signup?'Fazer login':'Criar conta'}</button>
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
    <div className="auth-brand"><AuthLogo/>
      <div className="auth-hero"><h1>Vamos preparar sua <span>operação.</span></h1>
        <p>Um painel exclusivo para seu estabelecimento, com dados protegidos por empresa.</p></div>
      <div className="auth-foot">Acesso restrito a membros autorizados.</div></div>
    <div className="auth-side"><div className="auth-form">
      <span className="eyebrow">PRIMEIRA CONFIGURAÇÃO</span><h2>Nome do estabelecimento</h2>
      <p>Esta será a identificação principal no dashboard e nos orçamentos.</p>
      <form onSubmit={submit}>
        <Field label="Estabelecimento"><Input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Lavoo"/></Field>
        <ErrorText message={error}/>
        <Button type="submit" disabled={working}>{working?'Criando...':'Criar estabelecimento'}<ArrowRight size={16}/></Button>
      </form>
      <p className="small-note" style={{marginTop:20}}>O usuário inicial será cadastrado como administrador do estabelecimento.</p>
    </div></div>
  </div>
}
