-- Lavoo — teste grátis de 20 dias + assinatura Stripe.
-- Aplicar DEPOIS de schema.sql. Idempotente: pode ser executado de novo sem perder dados.
--
-- Regras:
--  * Toda empresa nova ganha 20 dias de teste a partir da criação (trigger em company_settings).
--  * Empresas que já existiam recebem 20 dias a partir da aplicação deste arquivo (não são bloqueadas na hora).
--  * Os campos de cobrança ficam numa tabela própria: o usuário só LÊ. Apenas o servidor
--    (service_role, usado pelas Edge Functions da Stripe) altera status e datas.
--  * O cálculo de "liberado / bloqueado" usa o relógio do banco, não o do navegador.

create table if not exists public.company_billing (
  company_id uuid primary key references public.company_settings(id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '20 days'),
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','canceled','unpaid','incomplete')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  welcome_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.company_billing enable row level security;
drop policy if exists billing_read on public.company_billing;
create policy billing_read on public.company_billing for select to authenticated
  using (company_id = (select private.current_company_id()));
revoke all on public.company_billing from anon, authenticated;
grant select on public.company_billing to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update on public.company_billing to service_role';
  end if;
end $$;

-- Empresa nova => 20 dias de teste.
create or replace function private.start_company_trial() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.company_billing(company_id, trial_started_at, trial_ends_at)
  values (new.id, now(), now() + interval '20 days')
  on conflict (company_id) do nothing;
  return new;
end $$;
revoke all on function private.start_company_trial() from public;
drop trigger if exists company_trial_start on public.company_settings;
create trigger company_trial_start after insert on public.company_settings
  for each row execute function private.start_company_trial();

-- Empresas já existentes: 20 dias contados a partir de agora.
insert into public.company_billing(company_id, trial_started_at, trial_ends_at)
select id, now(), now() + interval '20 days' from public.company_settings
on conflict (company_id) do nothing;

-- Situação da assinatura da empresa do usuário logado.
create or replace function public.billing_status() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare b public.company_billing%rowtype; cid uuid := private.current_company_id(); paid boolean; trial boolean;
begin
  if cid is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  select * into b from public.company_billing where company_id = cid;
  if not found then
    -- Segurança: empresa sem linha (não deveria acontecer) recebe o teste padrão.
    insert into public.company_billing(company_id) values (cid) returning * into b;
  end if;
  -- past_due: a Stripe ainda está tentando cobrar; mantém o acesso até ela cancelar.
  paid := b.status in ('active','past_due');
  trial := now() < b.trial_ends_at;
  return jsonb_build_object(
    'status', b.status,
    'allowed', paid or trial,
    'paid', paid,
    'trial_ends_at', b.trial_ends_at,
    'trial_days_left', greatest(0, ceil(extract(epoch from (b.trial_ends_at - now())) / 86400))::int,
    'trial_days_total', 20,
    'current_period_end', b.current_period_end,
    'has_customer', b.stripe_customer_id is not null,
    'welcome_seen', b.welcome_seen_at is not null,
    'is_admin', private.is_admin()
  );
end $$;
revoke all on function public.billing_status() from public, anon;
grant execute on function public.billing_status() to authenticated;

-- Marca a mensagem de boas-vindas como vista (uma vez por empresa).
create or replace function public.billing_mark_welcome_seen() returns void
language sql security definer set search_path = '' as $$
  update public.company_billing set welcome_seen_at = now(), updated_at = now()
  where company_id = private.current_company_id() and welcome_seen_at is null;
$$;
revoke all on function public.billing_mark_welcome_seen() from public, anon;
grant execute on function public.billing_mark_welcome_seen() to authenticated;
