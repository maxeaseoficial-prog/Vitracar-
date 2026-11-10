-- Exclusão de clientes por arquivamento. Somente adiciona uma coluna: nenhum dado, usuário,
-- atendimento, pagamento ou moeda é alterado ou apagado. Registros antigos ficam com archived_at nulo.
alter table public.clients add column if not exists archived_at timestamptz;
create index if not exists clients_active_idx on public.clients(company_id,name) where archived_at is null;
