-- Offline-first custom vocabulary sync schema for Supabase Postgres.
-- Apply through Supabase CLI or SQL Editor. No secrets belong in the client app.

create extension if not exists pgcrypto;

create table if not exists public.vocabulary_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Client-generated timestamp is metadata only; server trigger maintains updated_at.
  unique (user_id, id)
);

create index if not exists vocabulary_lists_user_updated_idx
  on public.vocabulary_lists (user_id, updated_at desc);

create table if not exists public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null,
  word text not null check (length(trim(word)) between 1 and 100),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vocabulary_items_list_owner_fk
    foreign key (user_id, list_id)
    references public.vocabulary_lists(user_id, id)
    on delete cascade
);

create index if not exists vocabulary_items_user_list_position_idx
  on public.vocabulary_items (user_id, list_id, position);
create index if not exists vocabulary_items_user_updated_idx
  on public.vocabulary_items (user_id, updated_at desc);

-- Make server timestamps authoritative. Tombstones remain ordinary rows and
-- therefore continue to participate in sync until a deliberate GC policy exists.
create or replace function public.set_vocabulary_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Once deleted, a row cannot be resurrected by a stale offline upsert.
  if tg_op = 'UPDATE' then
    if old.deleted_at is not null then
      new.deleted_at := old.deleted_at;
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists vocabulary_lists_set_updated_at on public.vocabulary_lists;
create trigger vocabulary_lists_set_updated_at
  before insert or update on public.vocabulary_lists
  for each row execute function public.set_vocabulary_updated_at();

drop trigger if exists vocabulary_items_set_updated_at on public.vocabulary_items;
create trigger vocabulary_items_set_updated_at
  before insert or update on public.vocabulary_items
  for each row execute function public.set_vocabulary_updated_at();

alter table public.vocabulary_lists enable row level security;
alter table public.vocabulary_items enable row level security;

-- Authenticated users can only access their own lists.
drop policy if exists "Users manage their own vocabulary lists" on public.vocabulary_lists;
create policy "Users manage their own vocabulary lists"
  on public.vocabulary_lists for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Item ownership must match both the signed-in user and the parent list owner.
drop policy if exists "Users manage their own vocabulary items" on public.vocabulary_items;
create policy "Users manage their own vocabulary items"
  on public.vocabulary_items for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.vocabulary_lists l
      where l.id = vocabulary_items.list_id and l.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.vocabulary_lists l
      where l.id = vocabulary_items.list_id and l.user_id = (select auth.uid()) 
    )
  );

grant select, insert, update, delete on public.vocabulary_lists to authenticated;
grant select, insert, update, delete on public.vocabulary_items to authenticated;

comment on table public.vocabulary_lists is 'User-owned custom vocabulary lists; deleted rows are retained as sync tombstones.';
comment on table public.vocabulary_items is 'Individual user-owned vocabulary entries; independent rows enable offline merge.';
