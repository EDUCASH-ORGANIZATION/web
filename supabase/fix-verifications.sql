-- ─────────────────────────────────────────────────────────────────────────────
-- FIX : Système de vérification des dossiers étudiants
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Colonnes de suivi du rejet et de l'expiration ───────────────────────

alter table public.profiles
  add column if not exists rejection_reason  text;

-- Date d'expiration du badge (YYYY-MM-DD), null si non vérifié
alter table public.profiles
  add column if not exists verified_until    date;

-- Date de soumission initiale du dossier (pour trier dans l'admin)
alter table public.profiles
  add column if not exists verification_submitted_at timestamptz;

-- ─── 1b. Clé étrangère entre student_profiles et profiles ────────────────────
-- Nécessaire pour que PostgREST puisse faire les jointures embarquées.
-- student_profiles.user_id → profiles.user_id

alter table public.student_profiles
  drop constraint if exists fk_student_profiles_profile;

alter table public.student_profiles
  add constraint fk_student_profiles_profile
  foreign key (user_id)
  references public.profiles(user_id)
  on delete cascade;

-- is_verified  = true  → dossier approuvé
-- is_verified  = false + rejection_reason IS NOT NULL → dossier rejeté
-- is_verified  = false + rejection_reason IS NULL     → en attente


-- ─── 2. RLS — Admin peut lire tous les profils ───────────────────────────────
-- (Sans ça, les requêtes admin retournent 0 ligne)

drop policy if exists "Admin peut lire tous les profils" on public.profiles;
drop policy if exists "Admin lit tous les profils"        on public.profiles;

create policy "Admin lit tous les profils"
  on public.profiles for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or auth.uid() = user_id
  );


-- ─── 3. RLS — Admin peut lire tous les student_profiles ──────────────────────

drop policy if exists "Admin lit tous les student_profiles" on public.student_profiles;

create policy "Admin lit tous les student_profiles"
  on public.student_profiles for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or auth.uid() = user_id
  );


-- ─── 4. Storage — Admin peut lire toutes les cartes étudiantes ───────────────
-- Nécessaire pour générer des signed URLs côté serveur (bucket student-cards est privé)

drop policy if exists "Admin lit toutes les cartes"       on storage.objects;
drop policy if exists "Admin lit toutes les cartes étudiantes" on storage.objects;

create policy "Admin lit toutes les cartes étudiantes"
  on storage.objects for select
  using (
    bucket_id = 'student-cards'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );


-- ─── 5. RLS — Admin peut mettre à jour n'importe quel profil ─────────────────

drop policy if exists "Admin met à jour tous les profils" on public.profiles;

create policy "Admin met à jour tous les profils"
  on public.profiles for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or auth.uid() = user_id
  )
  with check (true);
