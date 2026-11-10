import { jsPDF } from 'jspdf'
import type { Company, Quote, QuoteItem, Client, Vehicle } from '../types'
import { date, formatPhone, formatPlate, formatQuoteNumber, money } from './utils'
import { quoteStatusLabel, quoteSubtotal } from './commerce'

type Logo = {data:string;format:string;ratio:number}
const logoCache=new Map<string,Promise<Logo|null>>()
async function loadLogo(url:string|null):Promise<Logo|null>{
  if(!url||typeof window==='undefined')return null
  if(logoCache.has(url))return logoCache.get(url)!
  const task=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500)
    try{
      const response=await fetch(url,{signal:controller.signal})
      if(!response.ok)return null
      const blob=await response.blob()
      if(blob.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(blob.type))return null
      const data=await new Promise<string>((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=fail;r.readAsDataURL(blob)})
      const ratio=await new Promise<number>((ok)=>{
        const image=new Image(),timeout=setTimeout(()=>ok(1),1500)
        image.onload=()=>{clearTimeout(timeout);ok(image.naturalWidth/image.naturalHeight||1)}
        image.onerror=()=>{clearTimeout(timeout);ok(1)};image.src=data
      })
      return {data,format:blob.type==='image/png'?'PNG':blob.type==='image/webp'?'WEBP':'JPEG',ratio}
    }catch{return null}finally{clearTimeout(timer)}
  })()
  if(logoCache.size>=8)logoCache.delete(logoCache.keys().next().value!)
  logoCache.set(url,task)
  return task
}

const C={ink:'#0B0D12',blue:'#0B0D12',lime:'#B9FC01',muted:'#616977',line:'#F4F7F1',soft:'#F4F7F1',white:'#FFFFFF'}
const clean=(s:string)=>s.replace(/\u00a0|\u202f/g,' ').replace(/\t/g,' ')
const cash=(value:number)=>clean(money(value))

/** Vector PDF: selectable text, repeated table headers, and overflow-safe notes. */
export async function createQuoteDocument(q:Quote,items:QuoteItem[],client:Client,vehicle:Vehicle,company:Company):Promise<jsPDF>{
  if(!items.length)throw new Error('O orçamento precisa de pelo menos um item.')
  if(items.some(i=>!i.description.trim()||!Number.isSafeInteger(i.quantity)||i.quantity<1||!Number.isSafeInteger(i.unit_cents)||i.unit_cents<0))throw new Error('Há itens inválidos no orçamento.')
  const subtotal=quoteSubtotal(items)
  if(!Number.isSafeInteger(subtotal)||!Number.isSafeInteger(q.discount_cents)||q.discount_cents<0||q.discount_cents>subtotal)throw new Error('Confira os valores e o desconto do orçamento.')
  const total=subtotal-q.discount_cents,preview=!q.quote_number
  const ref=preview?'PRÉVIA':formatQuoteNumber(q.quote_number)
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true})
  pdf.setProperties({title:`Orçamento ${ref} - ${company.name}`,subject:`Proposta de serviços para ${client.name}`,author:company.name,creator:'VitraCar'})
  const logo=await loadLogo(company.logo_url)
  const L=18,R=192,W=174,BOTTOM=269,LINE=4.6
  let y=0
  function font(size:number,bold=false,color=C.ink){pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(color)}
  function lines(text:string,width:number,size=10,bold=false):string[]{font(size,bold);return pdf.splitTextToSize(clean(text),width) as string[]}
  function write(text:string,x:number,at:number,size=10,bold=false,color=C.ink,align:'left'|'right'='left'){
    font(size,bold,color);pdf.text(clean(text),x,at,{align})
  }
  function smallHeader(){
    pdf.setFillColor(C.ink);pdf.roundedRect(L,14,W,21,3,3,'F')
    write('VITRACAR',L+6,27,13,true,C.white)
    write(`ORÇAMENTO ${ref}`,R-6,27,10,true,C.lime,'right')
    y=44
  }
  function nextPage(table=false){pdf.addPage();smallHeader();if(table)tableHeader()}
  function ensure(height:number){if(y+height>BOTTOM)nextPage()}
  function tableHeader(){
    pdf.setFillColor(C.blue);pdf.roundedRect(L,y,W,10,2,2,'F')
    write('ITEM',L+4,y+6.5,8,true,C.white)
    write('QTD.',117,y+6.5,8,true,C.white,'right')
    write('UNITÁRIO',151,y+6.5,8,true,C.white,'right')
    write('TOTAL',R-4,y+6.5,8,true,C.white,'right');y+=12
  }
  // Branded header, using the registered business rather than a fictional company.
  const titleX=logo?L+33:L+7,titleWidth=logo?75:101
  const businessLines=lines(company.name,titleWidth,15,true)
  const headerH=Math.max(43,24+businessLines.length*6)
  pdf.setFillColor(C.ink);pdf.roundedRect(L,16,W,headerH,4,4,'F')
  pdf.setFillColor(C.blue);pdf.roundedRect(L,23,2,headerH-14,1,1,'F')
  if(logo){
    pdf.setFillColor(C.white);pdf.roundedRect(L+6,25,23,23,3,3,'F')
    const maxW=19,maxH=19,w=Math.min(maxW,maxH*logo.ratio),h=w/logo.ratio
    try{pdf.addImage(logo.data,logo.format,L+6+(23-w)/2,25+(23-h)/2,w,h)}catch{write('VC',L+10,39,13,true,C.blue)}
  }
  write('PROPOSTA COMERCIAL',titleX,27,7.5,true,C.lime)
  businessLines.forEach((line,i)=>write(line,titleX,37+i*6,15,true,C.white))
  write('ORÇAMENTO',R-7,28,8,true,'#B5BBC6','right')
  write(ref,R-7,40,preview?14:19,true,C.white,'right')
  write(date(q.created_at),R-7,49,8,false,'#B5BBC6','right')
  y=16+headerH+9
  const contact=[company.phone?formatPhone(company.phone):null,company.email,company.tax_id?`CPF/CNPJ: ${company.tax_id}`:null].filter(Boolean).join('  |  ')
  if(contact){const a=lines(contact,W,8.5);a.forEach(line=>{write(line,L,y,8.5,false,C.muted);y+=4.5})}
  if(company.address){const a=lines(company.address,W,8.5);a.forEach(line=>{if(y+5>BOTTOM)nextPage();write(line,L,y,8.5,false,C.muted);y+=4.5})}
  y+=7
  const nameLines=lines(client.name,75,12,true)
  const vehicleLines=lines(`${vehicle.brand} ${vehicle.model}`,75,12,true)
  const vehicleMeta=lines([vehicle.year?String(vehicle.year):null,vehicle.color].filter(Boolean).join(' · '),75,9)
  const clientPhone=lines(formatPhone(client.whatsapp)||'WhatsApp não informado',75,9)
  const boxH=Math.max(44,24+nameLines.length*5.4+clientPhone.length*4.6,31+vehicleLines.length*5.4+vehicleMeta.length*4.6)
  ensure(boxH+13)
  pdf.setFillColor(C.soft);pdf.roundedRect(L,y,84,boxH,3,3,'F');pdf.roundedRect(L+90,y,84,boxH,3,3,'F')
  write('PREPARADO PARA',L+5,y+8,7.5,true,C.blue)
  nameLines.forEach((line,i)=>write(line,L+5,y+16+i*5.4,12,true))
  clientPhone.forEach((line,i)=>write(line,L+5,y+23+(nameLines.length-1)*5.4+i*4.6,9,false,C.muted))
  write('VEÍCULO',L+95,y+8,7.5,true,C.blue)
  vehicleLines.forEach((line,i)=>write(line,L+95,y+16+i*5.4,12,true))
  let vy=y+23+(vehicleLines.length-1)*5.4
  write(formatPlate(vehicle.plate),L+95,vy,11,true)
  vehicleMeta.forEach((line,i)=>write(line,L+95,vy+6+i*4.6,9,false,C.muted))
  y+=boxH+12
  ensure(28)
  write('ITENS DA PROPOSTA',L,y,10,true);write(preview?'Prévia não salva':quoteStatusLabel(q.status),R,y,8,false,C.muted,'right');y+=7
  tableHeader()
  for(let index=0;index<items.length;index++){
    const item=items[index],textLines=lines((item.item_kind==='product'?'Produto: ':'')+item.description,85,10)
    let offset=0
    while(offset<textLines.length){
      if(y+15>BOTTOM)nextPage(true)
      const continuation=offset>0,extra=continuation?4:0
      const capacity=Math.max(1,Math.floor((BOTTOM-y-9-extra)/LINE))
      const part=textLines.slice(offset,offset+capacity),height=9+extra+part.length*LINE
      pdf.setFillColor(index%2?C.white:C.soft);pdf.rect(L,y,W,height,'F')
      if(continuation)write('CONTINUAÇÃO DO ITEM',L+4,y+4.5,6.5,true,C.muted)
      part.forEach((line,i)=>write(line,L+4,y+7+extra+i*LINE,10))
      if(!continuation){
        write(String(item.quantity),117,y+7,9.5,false,C.ink,'right')
        write(cash(item.unit_cents),151,y+7,9,false,C.ink,'right')
        write(cash(item.quantity*item.unit_cents),R-4,y+7,9.5,true,C.ink,'right')
      }
      pdf.setDrawColor(C.line);pdf.setLineWidth(.2);pdf.line(L,y+height,R,y+height)
      y+=height;offset+=part.length
      if(offset<textLines.length)nextPage(true)
    }
  }
  y+=10
  ensure(48)
  write('RESUMO DA PROPOSTA',L,y+5,8,true,C.blue)
  write('Valores em reais (BRL).',L,y+12,8.5,false,C.muted)
  write('Este orçamento não é comprovante',L,y+18,8.5,false,C.muted)
  write('de pagamento.',L,y+23,8.5,false,C.muted)
  write('Subtotal',116,y+5,9,false,C.muted);write(cash(subtotal),R-4,y+5,10,true,C.ink,'right')
  write('Desconto',116,y+13,9,false,C.muted);write(cash(q.discount_cents),R-4,y+13,10,false,C.ink,'right')
  pdf.setFillColor(C.ink);pdf.roundedRect(112,y+19,80,23,3,3,'F')
  write('TOTAL',117,y+27,7.5,true,C.white)
  write(cash(total),R-5,y+36,18,true,C.lime,'right')
  y+=52
  if(q.notes?.trim()){
    ensure(22);write('OBSERVAÇÕES',L,y,9,true,C.blue);y+=7
    const notes=lines(q.notes.trim(),W,9.5)
    for(const line of notes){
      if(y+LINE>BOTTOM){nextPage();write('OBSERVAÇÕES · CONTINUAÇÃO',L,y,8,true,C.blue);y+=8}
      write(line,L,y,9.5,false,C.muted);y+=LINE
    }
  }
  for(let page=1;page<=pdf.getNumberOfPages();page++){
    pdf.setPage(page);pdf.setDrawColor(C.line);pdf.setLineWidth(.25);pdf.line(L,280,R,280)
    write(`VitraCar · Orçamento ${ref}`,L,287,7.5,false,C.muted)
    write(`${page} / ${pdf.getNumberOfPages()}`,R,287,7.5,false,C.muted,'right')
  }
  return pdf
}

export async function downloadQuotePDF(q:Quote,items:QuoteItem[],client:Client,vehicle:Vehicle,company:Company){
  const pdf=await createQuoteDocument(q,items,client,vehicle,company)
  pdf.save(`vitracar-orcamento-${q.quote_number?String(q.quote_number).padStart(5,'0'):'previa'}.pdf`)
}
