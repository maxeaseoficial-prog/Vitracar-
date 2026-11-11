// Lavoo — recebe eventos da Stripe e atualiza a assinatura da empresa.
// Publicar com verify_jwt=false (a Stripe não tem sessão Supabase); a autenticidade é garantida
// pela assinatura STRIPE_WEBHOOK_SECRET (whsec_...). Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
//
// Eventos a habilitar no painel da Stripe:
//   checkout.session.completed, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted
// Arquivo único (sem imports locais) para poder publicar direto pelo editor do painel Supabase.

// ---- utilitários Stripe ----

const STRIPE = 'https://api.stripe.com/v1';

function encode(params: Record<string, unknown>, prefix = '', out: string[] = []): string[] {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) value.forEach((item, i) => {
      if (item && typeof item === 'object') encode(item as Record<string, unknown>, `${name}[${i}]`, out);
      else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
    });
    else if (typeof value === 'object') encode(value as Record<string, unknown>, name, out);
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return out;
}

export async function stripe(path: string, params?: Record<string, unknown>, method = params ? 'POST' : 'GET', idempotencyKey?: string) {
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) throw new Error('stripe_not_configured');
  const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
  if (params) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(STRIPE + path, { method, headers, body: params ? encode(params).join('&') : undefined, signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`stripe_${res.status}:${data?.error?.code || data?.error?.type || 'error'}`);
  return data;
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Valida o cabeçalho Stripe-Signature (HMAC-SHA256 de `${t}.${corpo}`), com tolerância de 5 minutos. */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = header.split(',').map(p => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !/^\d+$/.test(t) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${rawBody}`)));
  return signatures.some(s => safeEqual(s, expected));
}

/** Converte o status da assinatura Stripe para o status interno do Lavoo. */
export function mapSubscriptionStatus(status: string): string {
  switch (status) {
    case 'active': case 'trialing': return 'active';
    case 'past_due': return 'past_due';
    case 'unpaid': return 'unpaid';
    case 'incomplete': return 'incomplete';
    default: return 'canceled'; // canceled, incomplete_expired, paused
  }
}

/** current_period_end mudou para os itens da assinatura nas versões novas da API Stripe. */
export function periodEnd(sub: Record<string, any>): string | null {
  const seconds = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

/** Chamada REST ao banco com a service role (somente no servidor). */
export async function db(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
  const url = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const headers: Record<string, string> = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${url}/rest/v1/${path}`, { method: init.method || 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(12000) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`db_${res.status}`);
  return data;
}

// ---- função ----
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const uuid = /^[0-9a-f-]{36}$/i;

async function applySubscription(sub: Record<string, any>, companyHint?: string) {
  let cid: string | undefined = sub.metadata?.company_id || companyHint;
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!cid && customer) {
    const [row] = await db(`company_billing?stripe_customer_id=eq.${encodeURIComponent(customer)}&select=company_id`);
    cid = row?.company_id;
  }
  if (!cid || !uuid.test(cid)) { console.warn('stripe-webhook: assinatura sem empresa', sub.id); return; }
  await db(`company_billing?company_id=eq.${cid}`, { method: 'PATCH', body: {
    status: mapSubscriptionStatus(sub.status),
    stripe_subscription_id: sub.id,
    ...(customer ? { stripe_customer_id: customer } : {}),
    current_period_end: periodEnd(sub),
    updated_at: new Date().toISOString(),
  } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { message: 'Método não permitido.' });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const raw = await req.text();
  if (raw.length > 512 * 1024) return json(413, { message: 'Evento grande demais.' });
  if (!(await verifyStripeSignature(raw, req.headers.get('stripe-signature'), secret))) return json(400, { message: 'Assinatura inválida.' });

  let event: Record<string, any>;
  try { event = JSON.parse(raw); } catch { return json(400, { message: 'JSON inválido.' }); }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription' || !session.subscription) break;
        // Busca o estado atual na Stripe para não depender da ordem de chegada dos eventos.
        const sub = await stripe(`/subscriptions/${session.subscription}`);
        await applySubscription(sub, session.metadata?.company_id || session.client_reference_id);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = await stripe(`/subscriptions/${event.data.object.id}`).catch(() => event.data.object);
        await applySubscription(sub);
        break;
      }
      default: break; // outros eventos são ignorados
    }
    return json(200, { received: true });
  } catch (error) {
    // 500 faz a Stripe reenviar o evento depois.
    console.error('stripe-webhook', event.type, error instanceof Error ? error.message : 'erro');
    return json(500, { message: 'Falha ao processar.' });
  }
});
