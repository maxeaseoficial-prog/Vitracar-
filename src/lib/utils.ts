export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
export const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value || 0)
export const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('pt-BR') : '—'
export const dateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
export const isoToday = () => new Date().toISOString().slice(0, 10)
export const priceToCents = (value: string | number) => Math.round(Number(String(value).replace(',', '.')) * 100)
export const centsToPrice = (value: number) => (value / 100).toFixed(2)
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
