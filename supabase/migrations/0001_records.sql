-- SOMA · almacenamiento cifrado de extremo a extremo.
-- El servidor solo guarda texto cifrado: no ve fechas, notas, métricas ni nombres.

create table if not exists public.records (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- HMAC del tipo y la clave del registro (no revela la fecha).
  id text not null,
  iv text not null,
  ciphertext text not null,
  deleted boolean not null default false,
  -- Momento de edición en el dispositivo (ms); define "gana el último".
  client_updated_at bigint not null,
  -- Marca del servidor; los clientes descargan lo que cambió desde su último cursor.
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create index if not exists records_user_server_updated_idx
  on public.records (user_id, server_updated_at);

-- Marca de servidor siempre propia, y una edición más vieja nunca pisa a una más nueva.
create or replace function public.records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.client_updated_at < old.client_updated_at then
    return old;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write
  before insert or update on public.records
  for each row execute function public.records_before_write();

-- Seguridad: cada usuario solo puede ver y escribir sus propias filas.
alter table public.records enable row level security;

drop policy if exists "records: dueño lee" on public.records;
create policy "records: dueño lee" on public.records
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "records: dueño inserta" on public.records;
create policy "records: dueño inserta" on public.records
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "records: dueño actualiza" on public.records;
create policy "records: dueño actualiza" on public.records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "records: dueño borra" on public.records;
create policy "records: dueño borra" on public.records
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.records from anon;

-- Eliminar la cuenta propia. Borra el usuario de auth; sus filas se van en cascada.
-- La app reautentica (verifica la contraseña) antes de llamarla.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
