-- ─────────────────────────────────────────────────────────────────────────────
-- Table : universities — Établissements d'enseignement supérieur au Bénin
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── Création de la table ────────────────────────────────────────────────────

create table if not exists public.universities (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  short_name text,
  city       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.universities enable row level security;

-- Lecture publique (pour le dropdown du formulaire étudiant)
create policy "Lecture publique des universités"
  on public.universities for select
  using (true);

-- Seul le service role (admin) peut modifier les universités
-- (pas de politique INSERT/UPDATE/DELETE pour les utilisateurs)


-- ─── Données : 15 établissements béninois ────────────────────────────────────

insert into public.universities (name, short_name, city) values
  ('Université d''Abomey-Calavi',                                   'UAC',       'Abomey-Calavi'),
  ('École Polytechnique d''Abomey-Calavi',                          'EPAC',      'Abomey-Calavi'),
  ('Faculté des Sciences et Techniques',                            'FAST',      'Abomey-Calavi'),
  ('Faculté des Sciences Économiques et de Gestion',                'FASEG',     'Cotonou'),
  ('Faculté de Droit et de Sciences Politiques',                    'FADESP',    'Abomey-Calavi'),
  ('Faculté des Lettres, Arts et Sciences Humaines',                'FLASH',     'Abomey-Calavi'),
  ('Faculté des Sciences de la Santé',                              'FSS',       'Cotonou'),
  ('École Nationale d''Économie Appliquée et de Management',        'ENEAM',     'Cotonou'),
  ('Institut de Formation et de Recherche en Informatique',         'IFRI',      'Abomey-Calavi'),
  ('Université Nationale des Sciences Technologies Ingénierie et Mathématiques', 'UNSTIM', 'Abomey-Calavi'),
  ('Université de Parakou',                                         'UP',        'Parakou'),
  ('École Supérieure de Gestion Informatique et des Sciences',      'ESGIS',     'Cotonou'),
  ('Institut Supérieur du Bénin des Affaires',                      'ISBA',      'Cotonou'),
  ('Université Catholique de l''Afrique de l''Ouest — Bénin',       'UCAO-UUB',  'Cotonou'),
  ('Institut Universitaire de Technologie de Lokossa',              'IUT',       'Lokossa')
on conflict do nothing;
