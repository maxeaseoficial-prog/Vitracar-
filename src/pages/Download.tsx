import { useEffect, useState, type ReactNode } from 'react'
import { Check, Copy, Download as DownloadIcon, MoreVertical, Share, SquarePlus, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, PageHeading, Panel } from '../components/UI'
import { canPromptInstall, detectPlatform, isIosSafari, isStandalone, promptInstall, subscribeInstall } from '../lib/pwa'
import './download.css'

function Step({n,children}:{n:number;children:ReactNode}){
  return <li className="dl-step"><span className="dl-step-n">{n}</span><div>{children}</div></li>
}

export function Download(){
  const [,refresh]=useState(0)
  const [message,setMessage]=useState<string|null>(null)
  const [copied,setCopied]=useState(false)
  useEffect(()=>subscribeInstall(()=>refresh(v=>v+1)),[])

  const platform=detectPlatform()
  const standalone=isStandalone()
  const canPrompt=canPromptInstall()
  const address=window.location.origin

  async function install(){
    setMessage(null)
    const result=await promptInstall()
    if(result==='dismissed')setMessage('Instalação cancelada. Quando quiser, é só tocar em instalar de novo.')
    if(result==='unavailable')setMessage('Seu navegador não abriu a instalação. Siga os passos abaixo.')
  }
  async function copy(){
    try{await navigator.clipboard.writeText(address);setCopied(true);window.setTimeout(()=>setCopied(false),2000)}
    catch{setMessage('Não foi possível copiar. Digite o endereço no celular.')}
  }

  return <div className="dl-page">
    <PageHeading eyebrow="APP" title="Instalar o Lavoo no celular"
      subtitle="Crie um atalho do Lavoo na tela inicial. Ele abre em tela cheia, como um aplicativo, sem precisar da loja."/>

    {standalone?<Panel className="dl-card">
      <div className="dl-status"><span className="dl-status-icon"><Check size={22}/></span>
        <div><strong>O Lavoo já está instalado neste aparelho.</strong>
          <p>Você está usando o app agora. Para instalar em outro celular, abra este mesmo endereço (/download) por ele.</p></div></div>
    </Panel>:<>
      {canPrompt&&<Panel className="dl-card">
        <div className="dl-status"><span className="dl-status-icon"><Smartphone size={22}/></span>
          <div><strong>Pronto para instalar</strong><p>Toque no botão e confirme. O atalho do Lavoo aparece na tela inicial.</p></div></div>
        <Button className="dl-install" onClick={()=>void install()}><DownloadIcon size={18}/> Instalar o Lavoo</Button>
        {message&&<p className="dl-note">{message}</p>}
      </Panel>}

      {platform==='ios'&&<Panel title="Como instalar no iPhone ou iPad" className="dl-card">
        {!isIosSafari()&&<p className="dl-warn">Você está em outro navegador. No iPhone, abra este endereço no <strong>Safari</strong> para instalar:
          <span className="dl-url">{address}/download</span></p>}
        <ol className="dl-steps">
          <Step n={1}>Toque no botão <strong>Compartilhar</strong> <Share size={16} className="dl-inline"/> na barra do Safari.</Step>
          <Step n={2}>Role a lista e toque em <strong>Adicionar à Tela de Início</strong> <SquarePlus size={16} className="dl-inline"/>.</Step>
          <Step n={3}>Confirme em <strong>Adicionar</strong>. O ícone do Lavoo aparece na tela inicial.</Step>
        </ol>
      </Panel>}

      {platform==='android'&&!canPrompt&&<Panel title="Como instalar no Android" className="dl-card">
        <ol className="dl-steps">
          <Step n={1}>Abra o menu do Chrome, os três pontinhos <MoreVertical size={16} className="dl-inline"/> no canto da tela.</Step>
          <Step n={2}>Toque em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).</Step>
          <Step n={3}>Confirme. O ícone do Lavoo aparece na tela inicial.</Step>
        </ol>
        <p className="dl-note">Se a opção não aparecer, abra esta página no Chrome e não em uma janela anônima.</p>
      </Panel>}

      {platform==='desktop'&&<Panel title="Instalar no celular" className="dl-card">
        <p className="dl-note-top">Esta página precisa ser aberta <strong>no celular</strong>. Abra o endereço abaixo por lá e siga os passos para instalar:</p>
        <div className="dl-copy"><span className="dl-url">{address}/download</span>
          <Button variant="secondary" size="small" onClick={()=>void copy()}>{copied?<><Check size={15}/> Copiado</>:<><Copy size={15}/> Copiar</>}</Button></div>
        {canPrompt&&<p className="dl-note">Também é possível instalar neste computador usando o botão acima.</p>}
        {message&&!canPrompt&&<p className="dl-note">{message}</p>}
      </Panel>}
    </>}
  </div>
}

/** Versão aberta (sem login) de /download: é só o passo a passo de instalação, sem nenhum dado da empresa.
 *  Assim o link funciona direto no celular de quem ainda não entrou. */
export function DownloadPublic(){
  return <div className="dl-public">
    <img src="/logo-lavoo-color.png" alt="Lavoo" className="dl-public-logo"/>
    <Download/>
    <Link to="/" className="btn btn-secondary dl-public-login">Entrar no sistema</Link>
  </div>
}
