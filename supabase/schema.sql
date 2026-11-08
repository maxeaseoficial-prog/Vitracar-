-- VitraCar v1 — Execute em projeto Supabase DEDICADO e vazio via SQL Editor.
-- Os dados são multiempresa; autenticação via Supabase Auth; nenhuma chave secreta no navegador.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  phone text,
  email text,
  address text,
  tax_id text,
  logo_url text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.company_settings(id),
  name text,
  role text not null default 'admin' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);
create index profiles_company_idx on public.profiles(company_id);

create function private.current_company_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select p.company_id from public.profiles p where p.id = (select auth.uid()) limit 1 $$;

create function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin') $$;

revoke all on function private.current_company_id() from public;
revoke all on function private.is_admin() from public;
grant execute on function private.current_company_id(), private.is_admin() to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  name text not null check (length(trim(name)) >= 2),
  whatsapp text,
  birth_date date,
  photo_path text,
  avatar_kind text not null default 'male' check(avatar_kind in ('male','female')),
  notes text,
  created_at timestamptz not null default now(),
  unique(company_id,id)
);
create index clients_company_name_idx on public.clients(company_id,name);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  client_id uuid not null,
  plate text not null check (plate ~ '^[A-Z]{3}([0-9]{4}|[0-9][A-Z][0-9]{2})$'),
  brand text not null,
  model text not null,
  year integer check(year between 1900 and 2100),
  color text not null default 'Prata',
  category text,
  upholstery text,
  model_3d_id text,
  notes text,
  created_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,plate),
  foreign key(company_id,client_id) references public.clients(company_id,id)
);
create index vehicles_client_idx on public.vehicles(company_id,client_id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  name text not null,
  description text,
  price_cents bigint not null default 0 check(price_cents >= 0),
  duration_minutes integer check(duration_minutes > 0),
  coins integer not null default 0 check(coins >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  quote_number bigint generated always as identity,
  client_id uuid not null,
  vehicle_id uuid not null,
  status text not null default 'draft' check(status in ('draft','sent','approved','declined','cancelled')),
  discount_cents bigint not null default 0 check(discount_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,client_id) references public.clients(company_id,id),
  foreign key(company_id,vehicle_id) references public.vehicles(company_id,id)
);
create index quotes_company_date_idx on public.quotes(company_id,created_at desc);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  quote_id uuid not null,
  service_id uuid,
  description text not null,
  quantity integer not null default 1 check(quantity > 0),
  unit_cents bigint not null default 0 check(unit_cents >= 0),
  foreign key(company_id,quote_id) references public.quotes(company_id,id),
  foreign key(company_id,service_id) references public.services(company_id,id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  client_id uuid not null,
  vehicle_id uuid not null,
  quote_id uuid,
  starts_at timestamptz not null,
  address text,
  notes text,
  status text not null default 'scheduled' check(status in ('scheduled','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,client_id) references public.clients(company_id,id),
  foreign key(company_id,vehicle_id) references public.vehicles(company_id,id),
  foreign key(company_id,quote_id) references public.quotes(company_id,id)
);
create index appointments_company_start_idx on public.appointments(company_id,starts_at);

create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  appointment_id uuid not null,
  service_id uuid,
  description text not null,
  price_cents bigint not null check(price_cents >= 0),
  coins integer not null default 0 check(coins >= 0),
  foreign key(company_id,appointment_id) references public.appointments(company_id,id),
  foreign key(company_id,service_id) references public.services(company_id,id)
);

create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  client_id uuid not null,
  vehicle_id uuid not null,
  appointment_id uuid,
  status text not null default 'completed' check(status in ('in_progress','completed','cancelled')),
  total_cents bigint not null default 0 check(total_cents >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id,id),
  unique(appointment_id),
  foreign key(company_id,client_id) references public.clients(company_id,id),
  foreign key(company_id,vehicle_id) references public.vehicles(company_id,id),
  foreign key(company_id,appointment_id) references public.appointments(company_id,id)
);
create index orders_vehicle_idx on public.service_orders(company_id,vehicle_id,completed_at desc);

create table public.service_order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  order_id uuid not null,
  service_id uuid,
  description text not null,
  price_cents bigint not null default 0 check(price_cents >= 0),
  coins integer not null default 0 check(coins >= 0),
  foreign key(company_id,order_id) references public.service_orders(company_id,id),
  foreign key(company_id,service_id) references public.services(company_id,id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  order_id uuid not null,
  amount_cents bigint not null check(amount_cents > 0),
  method text not null check(method in ('pix','cash','credit_card','debit_card','other')),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key(company_id,order_id) references public.service_orders(company_id,id)
);
create index payments_company_date_idx on public.payments(company_id,paid_at);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  description text not null,
  category text not null default 'Operacional',
  amount_cents bigint not null check(amount_cents > 0),
  occurred_on date not null default current_date,
  method text check(method in ('pix','cash','credit_card','debit_card','other')),
  supplier text,
  notes text,
  created_at timestamptz not null default now()
);
create index expenses_company_date_idx on public.expenses(company_id,occurred_on);

create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  name text not null,
  description text,
  cost integer not null check(cost > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,id)
);

create table public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  client_id uuid not null,
  reward_id uuid not null,
  cost integer not null check(cost > 0),
  created_at timestamptz not null default now(),
  foreign key(company_id,client_id) references public.clients(company_id,id),
  foreign key(company_id,reward_id) references public.loyalty_rewards(company_id,id)
);

create table public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  client_id uuid not null,
  change integer not null check(change <> 0),
  kind text not null check(kind in ('earn','redeem','reversal')),
  source_id uuid not null,
  event_key text not null unique,
  description text not null,
  created_at timestamptz not null default now(),
  foreign key(company_id,client_id) references public.clients(company_id,id)
);
create index ledger_client_date_idx on public.loyalty_ledger(company_id,client_id,created_at);

-- Isolamento por empresa: políticas não confiam em metadados editáveis do usuário.
alter table public.company_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.vehicles enable row level security;
alter table public.services enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;
alter table public.service_orders enable row level security;
alter table public.service_order_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_redemptions enable row level security;
alter table public.loyalty_ledger enable row level security;

create policy "company_read" on public.company_settings for select to authenticated
using (id = (select private.current_company_id()));
create policy "company_admin_update" on public.company_settings for update to authenticated
using (id = (select private.current_company_id()) and (select private.is_admin()))
with check (id = (select private.current_company_id()) and (select private.is_admin()));
create policy "profile_self_read" on public.profiles for select to authenticated
using (id = (select auth.uid()));

do $$
declare target text;
begin
  foreach target in array array[
    'clients','vehicles','services','quotes','quote_items','appointments',
    'appointment_items','service_orders','service_order_items','payments',
    'expenses','loyalty_rewards','loyalty_redemptions','loyalty_ledger'
  ] loop
    execute format(
      'create policy tenant_access on public.%I for all to authenticated using (company_id = (select private.current_company_id())) with check (company_id = (select private.current_company_id()))',
      target
    );
  end loop;
end $$;

revoke all on public.company_settings,public.profiles,public.clients,public.vehicles,
public.services,public.quotes,public.quote_items,public.appointments,public.appointment_items,
public.service_orders,public.service_order_items,public.payments,public.expenses,
public.loyalty_rewards,public.loyalty_redemptions,public.loyalty_ledger from anon,authenticated;

grant select on public.company_settings,public.profiles,public.clients,public.vehicles,
public.services,public.quotes,public.quote_items,public.appointments,public.appointment_items,
public.service_orders,public.service_order_items,public.payments,public.expenses,
public.loyalty_rewards,public.loyalty_redemptions,public.loyalty_ledger to authenticated;

grant update on public.company_settings to authenticated;
grant insert,update on public.clients,public.vehicles,public.services,public.quotes,
public.quote_items,public.appointments,public.appointment_items,public.expenses,
public.loyalty_rewards to authenticated;
grant insert on public.payments to authenticated;
grant usage,select on sequence public.quotes_quote_number_seq to authenticated;

-- Onboarding segura: o primeiro usuário cria seu próprio estabelecimento.
create function public.create_company(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if length(trim(p_name)) not between 2 and 120 then raise exception 'Nome inválido'; end if;
  if exists(select 1 from public.profiles where id=uid) then raise exception 'Conta já vinculada'; end if;
  insert into public.company_settings(name) values(trim(p_name)) returning id into cid;
  insert into public.profiles(id,company_id,role) values(uid,cid,'admin');
  return cid;
end $$;
revoke all on function public.create_company(text) from public,anon;
grant execute on function public.create_company(text) to authenticated;

-- Conclusão atômica transforma agendamento e itens em serviço executado.
create function public.complete_appointment(p_appointment_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare ap public.appointments%rowtype; oid uuid; total bigint;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into ap from public.appointments
  where id=p_appointment_id and company_id=private.current_company_id() for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if ap.status='cancelled' then raise exception 'Agendamento cancelado'; end if;
  if ap.status='completed' then
    select id into oid from public.service_orders where appointment_id=ap.id;
    if oid is not null then return oid; end if;
    raise exception 'Agendamento inconsistente';
  end if;
  if not exists(select 1 from public.appointment_items where appointment_id=ap.id) then
    raise exception 'Adicione pelo menos um serviço';
  end if;
  select coalesce(sum(price_cents),0) into total from public.appointment_items where appointment_id=ap.id;
  insert into public.service_orders(company_id,client_id,vehicle_id,appointment_id,status,total_cents,completed_at)
  values(ap.company_id,ap.client_id,ap.vehicle_id,ap.id,'completed',total,now()) returning id into oid;
  insert into public.service_order_items(company_id,order_id,service_id,description,price_cents,coins)
  select company_id,oid,service_id,description,price_cents,coins
  from public.appointment_items where appointment_id=ap.id;
  update public.appointments set status='completed' where id=ap.id;
  return oid;
end $$;
revoke all on function public.complete_appointment(uuid) from public,anon;
grant execute on function public.complete_appointment(uuid) to authenticated;

-- Recebimento não pode exceder a dívida pendente; usa lock para concorrência.
create function private.validate_payment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare total bigint; already bigint; s text;
begin
  if auth.uid() is null or new.company_id is distinct from private.current_company_id() then
    raise exception 'Operação não autorizada';
  end if;
  select total_cents,status into total,s from public.service_orders
  where id=new.order_id and company_id=new.company_id for update;
  if not found or s <> 'completed' then raise exception 'Serviço inválido'; end if;
  select coalesce(sum(amount_cents),0) into already from public.payments where order_id=new.order_id;
  if new.amount_cents <= 0 or already + new.amount_cents > total then
    raise exception 'Pagamento excede saldo pendente';
  end if;
  return new;
end $$;
create trigger validate_payment before insert on public.payments
for each row execute function private.validate_payment();

-- Apenas depois de quitação integral: um único crédito por ordem.
create function private.award_coins() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare o public.service_orders%rowtype; paid bigint; reward integer;
begin
  select * into o from public.service_orders where id=new.order_id for update;
  select coalesce(sum(amount_cents),0) into paid from public.payments where order_id=o.id;
  if o.status='completed' and o.total_cents > 0 and paid >= o.total_cents then
    select coalesce(sum(coins),0) into reward from public.service_order_items where order_id=o.id;
    if reward > 0 then
      insert into public.loyalty_ledger(company_id,client_id,change,kind,source_id,event_key,description)
      values(o.company_id,o.client_id,reward,'earn',o.id,'order:'||o.id::text||':earn','Moedas por serviço quitado')
      on conflict(event_key) do nothing;
    end if;
  end if;
  return new;
end $$;
create trigger award_coins after insert on public.payments
for each row execute function private.award_coins();

-- Resgate atômico sob lock do cliente impede duplicação/saldo negativo.
create function public.redeem_loyalty(p_client_id uuid,p_reward_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare cid uuid:=private.current_company_id(); cost_points integer; total_points bigint; rid uuid;
begin
  if auth.uid() is null or cid is null then raise exception 'Não autenticado'; end if;
  perform 1 from public.clients where id=p_client_id and company_id=cid for update;
  if not found then raise exception 'Cliente não encontrado'; end if;
  select cost into cost_points from public.loyalty_rewards
  where id=p_reward_id and company_id=cid and active=true;
  if cost_points is null then raise exception 'Recompensa indisponível'; end if;
  select coalesce(sum(change),0) into total_points
  from public.loyalty_ledger where company_id=cid and client_id=p_client_id;
  if total_points < cost_points then raise exception 'Saldo de moedas insuficiente'; end if;
  insert into public.loyalty_redemptions(company_id,client_id,reward_id,cost)
  values(cid,p_client_id,p_reward_id,cost_points) returning id into rid;
  insert into public.loyalty_ledger(company_id,client_id,change,kind,source_id,event_key,description)
  values(cid,p_client_id,-cost_points,'redeem',rid,'redemption:'||rid::text,'Resgate de recompensa');
  return rid;
end $$;
revoke all on function public.redeem_loyalty(uuid,uuid) from public,anon;
grant execute on function public.redeem_loyalty(uuid,uuid) to authenticated;

-- Storage: fotos privadas por estabelecimento; logomarcas públicas para PDF.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('client-photos','client-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-logos','company-logos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy client_photos_read on storage.objects for select to authenticated
using(bucket_id='client-photos' and split_part(name,'/',1)=(select private.current_company_id())::text);
create policy client_photos_insert on storage.objects for insert to authenticated
with check(bucket_id='client-photos' and split_part(name,'/',1)=(select private.current_company_id())::text);
create policy company_logos_admin_insert on storage.objects for insert to authenticated
with check(bucket_id='company-logos' and (select private.is_admin()) and split_part(name,'/',1)=(select private.current_company_id())::text);
