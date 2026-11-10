-- Additive rollout. No existing bookings, orders, receipts or loyalty entries are deleted.
alter table public.appointments add column if not exists workflow_stage text check(workflow_stage in ('scheduled','washing','finished','delivered','paid'));
alter table public.appointments add column if not exists workflow_version integer not null default 0;
alter table public.appointments add column if not exists workflow_updated_at timestamptz;
alter table public.appointments add column if not exists duration_minutes integer not null default 60 check(duration_minutes between 5 and 1440);

-- Preserve completed commercial records. Only the operational position can be reopened.
create or replace function private.guard_appointment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status='cancelled' then raise exception 'Agendamento cancelado não pode ser alterado'; end if;
  if old.status='completed' and
     (to_jsonb(new)-array['workflow_stage','workflow_version','workflow_updated_at']) is distinct from
     (to_jsonb(old)-array['workflow_stage','workflow_version','workflow_updated_at']) then
    raise exception 'Os dados de um atendimento concluído não podem ser alterados. Você pode reabrir apenas a etapa operacional.';
  end if;
  if new.client_id is distinct from old.client_id or new.vehicle_id is distinct from old.vehicle_id then
    raise exception 'Cliente e veículo do agendamento não podem ser trocados';
  end if;
  if new.status='completed' and not exists(select 1 from public.service_orders where appointment_id=new.id and company_id=new.company_id) then
    raise exception 'Use a conclusão do atendimento para finalizar o agendamento';
  end if;
  return new;
end $$;

create or replace function private.validate_wash_workflow() returns trigger
language plpgsql security invoker set search_path='' as $$
declare oid uuid; total bigint; received bigint;
begin
  if tg_op='INSERT' then
    if new.status<>'scheduled' or (new.workflow_stage is not null and new.workflow_stage<>'scheduled') then
      raise exception 'Novos atendimentos começam em Agendados';
    end if;
    new.workflow_stage:='scheduled';new.workflow_version:=0;new.workflow_updated_at:=now();return new;
  end if;
  if new.status is distinct from old.status then
    new.workflow_stage:=case new.status when 'completed' then 'finished' when 'in_progress' then 'washing' when 'scheduled' then 'scheduled' else new.workflow_stage end;
  end if;
  if new.workflow_stage in ('finished','delivered','paid') then
    select id,total_cents into oid,total from public.service_orders where appointment_id=new.id and company_id=new.company_id and status='completed';
    if oid is null then raise exception 'Finalize o atendimento antes de avançar para esta etapa';end if;
    if new.workflow_stage='paid' then
      select coalesce(sum(amount_cents),0) into received from public.payments where order_id=oid and company_id=new.company_id;
      if received<total then raise exception 'Registre o pagamento do saldo antes de mover para Pago';end if;
    end if;
  end if;
  new.workflow_version:=old.workflow_version+1;new.workflow_updated_at:=now();return new;
end $$;
drop trigger if exists wash_workflow_guard on public.appointments;
create trigger wash_workflow_guard before insert or update on public.appointments for each row execute function private.validate_wash_workflow();

create or replace function public.move_wash_stage(p_appointment_id uuid,p_stage text,p_expected_version integer) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ap public.appointments%rowtype; cid uuid:=private.current_company_id(); oid uuid;
begin
  if auth.uid() is null or cid is null then raise exception 'Não autenticado';end if;
  if p_stage is null or p_stage not in ('scheduled','washing','finished','delivered','paid') then raise exception 'Etapa inválida';end if;
  select * into ap from public.appointments where id=p_appointment_id and company_id=cid for update;
  if not found then raise exception 'Atendimento não encontrado';end if;
  if ap.status='cancelled' then raise exception 'Atendimento cancelado';end if;
  if p_expected_version is distinct from ap.workflow_version then raise exception 'Este atendimento mudou em outra tela. Atualize e tente novamente.' using errcode='40001';end if;
  if p_stage in ('finished','delivered','paid') then oid:=public.complete_appointment(ap.id);end if;
  update public.appointments set workflow_stage=p_stage,
    status=case when status='completed' then status when p_stage='washing' then 'in_progress' when p_stage='scheduled' then 'scheduled' else status end
  where id=ap.id and company_id=cid;
  return ap.id;
end $$;

create or replace function public.pay_wash_appointment(p_appointment_id uuid,p_amount_cents bigint,p_method text,p_expected_version integer) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ap public.appointments%rowtype; cid uuid:=private.current_company_id(); oid uuid; total bigint; received bigint;
begin
  if auth.uid() is null or cid is null then raise exception 'Não autenticado';end if;
  if p_method is null or p_method not in ('pix','cash','credit_card','debit_card','other') then raise exception 'Forma de pagamento inválida';end if;
  if p_amount_cents is null or p_amount_cents<0 then raise exception 'Valor inválido';end if;
  select * into ap from public.appointments where id=p_appointment_id and company_id=cid for update;
  if not found then raise exception 'Atendimento não encontrado';end if;
  if ap.status='cancelled' then raise exception 'Atendimento cancelado';end if;
  if p_expected_version is distinct from ap.workflow_version then raise exception 'Este atendimento mudou em outra tela. Atualize e tente novamente.' using errcode='40001';end if;
  oid:=public.complete_appointment(ap.id);
  -- The payment trigger takes the order lock without granting users UPDATE on orders.
  select total_cents into total from public.service_orders where id=oid and company_id=cid;
  select coalesce(sum(amount_cents),0) into received from public.payments where order_id=oid and company_id=cid;
  if p_amount_cents>total-received or (p_amount_cents=0 and received<total) then raise exception 'Confira o valor: ele deve respeitar o saldo pendente';end if;
  if p_amount_cents>0 then
    insert into public.payments(company_id,order_id,amount_cents,method,paid_at) values(cid,oid,p_amount_cents,p_method,now());
  end if;
  update public.appointments set workflow_stage=case when received+p_amount_cents>=total then 'paid' when ap.workflow_stage='delivered' then 'delivered' else 'finished' end where id=ap.id and company_id=cid;
  return oid;
end $$;

create or replace function public.create_appointment(p_appointment jsonb,p_items jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare cid uuid:=private.current_company_id(); aid uuid; wanted integer; found_count integer; duration integer;
begin
  if auth.uid() is null or cid is null then raise exception 'Não autenticado';end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'Selecione pelo menos um serviço';end if;
  select count(distinct (i->>'service_id')::uuid) into wanted from jsonb_array_elements(p_items) i;
  select count(*),coalesce(sum(coalesce(s.duration_minutes,0)),0)::integer into found_count,duration from public.services s
    where s.company_id=cid and s.active and s.id in(select (i->>'service_id')::uuid from jsonb_array_elements(p_items) i);
  if found_count<>wanted or wanted<>jsonb_array_length(p_items) then raise exception 'Serviço inválido, repetido ou inativo';end if;
  duration:=coalesce((p_appointment->>'duration_minutes')::integer,nullif(duration,0),60);
  if duration<5 or duration>1440 then raise exception 'A duração deve estar entre 5 e 1440 minutos';end if;
  insert into public.appointments(company_id,client_id,vehicle_id,quote_id,starts_at,address,notes,status,duration_minutes)
    values(cid,(p_appointment->>'client_id')::uuid,(p_appointment->>'vehicle_id')::uuid,nullif(p_appointment->>'quote_id','')::uuid,
      (p_appointment->>'starts_at')::timestamptz,nullif(p_appointment->>'address',''),nullif(p_appointment->>'notes',''),'scheduled',duration) returning id into aid;
  insert into public.appointment_items(company_id,appointment_id,service_id,description,price_cents,coins)
    select cid,aid,s.id,s.name,s.price_cents,s.coins from public.services s where s.company_id=cid and s.id in(select (i->>'service_id')::uuid from jsonb_array_elements(p_items) i);
  return aid;
end $$;
revoke all on function public.move_wash_stage(uuid,text,integer) from public,anon;
revoke all on function public.pay_wash_appointment(uuid,bigint,text,integer) from public,anon;
grant execute on function public.move_wash_stage(uuid,text,integer),public.pay_wash_appointment(uuid,bigint,text,integer) to authenticated;
comment on column public.appointments.workflow_stage is 'Operational board position. Moving backward preserves concluded orders and payments; paid requires full settlement.';
notify pgrst,'reload schema';
