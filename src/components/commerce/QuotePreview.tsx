import { useEffect, useState } from 'react'
import { Download, FileText, LoaderCircle } from 'lucide-react'
import { Modal } from '../Modal'
import { Button, ErrorText } from '../UI'
import { formatQuoteNumber } from '../../lib/utils'
import { readableError } from '../../lib/commerce'
import type { Client, Company, Quote, QuoteItem, Vehicle } from '../../types'

export type QuoteDocumentData={quote:Quote;items:QuoteItem[];client:Client;vehicle:Vehicle;company:Company}
export function QuotePreview({document:doc,onClose}:{document:QuoteDocumentData;onClose:()=>void}){
  const [url,setUrl]=useState<string|null>(null),[error,setError]=useState<string|null>(null)
  useEffect(()=>{
    let active=true,objectUrl:string|null=null
    setUrl(null);setError(null)
    void import('../../lib/pdf').then(({createQuoteDocument})=>createQuoteDocument(doc.quote,doc.items,doc.client,doc.vehicle,doc.company)).then(pdf=>{
      if(!active)return
      objectUrl=URL.createObjectURL(pdf.output('blob'));setUrl(objectUrl)
    }).catch(cause=>{if(active)setError(readableError(cause))})
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}
  },[doc])
  const filename=`vitracar-orcamento-${doc.quote.quote_number?String(doc.quote.quote_number).padStart(5,'0'):'previa'}.pdf`
  return <Modal title={doc.quote.quote_number?`Orçamento ${formatQuoteNumber(doc.quote.quote_number)}`:'Prévia do orçamento'} onClose={onClose} className="cx-dialog cx-pdf-dialog">
    <div className="cx-pdf-toolbar"><div><FileText size={19}/><span><strong>{doc.client.name}</strong><small>{doc.vehicle.brand} {doc.vehicle.model} · {doc.quote.quote_number?'PDF pronto para compartilhar':'Prévia não salva no sistema'}</small></span></div>
      {url&&<a className="btn btn-primary btn-small" href={url} download={filename}><Download size={15}/>Baixar PDF</a>}
    </div>
    <ErrorText message={error}/>
    {url?<iframe title="Documento PDF do orçamento" className="cx-pdf-frame" src={`${url}#toolbar=0&navpanes=0`}/>:
      !error?<div className="cx-pdf-loading"><LoaderCircle size={24} className="spin"/><span>Preparando seu orçamento...</span></div>:null}
    <div className="cx-pdf-bottom"><small>O PDF mantém os textos selecionáveis e os valores detalhados.{url&&<> Caso o navegador não mostre a prévia, use <a href={url} download={filename}>Baixar PDF</a>.</>}</small><Button variant="secondary" onClick={onClose}>Fechar prévia</Button></div>
  </Modal>
}
