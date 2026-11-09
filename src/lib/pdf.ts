import { jsPDF } from 'jspdf'
import type { Company, Quote, QuoteItem, Client, Vehicle } from '../types'
import { date, formatPlate, formatQuoteNumber, money } from './utils'

// Baixa a logo pública da empresa para embutir no PDF. Falha silenciosa: sem
// logo, o cabeçalho usa apenas o nome.
async function loadLogo(url: string | null): Promise<{ data: string; format: string; ratio: number } | null> {
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    const format = blob.type === 'image/png' ? 'PNG' : blob.type === 'image/webp' ? 'WEBP' : 'JPEG'
    const data = await new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = fail; r.readAsDataURL(blob) })
    const ratio = await new Promise<number>(ok => { const img = new Image(); img.onload = () => ok(img.width / img.height || 1); img.onerror = () => ok(1); img.src = data })
    return { data, format, ratio }
  } catch { return null }
}

export async function downloadQuotePDF(q: Quote, items: QuoteItem[], client: Client, vehicle: Vehicle, company: Company) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogo(company.logo_url)
  pdf.setFillColor(1, 49, 205)
  pdf.rect(0, 0, 210, 46, 'F')
  pdf.setFont('helvetica','bold'); pdf.setFontSize(20); pdf.setTextColor('#ffffff')
  let titleX = 18
  if (logo) {
    const h = 18, w = Math.min(40, h * logo.ratio)
    pdf.setFillColor(255, 255, 255); pdf.roundedRect(16, 12, w + 4, h + 4, 2, 2, 'F')
    pdf.addImage(logo.data, logo.format, 18, 14, w, h)
    titleX = 18 + w + 8
  }
  pdf.text((pdf.splitTextToSize(company.name.toUpperCase(), 120 - titleX) as string[])[0], titleX, 24)
  pdf.setFontSize(10); pdf.setFont('helvetica','normal')
  pdf.text('ORÇAMENTO ' + formatQuoteNumber(q.quote_number).replace('#', 'Nº '), 194, 21, { align:'right' })
  pdf.text('Emitido em ' + date(q.created_at), 194, 28, { align:'right' })
  let y=59
  pdf.setTextColor(19,36,58); pdf.setFontSize(11); pdf.setFont('helvetica','bold')
  pdf.text(company.name,18,y)
  pdf.setFontSize(9);pdf.setFont('helvetica','normal');pdf.setTextColor(104,117,134)
  y+=6
  ;[company.phone,company.email,company.address].filter(Boolean).forEach(line=>{pdf.text(String(line),18,y); y+=5})
  y+=7
  pdf.setDrawColor(229,235,243); pdf.line(18,y,192,y);y+=10
  pdf.setTextColor(19,36,58);pdf.setFont('helvetica','bold');pdf.setFontSize(10)
  pdf.text('CLIENTE',18,y);pdf.text('VEÍCULO',109,y);y+=7
  pdf.setFont('helvetica','normal');pdf.setFontSize(10)
  pdf.text((pdf.splitTextToSize(client.name,85) as string[])[0],18,y)
  pdf.text((pdf.splitTextToSize(vehicle.brand+' '+vehicle.model,83) as string[])[0],109,y);y+=6
  pdf.setTextColor(104,117,134);pdf.setFontSize(9)
  pdf.text(client.whatsapp||'Sem telefone',18,y)
  pdf.text(formatPlate(vehicle.plate),109,y);y+=15
  pdf.setFillColor(239,244,251);pdf.roundedRect(18,y,174,10,2,2,'F')
  pdf.setTextColor(27,44,68);pdf.setFont('helvetica','bold');pdf.setFontSize(9)
  pdf.text('SERVIÇO',22,y+6.5);pdf.text('QTD.',129,y+6.5)
  pdf.text('VALOR',188,y+6.5,{align:'right'});y+=15
  let subtotal=0
  for(const item of items){
    const lineTotal=item.unit_cents*item.quantity
    subtotal+=lineTotal
    pdf.setFont('helvetica','normal');pdf.setTextColor(38,52,72);pdf.setFontSize(9)
    const lines=pdf.splitTextToSize(item.description,98) as string[]
    const needed=Math.max(9,lines.length*5+4)
    if(y+needed>260){pdf.addPage();y=22}
    pdf.text(lines,22,y+4);pdf.text(String(item.quantity),132,y+4)
    pdf.text(money(lineTotal),188,y+4,{align:'right'})
    y+=needed;pdf.setDrawColor(239,242,247);pdf.line(18,y,192,y);y+=5
  }
  if(y>244){pdf.addPage();y=22}
  pdf.setTextColor(110,121,137);pdf.setFontSize(10)
  pdf.text('Subtotal',127,y+5);pdf.text(money(subtotal),188,y+5,{align:'right'});y+=8
  pdf.text('Desconto',127,y+5);pdf.text(money(q.discount_cents),188,y+5,{align:'right'});y+=9
  pdf.setFillColor(185,252,1);pdf.roundedRect(118,y,74,15,3,3,'F')
  pdf.setTextColor(11,13,18);pdf.setFont('helvetica','bold');pdf.setFontSize(12)
  pdf.text('TOTAL',124,y+9.5);pdf.text(money(Math.max(0,subtotal-q.discount_cents)),188,y+9.5,{align:'right'})
  if(q.notes){
    y+=25; if(y>265){pdf.addPage();y=24}
    pdf.setTextColor(25,40,61);pdf.setFontSize(10);pdf.text('Observações',18,y)
    pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(102,113,128)
    // Observações longas continuam na página seguinte em vez de passar do rodapé.
    let line=y+7
    for(const text of pdf.splitTextToSize(q.notes,166) as string[]){
      if(line>272){pdf.addPage();line=24}
      pdf.text(text,18,line);line+=4.6
    }
  }
  const pages=pdf.getNumberOfPages()
  for(let p=1;p<=pages;p++){
    pdf.setPage(p);pdf.setDrawColor(232,237,243);pdf.line(18,281,192,281)
    pdf.setFontSize(8);pdf.setTextColor(139,150,164)
    pdf.text(company.name + ' · Orçamento gerado pela VitraCar',18,287)
    pdf.text(`${p} / ${pages}`,192,287,{align:'right'})
  }
  pdf.save(`orcamento-${q.quote_number || 'rascunho'}.pdf`)
}
