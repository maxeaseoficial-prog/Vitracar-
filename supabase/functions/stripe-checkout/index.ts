// Lavoo — inicia a assinatura (Stripe Checkout) ou abre o portal de gerenciamento da assinatura.
// Publicar com verify_jwt=true: só usuários logados chegam aqui.
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID (preço recorrente do plano), opcional APP_URL e ALLOWED_ORIGINS.
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
const origins = new Set(['https://lavooapp.vercel.app','https://lavoo.vercel.app','https://lavoo-henriquecastroeditor-5558s-projects.vercel.app','https://lavoo-git-main-henriquecastroeditor-5558s-projects.vercel.app','https://vitracar.vercel.app']);
for (const extra of (Deno.env.get('ALLOWED_ORIGINS') || '').split(',')) { const o = extra.trim().replace(/\/$/, ''); if (/^https?:\/\/[a-z0-9.:-]+$/i.test(o)) origins.add(o); }
const previewOrigin = /^https:\/\/(lavoo|lavooapp|vitracar)-[a-z0-9-]+-henriquecastroeditor-5558s-projects\.vercel\.app$/;
const allowed = (origin: string | null) => !!origin && (origins.has(origin) || previewOrigin.test(origin));
const fallbackApp = (Deno.env.get('APP_URL') || 'https://lavooapp.vercel.app').replace(/\/$/, '');

function headers(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (allowed(origin)) h['Access-Control-Allow-Origin'] = origin!;
  return h;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const h = headers(origin);
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: h });
  if (origin && !allowed(origin)) return reply(403, { message: 'Origem não autorizada.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return reply(405, { message: 'Método não permitido.' });
  const PRICE = Deno.env.get('STRIPE_PRICE_ID');
  if (!Deno.env.get('STRIPE_SECRET_KEY') || !PRICE) return reply(503, { message: 'Pagamento ainda não configurado. Fale com o suporte Lavoo.' });

  // Identifica o usuário pelo próprio token de sessão (nunca por IDs enviados pelo navegador).
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const auth = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY')!, Authorization: `Bearer ${token}` } });
  if (!auth.ok) return reply(401, { message: 'Sessão expirada. Entre novamente.' });
  const user = await auth.json();

  let action = 'checkout';
  try { const body = await req.json(); if (body?.action === 'portal') action = 'portal'; } catch { /* corpo vazio = checkout */ }

  try {
    const [profile] = await db(`profiles?id=eq.${user.id}&select=company_id,role`);
    if (!profile) return reply(403, { message: 'Conta sem estabelecimento.' });
    if (profile.role !== 'admin') return reply(403, { message: 'Somente o administrador da conta pode assinar o plano.' });
    const cid: string = profile.company_id;
    const [company] = await db(`company_settings?id=eq.${cid}&select=name`);
    let [billing] = await db(`company_billing?company_id=eq.${cid}&select=*`);
    if (!billing) [billing] = await db('company_billing', { method: 'POST', body: { company_id: cid }, prefer: 'return=representation' });
    const app = allowed(origin) ? origin! : fallbackApp;

    let customer: string | null = billing.stripe_customer_id;
    if (!customer) {
      const created = await stripe('/customers', { email: user.email, name: company?.name, metadata: { company_id: cid } }, 'POST', `lavoo-customer-${cid}`);
      customer = created.id as string;
      // Só grava se ninguém gravou antes (dois cliques simultâneos).
      const saved = await db(`company_billing?company_id=eq.${cid}&stripe_customer_id=is.null`, { method: 'PATCH', body: { stripe_customer_id: customer, updated_at: new Date().toISOString() }, prefer: 'return=representation' });
      if (!saved?.length) [{ stripe_customer_id: customer }] = await db(`company_billing?company_id=eq.${cid}&select=stripe_customer_id`);
    }

    const paid = ['active', 'past_due'].includes(billing.status);
    if (action === 'portal' || paid) {
      const portal = await stripe('/billing_portal/sessions', { customer, return_url: `${app}/` });
      return reply(200, { url: portal.url });
    }

    const session = await stripe('/checkout/sessions', {
      mode: 'subscription',
      customer,
      client_reference_id: cid,
      line_items: [{ price: PRICE, quantity: 1 }],
      metadata: { company_id: cid },
      subscription_data: { metadata: { company_id: cid } },
      allow_promotion_codes: 'true',
      locale: 'pt-BR',
      success_url: `${app}/?assinatura=sucesso`,
      cancel_url: `${app}/?assinatura=cancelada`,
    });
    return reply(200, { url: session.url });
  } catch (error) {
    console.error('stripe-checkout', error instanceof Error ? error.message : 'erro');
    return reply(502, { message: 'Não foi possível abrir o pagamento agora. Tente novamente em instantes.' });
  }
});
