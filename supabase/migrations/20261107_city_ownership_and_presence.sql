-- City Chaos: atribución de construcciones y presencia en salas.
-- Ejecutar una sola vez en Supabase → SQL Editor → New query.

-- 1) Cada casilla recuerda qué cuenta colocó el objeto actual.
alter table public.city_tiles
  add column if not exists created_by uuid
  references auth.users(id) on delete set null;

alter table public.city_tiles
  add column if not exists created_by_name text;

create index if not exists city_tiles_room_creator_idx
  on public.city_tiles (room_id, created_by);

-- Sustituir las políticas de escritura anteriores para asegurar que
-- el autor registrado de un objeto sea la cuenta autenticada que lo escribió.
drop policy if exists "Los jugadores pueden construir" on public.city_tiles;
create policy "Los jugadores pueden construir"
  on public.city_tiles
  for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Los jugadores pueden modificar construcciones" on public.city_tiles;
create policy "Los jugadores pueden modificar construcciones"
  on public.city_tiles
  for update to authenticated
  using (true)
  with check (auth.uid() = created_by);

-- 2) Presencia: una fila por cuenta y sala.
-- El navegador actualiza last_seen periódicamente. Se consideran presentes
-- quienes han enviado latido en los últimos 35 segundos.
create table if not exists public.city_presence (
  room_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists city_presence_room_seen_idx
  on public.city_presence (room_id, last_seen desc);

alter table public.city_presence enable row level security;

drop policy if exists "Los jugadores pueden ver presencia" on public.city_presence;
create policy "Los jugadores pueden ver presencia"
  on public.city_presence
  for select to authenticated
  using (true);

drop policy if exists "Cada jugador registra su presencia" on public.city_presence;
create policy "Cada jugador registra su presencia"
  on public.city_presence
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Cada jugador actualiza su presencia" on public.city_presence;
create policy "Cada jugador actualiza su presencia"
  on public.city_presence
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Cada jugador elimina su presencia" on public.city_presence;
create policy "Cada jugador elimina su presencia"
  on public.city_presence
  for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.city_tiles to authenticated;
grant select, insert, update, delete on public.city_presence to authenticated;
