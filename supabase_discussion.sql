-- Première vente : discussion d'équipe (messages, photos, fichiers) et progression commune.
-- À lancer après supabase.sql et supabase_equipes.sql.

-- progression commune : une ligne par mission ou case cochée, pour toute l'équipe
create table if not exists public.pv_team_done (
  team text not null,
  k text not null,
  v boolean not null,
  t bigint not null,
  by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (team, k)
);
alter table public.pv_team_done enable row level security;
create policy "pv commun lire" on public.pv_team_done for select to authenticated using (team <> '' and team = (select public.pv_my_team()));
create policy "pv commun creer" on public.pv_team_done for insert to authenticated with check (team <> '' and team = (select public.pv_my_team()) and by = (select auth.uid()));
create policy "pv commun modifier" on public.pv_team_done for update to authenticated using (team <> '' and team = (select public.pv_my_team())) with check (team = (select public.pv_my_team()) and by = (select auth.uid()));
grant select, insert, update on public.pv_team_done to authenticated;
revoke all on public.pv_team_done from anon;

-- messages de l'équipe
create table if not exists public.pv_messages (
  id bigint generated always as identity primary key,
  team text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prenom text not null default '',
  body text not null default '' check (length(body) <= 4000),
  file jsonb,
  created_at timestamptz not null default now()
);
create index if not exists pv_messages_team_idx on public.pv_messages (team, id desc);
alter table public.pv_messages enable row level security;
create policy "pv message lire" on public.pv_messages for select to authenticated using (team <> '' and team = (select public.pv_my_team()));
create policy "pv message envoyer" on public.pv_messages for insert to authenticated with check (user_id = (select auth.uid()) and team <> '' and team = (select public.pv_my_team()));
create policy "pv message supprimer" on public.pv_messages for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.pv_messages to authenticated;
revoke all on public.pv_messages from anon;

-- photos et fichiers : espace privé, un dossier par équipe, 10 Mo par fichier
insert into storage.buckets (id, name, public, file_size_limit) values ('pv-chat', 'pv-chat', false, 10485760) on conflict (id) do update set public = false, file_size_limit = 10485760;
create policy "pv fichier lire" on storage.objects for select to authenticated using (bucket_id = 'pv-chat' and (storage.foldername(name))[1] = (select public.pv_my_team()));
create policy "pv fichier envoyer" on storage.objects for insert to authenticated with check (bucket_id = 'pv-chat' and (storage.foldername(name))[1] = (select public.pv_my_team()) and (select public.pv_my_team()) <> '');
create policy "pv fichier supprimer" on storage.objects for delete to authenticated using (bucket_id = 'pv-chat' and owner_id = (select auth.uid())::text);

-- temps réel : les nouveautés arrivent tout de suite chez les autres membres
alter publication supabase_realtime add table public.pv_messages, public.pv_team_done, public.pv_members;
