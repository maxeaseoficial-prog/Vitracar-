export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
export const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value || 0)
export const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('pt-BR') : '—'
export const dateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
// Data de hoje no fuso do navegador (toISOString usaria UTC e, depois das 21h
// no horário de Brasília, devolveria o dia seguinte).
export const isoToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Aceita o formato brasileiro ("1.500,00", "R$ 1.500", "150,5") e o formato com
// ponto decimal ("1500.50"). Devolve NaN quando o texto não é um valor.
export const priceToCents = (value: string | number) => {
  if (typeof value === 'number') return Math.round(value * 100)
  let s = value.replace(/R\$/gi, '').replace(/\s/g, '')
  if (!/^-?[\d.,]+$/.test(s)) return NaN
  if (s.includes(',')) {
    if (s.indexOf(',') !== s.lastIndexOf(',')) return NaN
    if (s.includes('.') && !/^-?\d{1,3}(\.\d{3})+,/.test(s)) return NaN
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  } else if ((s.match(/\./g) || []).length > 1) {
    return NaN
  }
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}
export const formatQuoteNumber = (n: number | null | undefined) => n ? '#' + String(n).padStart(5, '0') : '—'
export const centsToPrice = (value: number) => (value / 100).toFixed(2).replace('.', ',')
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join('')
export const normalizePlate = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '')
export const validPlate = (plate: string) => /^[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})$/.test(normalizePlate(plate))
export const formatPlate = (plate: string) => {
  const p = normalizePlate(plate)
  return /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0,3)+'-'+p.slice(3) : p
}
export const uuid = () => crypto.randomUUID()
export const escapeSearch = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export const dateToLocalInput = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}
export const statusLabel: Record<string,string> = {
  draft:'Rascunho', sent:'Emitido', approved:'Aprovado', declined:'Recusado',
  cancelled:'Cancelado', scheduled:'Agendado', in_progress:'Em andamento',
  completed:'Concluído', paid:'Pago', pending:'Pendente'
}
export const paymentLabel: Record<string,string> = {
  pix:'Pix', cash:'Dinheiro', credit_card:'Crédito', debit_card:'Débito', other:'Outro'
}
export const sum = (values: number[]) => values.reduce((a,b)=>a+b,0)
// Telefone brasileiro: (65) 99999-9999 ou (65) 3333-4444.
export const formatPhone = (value: string | null | undefined) => {
  const d = (value || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
export const whatsappLink = (value: string | null | undefined) => {
  const d = (value || '').replace(/\D/g, '')
  return d.length >= 10 ? `https://wa.me/${d.length <= 11 ? '55' + d : d}` : null
}
