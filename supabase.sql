-- Première vente : la table qui garde ta progression, ton carnet, tes notes et Ma boutique.
-- À coller dans Supabase, SQL Editor, puis « Run ». Chaque compte ne voit et ne modifie que ses propres lignes.
create table if not exists public.pv_docs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null check (path in ('progress', 'carnet', 'notes')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, path)
);
alter table public.pv_docs enable row level security;
drop policy if exists "pv lire" on public.pv_docs;
drop policy if exists "pv creer" on public.pv_docs;
drop policy if exists "pv modifier" on public.pv_docs;
drop policy if exists "pv supprimer" on public.pv_docs;
create policy "pv lire" on public.pv_docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "pv creer" on public.pv_docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "pv modifier" on public.pv_docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "pv supprimer" on public.pv_docs for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.pv_docs from anon;
grant select, insert, update, delete on public.pv_docs to authenticated;
