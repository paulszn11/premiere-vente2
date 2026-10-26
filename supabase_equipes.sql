-- Première vente : les équipes sur le site hébergé (à lancer après supabase.sql).
-- Une commande par bloc : si ton éditeur n'accepte qu'une commande à la fois, lance-les une par une, dans l'ordre.

create table if not exists public.pv_teams (owner uuid primary key default auth.uid() references auth.users (id) on delete cascade, code text not null unique, data jsonb not null, updated_at timestamptz not null default now());

create table if not exists public.pv_members (user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade, team text not null default '', data jsonb not null, updated_at timestamptz not null default now());

create or replace function public.pv_my_team() returns text language sql stable security definer set search_path = public as $$ select coalesce((select team from public.pv_members where user_id = auth.uid()), '') $$;

create or replace function public.pv_find_team(c text) returns uuid language sql stable security definer set search_path = public as $$ select owner from public.pv_teams where code = upper(c) limit 1 $$;

alter table public.pv_teams enable row level security;

alter table public.pv_members enable row level security;

create policy "pv equipe lire" on public.pv_teams for select to authenticated using (owner = (select auth.uid()) or owner::text = public.pv_my_team());

create policy "pv equipe creer" on public.pv_teams for insert to authenticated with check (owner = (select auth.uid()));

create policy "pv equipe modifier" on public.pv_teams for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

create policy "pv membre lire" on public.pv_members for select to authenticated using (user_id = (select auth.uid()) or (team <> '' and team = public.pv_my_team()));

create policy "pv membre creer" on public.pv_members for insert to authenticated with check (user_id = (select auth.uid()));

create policy "pv membre modifier" on public.pv_members for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update on public.pv_teams, public.pv_members to authenticated;

revoke all on public.pv_teams, public.pv_members from anon;

revoke execute on function public.pv_my_team(), public.pv_find_team(text) from public, anon;

grant execute on function public.pv_my_team(), public.pv_find_team(text) to authenticated;
