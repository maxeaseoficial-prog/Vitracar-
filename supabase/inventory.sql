-- Additive inventory and quote integration. No sample records or changes to existing prices.
create table public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  name text not null check (length(btrim(name)) between 2 and 160),
  category text not null default 'Outros' check (length(category)<=80),
  kind text not null check (kind in ('supply','resale','both')),
  package_unit text not null default 'un' check (package_unit in ('ml','l','g','kg','un')),
  package_quantity numeric(14,3) not null default 1 check (package_quantity>0 and package_quantity<=1000000),
  cost_cents bigint not null default 0 check (cost_cents between 0 and 1000000000),
  sale_cents bigint not null default 0 check (sale_cents between 0 and 1000000000),
  stock_quantity numeric(14,3) not null default 0 check (stock_quantity>=0 and stock_quantity<=1000000),
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity>=0 and minimum_quantity<=1000000),
  supplier_name text check (length(supplier_name)<=160),
  supplier_url text check (supplier_url is null or (length(supplier_url)<=2000 and supplier_url ~ '^https://[^[:space:]@]+')),
  photo_path text check (photo_path is null or (split_part(photo_path,'/',1)=company_id::text and length(photo_path)<=500)),
  notes text check (length(notes)<=2000),
  active boolean not null default true,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id)
);
create index inventory_products_company_active on public.inventory_products(company_id,active,kind);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_settings(id),
  product_id uuid not null,
  kind text not null check(kind in ('opening','purchase','consumption','sale','adjustment')),
  quantity numeric(14,3) not null check(quantity<>0 and abs(quantity)<=1000000),
  quantity_before numeric(14,3) not null,
  quantity_after numeric(14,3) not null check(quantity_after>=0),
  unit_cost_cents bigint not null check(unit_cost_cents between 0 and 1000000000),
  notes text check(length(notes)<=1000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(company_id,product_id) references public.inventory_products(company_id,id)
);
create index inventory_movements_product_date on public.inventory_movements(company_id,product_id,created_at desc,id);
alter table public.inventory_products enable row level security;
alter table public.inventory_movements enable row level security;
create policy inventory_products_company on public.inventory_products to authenticated
 using(company_id=(select private.current_company_id())) with check(company_id=(select private.current_company_id()));
create policy inventory_movements_read on public.inventory_movements for select to authenticated
 using(company_id=(select private.current_company_id()));
create policy inventory_movements_insert on public.inventory_movements for insert to authenticated
 with check(company_id=(select private.current_company_id()));
revoke all on public.inventory_products,public.inventory_movements from anon,authenticated;
grant select on public.inventory_products,public.inventory_movements to authenticated;
grant insert(id,company_id,name,category,kind,package_unit,package_quantity,cost_cents,sale_cents,minimum_quantity,supplier_name,supplier_url,photo_path,notes,active) on public.inventory_products to authenticated;
grant update(name,category,kind,package_unit,package_quantity,cost_cents,sale_cents,minimum_quantity,supplier_name,supplier_url,photo_path,notes,active) on public.inventory_products to authenticated;
grant insert(id,company_id,product_id,kind,quantity,unit_cost_cents,notes) on public.inventory_movements to authenticated;

create function private.touch_inventory_product() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.id<>old.id or new.company_id<>old.company_id then raise exception 'Identidade do produto não pode mudar'; end if;
 if old.stock_quantity<>0 and (new.package_unit<>old.package_unit or new.package_quantity<>old.package_quantity) then
  raise exception 'Zere o saldo com ajuste documentado antes de mudar a embalagem';
 end if;
 new.version:=old.version+1; new.updated_at:=now(); return new;
end $$;
revoke all on function private.touch_inventory_product() from public,anon,authenticated;
create trigger inventory_product_version before update on public.inventory_products for each row execute function private.touch_inventory_product();

-- A private trigger owns the balance. Users may insert ledger entries but cannot edit balances or history.
create function private.apply_inventory_movement() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.inventory_products%rowtype;
begin
 if auth.uid() is null or new.company_id is distinct from private.current_company_id() then raise exception 'Operação não autorizada'; end if;
 select * into p from public.inventory_products where id=new.product_id and company_id=new.company_id for update;
 if not found then raise exception 'Produto não encontrado'; end if;
 if not p.active then raise exception 'Reative o produto antes de movimentar'; end if;
 if new.kind in ('opening','purchase') and new.quantity<=0 then raise exception 'Entrada deve ser positiva'; end if;
 if new.kind in ('consumption','sale') and new.quantity>=0 then raise exception 'Saída deve ser negativa'; end if;
 if new.kind='sale' and p.kind='supply' then raise exception 'Este produto é somente para uso interno'; end if;
 if new.kind='consumption' and p.kind='resale' then raise exception 'Este produto é somente para venda'; end if;
 if new.kind='opening' and exists(select 1 from public.inventory_movements where product_id=p.id) then raise exception 'Saldo inicial já registrado'; end if;
 if new.kind='adjustment' and length(btrim(coalesce(new.notes,'')))<3 then raise exception 'Explique o motivo do ajuste'; end if;
 if new.quantity is null or new.quantity=0 or abs(new.quantity)>1000000 then raise exception 'Quantidade inválida'; end if;
 new.quantity_before:=p.stock_quantity; new.quantity_after:=p.stock_quantity+new.quantity;
 if new.quantity_after<0 then raise exception 'Saldo insuficiente em estoque'; end if;
 if new.quantity_after>1000000 then raise exception 'Saldo acima do limite'; end if;
 if new.kind not in ('opening','purchase') then new.unit_cost_cents:=p.cost_cents; end if;
 new.unit_cost_cents:=coalesce(new.unit_cost_cents,p.cost_cents);
 new.created_by:=auth.uid(); new.created_at:=now();
 update public.inventory_products set stock_quantity=new.quantity_after,
   cost_cents=case when new.kind='purchase' then new.unit_cost_cents else cost_cents end where id=p.id;
 return new;
end $$;
revoke all on function private.apply_inventory_movement() from public,anon,authenticated;
create trigger inventory_apply_movement before insert on public.inventory_movements for each row execute function private.apply_inventory_movement();

create function public.move_inventory(p_id uuid,p_product_id uuid,p_kind text,p_quantity numeric,p_unit_cost_cents bigint default null,p_notes text default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare cid uuid:=private.current_company_id(); previous public.inventory_movements%rowtype;
begin
 if auth.uid() is null or cid is null then raise exception 'Não autenticado'; end if;
 if p_id is null or p_quantity is null or p_quantity=0 or abs(p_quantity)>1000000 or p_quantity<>round(p_quantity,3) then raise exception 'Quantidade inválida; use até 3 casas decimais'; end if;
 select * into previous from public.inventory_movements where id=p_id and company_id=cid;
 if found then
  if previous.product_id<>p_product_id or previous.kind<>p_kind or previous.quantity<>p_quantity or coalesce(previous.notes,'')<>coalesce(p_notes,'') or (p_kind='purchase' and p_unit_cost_cents is not null and previous.unit_cost_cents<>p_unit_cost_cents) then raise exception 'Esta operação já existe com outros dados'; end if;
  return previous.id;
 end if;
 insert into public.inventory_movements(id,company_id,product_id,kind,quantity,unit_cost_cents,notes)
 values(p_id,cid,p_product_id,p_kind,p_quantity,p_unit_cost_cents,p_notes);
 return p_id;
end $$;
revoke all on function public.move_inventory(uuid,uuid,text,numeric,bigint,text) from public,anon;
grant execute on function public.move_inventory(uuid,uuid,text,numeric,bigint,text) to authenticated;

create function public.save_inventory_product(p_product jsonb,p_initial_quantity numeric default 0,p_expected_version integer default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare cid uuid:=private.current_company_id(); pid uuid:=(p_product->>'id')::uuid; previous public.inventory_products%rowtype;
begin
 if auth.uid() is null or cid is null then raise exception 'Não autenticado'; end if;
 if pid is null then raise exception 'Identificador obrigatório'; end if;
 if p_initial_quantity is null or p_initial_quantity<0 or p_initial_quantity>1000000 or p_initial_quantity<>round(p_initial_quantity,3) then raise exception 'Saldo inicial inválido'; end if;
 select * into previous from public.inventory_products where id=pid and company_id=cid;
 if p_expected_version is null then
  if found then
   if previous.name<>btrim(p_product->>'name') or previous.kind<>p_product->>'kind' or previous.cost_cents<>(p_product->>'cost_cents')::bigint then raise exception 'Produto já existe; reabra para editar'; end if;
   return pid;
  end if;
  insert into public.inventory_products(id,company_id,name,category,kind,package_unit,package_quantity,cost_cents,sale_cents,minimum_quantity,supplier_name,supplier_url,photo_path,notes,active)
  values(pid,cid,btrim(p_product->>'name'),coalesce(nullif(p_product->>'category',''),'Outros'),p_product->>'kind',p_product->>'package_unit',(p_product->>'package_quantity')::numeric,(p_product->>'cost_cents')::bigint,coalesce((p_product->>'sale_cents')::bigint,0),coalesce((p_product->>'minimum_quantity')::numeric,0),nullif(btrim(p_product->>'supplier_name'),''),nullif(btrim(p_product->>'supplier_url'),''),nullif(p_product->>'photo_path',''),nullif(p_product->>'notes',''),coalesce((p_product->>'active')::boolean,true));
  if p_initial_quantity>0 then perform public.move_inventory(pid,pid,'opening',p_initial_quantity,(p_product->>'cost_cents')::bigint,'Saldo inicial'); end if;
 else
  update public.inventory_products set name=btrim(p_product->>'name'),category=coalesce(nullif(p_product->>'category',''),'Outros'),kind=p_product->>'kind',package_unit=p_product->>'package_unit',package_quantity=(p_product->>'package_quantity')::numeric,cost_cents=(p_product->>'cost_cents')::bigint,sale_cents=coalesce((p_product->>'sale_cents')::bigint,0),minimum_quantity=coalesce((p_product->>'minimum_quantity')::numeric,0),supplier_name=nullif(btrim(p_product->>'supplier_name'),''),supplier_url=nullif(btrim(p_product->>'supplier_url'),''),photo_path=nullif(p_product->>'photo_path',''),notes=nullif(p_product->>'notes',''),active=coalesce((p_product->>'active')::boolean,true)
   where id=pid and company_id=cid and version=p_expected_version;
  if not found then raise exception 'Produto alterado por outra sessão. Atualize o estoque e abra novamente'; end if;
 end if;
 return pid;
end $$;
revoke all on function public.save_inventory_product(jsonb,numeric,integer) from public,anon;
grant execute on function public.save_inventory_product(jsonb,numeric,integer) to authenticated;

alter table public.quote_items add column product_id uuid, add column item_kind text not null default 'service';
alter table public.quote_items add constraint quote_item_product_company_fk foreign key(company_id,product_id) references public.inventory_products(company_id,id);
alter table public.quote_items add constraint quote_item_kind_check check((item_kind='service' and product_id is null) or (item_kind='product' and product_id is not null and service_id is null));
create index quote_items_product_idx on public.quote_items(company_id,product_id) where product_id is not null;
create function private.validate_inventory_quote_item() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.inventory_products%rowtype;
begin
 if new.product_id is not null then
  select * into p from public.inventory_products where id=new.product_id and company_id=new.company_id;
  if not found or not p.active or p.kind='supply' then raise exception 'Produto de venda inválido ou inativo'; end if;
  new.item_kind:='product'; new.service_id:=null;
  if tg_op='INSERT' then new.description:=p.name; end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_inventory_quote_item() from public,anon,authenticated;
create trigger quote_inventory_item before insert or update on public.quote_items for each row execute function private.validate_inventory_quote_item();

create or replace function public.create_quote(p_quote jsonb,p_items jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare cid uuid:=private.current_company_id(); qid uuid; subtotal numeric; discount bigint;
begin
 if auth.uid() is null or cid is null then raise exception 'Não autenticado'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>100 then raise exception 'Selecione entre 1 e 100 serviços ou produtos'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) i where (i->>'quantity') is null or (i->>'quantity')::numeric not between 1 and 9999 or (i->>'quantity')::numeric<>trunc((i->>'quantity')::numeric) or (i->>'unit_cents') is null or (i->>'unit_cents')::numeric not between 0 and 1000000000 or (i->>'unit_cents')::numeric<>trunc((i->>'unit_cents')::numeric)) then raise exception 'Quantidade ou preço de item inválido'; end if;
 select coalesce(sum((i->>'unit_cents')::numeric*(i->>'quantity')::integer),0) into subtotal from jsonb_array_elements(p_items) i;
 discount:=coalesce((p_quote->>'discount_cents')::bigint,0);
 if discount<0 or discount>subtotal or subtotal>1000000000000 then raise exception 'Desconto ou total inválido'; end if;
 insert into public.quotes(company_id,client_id,vehicle_id,status,discount_cents,notes)
 values(cid,(p_quote->>'client_id')::uuid,(p_quote->>'vehicle_id')::uuid,'draft',discount,nullif(p_quote->>'notes','')) returning id into qid;
 insert into public.quote_items(company_id,quote_id,service_id,product_id,item_kind,description,quantity,unit_cents)
 select cid,qid,nullif(i->>'service_id','')::uuid,nullif(i->>'product_id','')::uuid,case when nullif(i->>'product_id','') is not null then 'product' else 'service' end,i->>'description',(i->>'quantity')::integer,(i->>'unit_cents')::bigint from jsonb_array_elements(p_items) i;
 return qid;
end $$;
revoke all on function public.create_quote(jsonb,jsonb) from public,anon;
grant execute on function public.create_quote(jsonb,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('inventory-photos','inventory-photos',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy inventory_photos_read on storage.objects for select to authenticated using(bucket_id='inventory-photos' and split_part(name,'/',1)=(select private.current_company_id())::text);
create policy inventory_photos_insert on storage.objects for insert to authenticated with check(bucket_id='inventory-photos' and split_part(name,'/',1)=(select private.current_company_id())::text);
create policy inventory_photos_delete on storage.objects for delete to authenticated using(bucket_id='inventory-photos' and split_part(name,'/',1)=(select private.current_company_id())::text);
notify pgrst,'reload schema';
