-- ─────────────────────────────────────────────────────────────────────────────
-- FIX : trigger handle_new_user + sync rôle + colonne is_suspended
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Ajouter is_suspended si absent ───────────────────────────────────────

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;


-- ─── 2. Supprimer les anciens triggers/fonctions ──────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists trg_on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

drop trigger if exists on_profile_role_changed on public.profiles;
drop function if exists public.sync_role_to_auth() cascade;


-- ─── 3. Trigger A : création d'utilisateur ───────────────────────────────────
-- Lit le rôle depuis user_metadata et crée le profil public correspondant.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'student');

  if v_role not in ('student', 'client', 'admin') then
    v_role := 'student';
  end if;

  insert into public.profiles (user_id, role, is_verified, is_suspended, rating, missions_done)
  values (new.id, v_role, false, false, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── 4. Trigger B : synchronisation du rôle (LA CLÉ) ────────────────────────
-- Quand le rôle change dans public.profiles (ex: promotion admin),
-- met à jour raw_user_meta_data dans auth.users automatiquement.
-- Ainsi le JWT est regénéré avec le bon rôle à la prochaine connexion.

create or replace function public.sync_role_to_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ne fait rien si le rôle n'a pas changé
  if old.role = new.role then
    return new;
  end if;

  -- Met à jour raw_user_meta_data dans auth.users
  update auth.users
  set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', new.role)
  where id = new.user_id;

  return new;
end;
$$;

create trigger on_profile_role_changed
  after update of role on public.profiles
  for each row execute function public.sync_role_to_auth();


-- ─── 5. Politique RLS ────────────────────────────────────────────────────────

drop policy if exists "Admin suspend un utilisateur" on public.profiles;

create policy "Admin suspend un utilisateur"
  on public.profiles for update
  using (true)
  with check (true);


-- ─── 6. Synchronisation immédiate des rôles existants ────────────────────────
-- Met à jour les user_metadata de TOUS les utilisateurs existants
-- dont le rôle en DB ne correspond pas à leur user_metadata.
-- À exécuter une seule fois pour corriger les comptes déjà créés.

update auth.users u
set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', p.role)
from public.profiles p
where u.id = p.user_id
  and (u.raw_user_meta_data->>'role') is distinct from p.role;
