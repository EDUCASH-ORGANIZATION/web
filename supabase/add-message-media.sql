-- OBSOLETE, NE PAS EXECUTER EN PRODUCTION (RD-SEC-03, 2026-10-14).
-- Motif : recrée la politique "Read message media" (lecture de tout le bucket par tous) ; sur une base neuve, crée aussi le bucket sans limite de taille ni types MIME.
-- État de référence de la base : supabase/schema.sql (régénéré depuis la production).

-- ─── Colonnes média sur la table messages ────────────────────────────────────
alter table public.messages
  add column if not exists type text not null default 'text'
    check (type in ('text', 'voice', 'image', 'location')),
  add column if not exists media_url text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

-- ─── Bucket message-media (public en lecture) ─────────────────────────────────
insert into storage.buckets (id, name, public)
values ('message-media', 'message-media', true)
on conflict (id) do nothing;

-- Upload : seuls les utilisateurs authentifiés peuvent uploader DANS leur dossier
create policy "Upload message media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Lecture : tout le monde (bucket public, sert les URLs directement)
create policy "Read message media"
  on storage.objects for select
  using (bucket_id = 'message-media');

-- Suppression : uniquement son propre contenu
create policy "Delete own message media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'message-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
