// Lavoo — inicia a assinatura (Stripe Checkout) ou abre o portal de gerenciamento da assinatura.
// Publicar com verify_jwt=true: só usuários logados chegam aqui.
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID (preço recorrente do plano), opcional APP_URL e ALLOWED_ORIGINS.
import { db, stripe } from '../_shared/stripe.ts';

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
