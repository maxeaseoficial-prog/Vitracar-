// Lavoo — recebe eventos da Stripe e atualiza a assinatura da empresa.
// Publicar com verify_jwt=false (a Stripe não tem sessão Supabase); a autenticidade é garantida
// pela assinatura STRIPE_WEBHOOK_SECRET (whsec_...). Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
//
// Eventos a habilitar no painel da Stripe:
//   checkout.session.completed, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted
import { db, mapSubscriptionStatus, periodEnd, stripe, verifyStripeSignature } from '../_shared/stripe.ts';

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
