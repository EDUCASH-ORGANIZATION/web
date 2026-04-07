-- ─────────────────────────────────────────────────────────────────────────────
-- EduCash — Schéma Supabase
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ─── Table : profiles ─────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  full_name   text,
  city        text,
  avatar_url  text,
  bio         text,
  phone       text,
  role        text not null check (role in ('student', 'client', 'admin')) default 'student',
  is_verified boolean not null default false,
  rating      numeric(3, 2) not null default 0,
  missions_done integer not null default 0,
  fcm_token   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Lecture publique des profils"
  on public.profiles for select
  using (true);

create policy "Utilisateur modifie son propre profil"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Utilisateur met à jour son propre profil"
  on public.profiles for update
  using (auth.uid() = user_id);


-- ─── Table : student_profiles ─────────────────────────────────────────────────
create table if not exists public.student_profiles (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  school       text,
  level        text,
  skills       text[] not null default '{}',
  card_url     text,
  availability text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

create policy "Lecture publique student_profiles"
  on public.student_profiles for select
  using (true);

create policy "Étudiant insère son profil"
  on public.student_profiles for insert
  with check (auth.uid() = user_id);

create policy "Étudiant met à jour son profil"
  on public.student_profiles for update
  using (auth.uid() = user_id);


-- ─── Table : missions ─────────────────────────────────────────────────────────
create table if not exists public.missions (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references auth.users(id) on delete cascade,
  title               text not null,
  description         text not null,
  type                text not null,
  city                text not null,
  budget              numeric(10, 2) not null,
  urgency             text not null check (urgency in ('low', 'medium', 'high')) default 'medium',
  status              text not null check (status in ('open', 'in_progress', 'done', 'cancelled')) default 'open',
  deadline            date,
  selected_student_id uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.missions enable row level security;

create policy "Lecture publique des missions ouvertes"
  on public.missions for select
  using (status = 'open' or auth.uid() = client_id or auth.uid() = selected_student_id);

create policy "Client crée une mission"
  on public.missions for insert
  with check (auth.uid() = client_id);

create policy "Client modifie sa mission"
  on public.missions for update
  using (auth.uid() = client_id);


-- ─── Table : applications ─────────────────────────────────────────────────────
create table if not exists public.applications (
  id         uuid primary key default uuid_generate_v4(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  message    text not null,
  status     text not null check (status in ('pending', 'accepted', 'rejected')) default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_id, student_id)
);

alter table public.applications enable row level security;

create policy "Étudiant voit ses candidatures"
  on public.applications for select
  using (auth.uid() = student_id);

create policy "Client voit les candidatures à ses missions"
  on public.applications for select
  using (
    auth.uid() in (
      select client_id from public.missions where id = mission_id
    )
  );

create policy "Étudiant postule"
  on public.applications for insert
  with check (auth.uid() = student_id);

create policy "Client accepte / refuse"
  on public.applications for update
  using (
    auth.uid() in (
      select client_id from public.missions where id = mission_id
    )
  );


-- ─── Table : messages ─────────────────────────────────────────────────────────
create table if not exists public.messages (
  id          uuid primary key default uuid_generate_v4(),
  mission_id  uuid not null references public.missions(id) on delete cascade,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Participants lisent les messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Envoi de message"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Marquer comme lu"
  on public.messages for update
  using (auth.uid() = receiver_id);


-- ─── Table : transactions ─────────────────────────────────────────────────────
create table if not exists public.transactions (
  id             uuid primary key default uuid_generate_v4(),
  mission_id     uuid not null references public.missions(id) on delete cascade,
  client_id      uuid not null references auth.users(id) on delete cascade,
  student_id     uuid not null references auth.users(id) on delete cascade,
  amount_total   numeric(10, 2) not null,
  commission     numeric(10, 2) not null,
  amount_student numeric(10, 2) not null,
  fedapay_id     text,
  status         text not null check (status in ('pending', 'paid', 'failed', 'refunded')) default 'pending',
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Parties concernées voient la transaction"
  on public.transactions for select
  using (auth.uid() = client_id or auth.uid() = student_id);


-- ─── Table : reviews ──────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id          uuid primary key default uuid_generate_v4(),
  mission_id  uuid not null references public.missions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewed_id uuid not null references auth.users(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (mission_id, reviewer_id)
);

alter table public.reviews enable row level security;

create policy "Lecture publique des avis"
  on public.reviews for select
  using (true);

create policy "Auteur publie un avis"
  on public.reviews for insert
  with check (auth.uid() = reviewer_id);


-- ─── Trigger : updated_at automatique ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_student_profiles_updated_at
  before update on public.student_profiles
  for each row execute function public.set_updated_at();

create trigger set_missions_updated_at
  before update on public.missions
  for each row execute function public.set_updated_at();

create trigger set_applications_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();


-- ─── Storage buckets ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('student-cards', 'student-cards', false)
on conflict (id) do nothing;

create policy "Upload avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Lecture publique avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Upload carte étudiante"
  on storage.objects for insert
  with check (bucket_id = 'student-cards' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Étudiant lit sa propre carte"
  on storage.objects for select
  using (bucket_id = 'student-cards' and auth.uid()::text = (storage.foldername(name))[1]);
