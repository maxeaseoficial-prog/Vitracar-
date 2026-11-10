/** Última lavagem de cada cliente: base para "há 3 dias" nos cartões e o ranking do painel. */
export interface WashOrder { client_id: string; vehicle_id: string; status: string; completed_at: string | null }
export interface WashClient { id: string; created_at: string; archived_at?: string | null }

export interface LastWash { at: string; vehicleId: string }

/** Só atendimentos concluídos contam como lavagem. */
export function lastWashByClient(orders: WashOrder[]): Map<string, LastWash> {
  const last = new Map<string, LastWash>()
  for (const order of orders) {
    if (order.status !== 'completed' || !order.completed_at) continue
    const time = new Date(order.completed_at).getTime()
    if (Number.isNaN(time)) continue
    const current = last.get(order.client_id)
    if (!current || time > new Date(current.at).getTime()) last.set(order.client_id, { at: order.completed_at, vehicleId: order.vehicle_id })
  }
  return last
}

/** Dias de calendário (fuso do aparelho) entre a data e hoje. Nunca negativo. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const a = new Date(iso), b = now
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.max(0, Math.round((end - start) / 86400000))
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function sinceLabel(days: number): string {
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) return `há ${plural(Math.floor(days / 7), 'semana', 'semanas')}`
  if (days < 365) return `há ${plural(Math.floor(days / 30), 'mês', 'meses')}`
  return `há ${plural(Math.floor(days / 365), 'ano', 'anos')}`
}

export interface WashGap<C extends WashClient> {
  client: C
  last: LastWash | null
  /** Dias desde a última lavagem; sem lavagem, dias desde o cadastro. */
  days: number
}

/** Clientes ativos, do que está há mais tempo sem lavar para o mais recente. */
export function washGaps<C extends WashClient>(clients: C[], orders: WashOrder[], now: Date = new Date()): WashGap<C>[] {
  const last = lastWashByClient(orders)
  return clients.filter(c => !c.archived_at).map(client => {
    const wash = last.get(client.id) || null
    return { client, last: wash, days: daysSince(wash ? wash.at : client.created_at, now) }
  }).sort((a, b) => b.days - a.days || a.client.created_at.localeCompare(b.client.created_at))
}
