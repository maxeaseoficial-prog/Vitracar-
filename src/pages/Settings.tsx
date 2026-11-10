import { useState, type FormEvent } from 'react'
import { Building2, Camera, LogOut, Settings2, ShieldCheck, UploadCloud } from 'lucide-react'
import { AttentionNotice, Button, ErrorText, Field, Input, PageHeading, Panel, Select, Textarea } from '../components/UI'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'

export function Settings(){
  const {company,profile,updateCompany,uploadLogo,isDemo}=useStore()
  const [name,setName]=useState(company.name),[phone,setPhone]=useState(company.phone||'')
  const [email,setEmail]=useState(company.email||''),[address,setAddress]=useState(company.address||'')
  const [taxId,setTaxId]=useState(company.tax_id||''),[timezone,setTimezone]=useState(company.timezone)
  const [file,setFile]=useState<File|null>(null),[error,setError]=useState<string|null>(null)
  const [message,setMessage]=useState<string|null>(null),[working,setWorking]=useState(false)
  async function submit(e:FormEvent){
    e.preventDefault();setWorking(true);setError(null);setMessage(null)
    try{
      if(name.trim().length<2)throw new Error('Informe o nome do estabelecimento.')
      await updateCompany({name:name.trim(),phone:phone||null,email:email||null,address:address||null,
        tax_id:taxId||null,timezone})
      if(file)await uploadLogo(file)
      setMessage('Configurações atualizadas com sucesso.')
      setFile(null)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setWorking(false)}
  }
  async function logout(){
    if(supabase){const {error}=await supabase.auth.signOut();if(error)setError(error.message)}
  }
  return <>
    <PageHeading eyebrow="ADMINISTRAÇÃO" title="Configurações" subtitle="Personalize os dados do estabelecimento e os documentos."/>
    <div className="dashboard-grid dashboard-grid-secondary">
      <Panel title="Dados do estabelecimento" action={<Building2 size={18} color="#91a1b5"/>}>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:17}}>
          <div className="form-grid">
            <div className="span-2"><Field label="Nome comercial"><Input required minLength={2} value={name} onChange={e=>setName(e.target.value)}/></Field></div>
            <Field label="Telefone / WhatsApp"><Input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(65) 99999-9999"/></Field>
            <Field label="E-mail comercial"><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contato@empresa.com"/></Field>
            <div className="span-2"><Field label="CPF / CNPJ (opcional)"><Input value={taxId} onChange={e=>setTaxId(e.target.value)}/></Field></div>
            <div className="span-2"><Field label="Endereço comercial"><Textarea rows={2} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Endereço usado em orçamentos"/></Field></div>
            <div className="span-2"><Field label="Fuso horário de operação"><Select value={timezone} onChange={e=>setTimezone(e.target.value)}>
              <option value="America/Sao_Paulo">Brasília / São Paulo</option>
              <option value="America/Cuiaba">Cuiabá / Mato Grosso</option>
              <option value="America/Manaus">Manaus / Amazonas</option>
              <option value="America/Recife">Recife / Nordeste</option>
              <option value="America/Rio_Branco">Rio Branco / Acre</option>
            </Select></Field></div>
          </div>
          <Field label="Logo do estabelecimento (opcional)" hint={isDemo?'Disponível após conectar um banco de dados.':'JPG, PNG ou WEBP até 5 MB; recomendada versão horizontal transparente.'}>
            <Input type="file" disabled={isDemo} accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/>
          </Field>
          {company.logo_url?<div style={{border:'1px solid #e8edf4',padding:12,borderRadius:10,background:'#f8fafc',width:180}}>
            <img alt="Logo da empresa" src={company.logo_url} style={{width:'100%',maxHeight:80,objectFit:'contain'}}/></div>:
            <div className="small-note"><Camera size={14} style={{display:'inline-block',verticalAlign:'middle',marginRight:7}}/>Nenhuma logo enviada; o sistema utiliza o nome VitraCar como fallback.</div>}
          <ErrorText message={error}/>
          {message&&<div className="success-text">{message}</div>}
          <div className="form-actions"><Button disabled={working} type="submit"><UploadCloud size={16}/>{working?'Salvando...':'Salvar alterações'}</Button></div>
        </form>
      </Panel>
      <div style={{display:'flex',flexDirection:'column',gap:19}}>
        <Panel title="Perfil e segurança" action={<ShieldCheck size={18} color="#91a1b5"/>}>
          <div className="detail-line"><span>Seu acesso</span><strong>{profile.name||'Administrador'}</strong></div>
          <div className="detail-line"><span>Permissão</span><strong>{profile.role==='admin'?'Administrador':'Colaborador'}</strong></div>
          <div className="detail-line"><span>Autenticação</span><strong>{isDemo?'Prévia sem login':'Supabase Auth'}</strong></div>
          {!isDemo&&<Button variant="secondary" onClick={()=>void logout()} style={{marginTop:19}}><LogOut size={15}/> Sair da conta</Button>}
        </Panel>
        <Panel title="Sobre a plataforma" action={<Settings2 size={18} color="#91a1b5"/>}>
          <div className="detail-line"><span>Produto</span><strong>VitraCar</strong></div>
          <div className="detail-line"><span>Versão</span><strong>0.1.0</strong></div>
          <div className="detail-line"><span>Veículos 3D</span><strong><a href="https://github.com/pedrosoandre/carros" target="_blank" rel="noreferrer" style={{color:'#1565d8'}}>Catálogo independente</a></strong></div>
          <p className="small-note" style={{marginTop:18}}>Os veículos tridimensionais são de autores independentes, sob licenças Creative Commons. Os créditos aparecem em cada visualização de veículo.</p>
          {isDemo&&<AttentionNotice>Esta é uma prévia sem banco conectado. Alterações são temporárias; conecte o banco antes de cadastrar clientes reais.</AttentionNotice>}
        </Panel>
      </div>
    </div>
  </>
}

