# Teste grátis de 20 dias + assinatura Stripe

## Como funciona

- Toda conta nova ganha **20 dias grátis** a partir da criação do estabelecimento (trigger no banco).
- No primeiro acesso aparece: **"Parabéns! Você tem 20 dias para testar a nossa plataforma e reportar qualquer tipo de problema."** (mostrada uma vez por empresa).
- Durante o teste, o topo mostra quantos dias faltam; o administrador pode clicar para assinar antes.
- Depois dos 20 dias o sistema inteiro fica **fosco, com cadeado** e a mensagem **"Assine nosso plano para continuar com a nossa plataforma"**, com a logo Lavoo e o botão **Assinar agora** (Stripe Checkout).
- Pagou → o webhook da Stripe libera a conta automaticamente (a tela espera alguns segundos confirmando). Os dados nunca são apagados.
- Assinatura cancelada/não paga → bloqueia de novo. Pagamento atrasado (Stripe ainda tentando cobrar) mantém o acesso.
- Empresas que já existiam ganham 20 dias contados a partir da aplicação do `billing.sql`.
- Só o administrador pode assinar; colaboradores veem "Peça ao administrador da conta para assinar o plano".
- O prazo e o status ficam numa tabela que o usuário só consegue **ler**; somente o servidor altera.

## Configuração (uma vez)

### 1. Stripe
1. Em **Produtos → Adicionar produto**: "Plano Lavoo", preço **recorrente mensal** em BRL. Copie o **ID do preço** (`price_...`).
2. Em **Desenvolvedores → Chaves de API**: copie a **chave secreta** (`sk_live_...` ou `sk_test_...` para testar).
3. Em **Desenvolvedores → Webhooks → Adicionar endpoint**:
   - URL: `https://<PROJETO>.supabase.co/functions/v1/stripe-webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copie o **segredo de assinatura** (`whsec_...`).
4. Em **Configurações → Faturamento → Portal do cliente**: ative o portal (para o cliente trocar cartão/cancelar).

### 2. Supabase
1. SQL Editor: execute `supabase/billing.sql`.
2. Secrets das Edge Functions (Project Settings → Edge Functions → Secrets):
   - `STRIPE_SECRET_KEY` = `sk_...`
   - `STRIPE_PRICE_ID` = `price_...`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
   - opcional `APP_URL` = `https://lavooapp.vercel.app`
3. Publicar as funções:
   ~~~bash
   supabase functions deploy stripe-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   ~~~

**Nenhuma chave da Stripe vai para o frontend nem para a Vercel.** O navegador só recebe o link do Checkout.

## Testar
- Com `sk_test_...`, use o cartão `4242 4242 4242 4242`, qualquer data futura e CVC.
- Para simular o fim do teste numa empresa:
  `update public.company_billing set trial_ends_at = now() - interval '1 minute' where company_id = '<id>';`
- `node supabase/tests/billing.test.mjs` valida as regras no banco (roda no CI).

## Limitação conhecida
O bloqueio é feito na interface. As políticas RLS das tabelas de dados ainda não verificam a assinatura; um usuário técnico com o token poderia ler/gravar pela API depois do teste. Reforço possível: incluir a checagem de `billing_status` em `private.current_company_id()`.
