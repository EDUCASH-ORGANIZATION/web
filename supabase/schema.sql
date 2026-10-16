-- =============================================================================
-- État de référence de la production Educash après RD-SEC-01, RD-SEC-02 et
-- RD-SEC-03b (relevé du 2026-10-14, puis scripts 60, 61 et 62 de RD-SEC-03b), puis
-- script 70 de RD-MISSION-02 (colonne missions.purchases_estimate), puis script 80 de RD-NOTIF-01
-- (table public.notifications), puis script 90 de RD-DONE-01 (colonne
-- missions.completion_declared_at), puis script 91 de RD-ACCEPT-01 (colonne
-- applications.accepted_at).
-- Script 70 appliqué en production le 2026-10-15.
-- Script 80 de RD-NOTIF-01 appliqué en production le 2026-10-15.
-- Script 90 de RD-DONE-01 appliqué en production le 2026-10-15.
-- Script 91 (RD-ACCEPT-01) NON appliqué en production au 2026-10-16 : à retirer après application.
-- DOCUMENTATION DE RÉFÉRENCE : ne pas exécuter sur la base de production (les
-- politiques RLS s'additionnent, rejouer des politiques plus larges rouvrirait des
-- failles). Pour une base neuve ou la migration Neon, vérifier d'abord les points
-- propres à Supabase (auth.users, auth.uid(), rôles anon/authenticated/service_role,
-- storage.*). Régénération : refaire les lectures de catalogue suivantes :
-- pg_get_functiondef, pg_get_constraintdef, pg_get_indexdef, pg_get_triggerdef,
-- pg_policies, information_schema.role_table_grants et column_privileges,
-- pg_proc.proacl, storage.buckets, pg_publication_tables.
--
-- Source : projet Supabase ymdtwtlnenxpfnxdipek, lecture seule du catalogue.
-- Ordre : extensions, tables, contraintes, index, fonctions, triggers, RLS et
-- politiques, privilèges, buckets, realtime.
-- =============================================================================
-- Garde : le fichier s'arrête si la base contient déjà public.profiles. Il est
-- exécuté dans une transaction unique (begin ... commit en fin de fichier).
-- psql : lancer avec -v ON_ERROR_STOP=1
begin;

do $$
begin
  if to_regclass('public.profiles') is not null then
    raise exception 'schema.sql : base existante detectee, abandon. Ce fichier est une documentation de reference, ne pas l''executer sur une base existante.';
  end if;
end
$$;

-- 1. EXTENSIONS

-- pg_cron 1.6.4 (schéma pg_catalog)
create extension if not exists "pg_cron" with schema pg_catalog;

-- pg_net 0.20.0 (schéma public)
create extension if not exists "pg_net" with schema public;

-- pg_stat_statements 1.11 (schéma extensions)
create extension if not exists "pg_stat_statements" with schema extensions;

-- pgcrypto 1.3 (schéma extensions)
create extension if not exists "pgcrypto" with schema extensions;

-- supabase_vault 0.3.1 (schéma vault)
create extension if not exists "supabase_vault" with schema vault;

-- uuid-ossp 1.1 (schéma extensions)
create extension if not exists "uuid-ossp" with schema extensions;


-- 2. TYPES
-- Aucun type enum ou composite personnalisé dans le schéma public.

-- 3. TABLES

create table public.profiles (
  id uuid default uuid_generate_v4() not null,
  user_id uuid not null,
  full_name text,
  city text,
  avatar_url text,
  bio text,
  phone text,
  role text not null,
  is_verified boolean default false,
  rating numeric(2,1) default 0,
  missions_done integer default 0,
  fcm_token text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  is_suspended boolean default false not null,
  rejection_reason text,
  verified_until date,
  verification_submitted_at timestamp with time zone
);

create table public.student_profiles (
  id uuid default uuid_generate_v4() not null,
  user_id uuid not null,
  school text,
  level text,
  skills text[] default '{}'::text[],
  card_url text,
  availability text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.universities (
  id uuid default uuid_generate_v4() not null,
  name text not null,
  short_name text not null,
  city text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table public.wallets (
  id uuid default uuid_generate_v4() not null,
  user_id uuid not null,
  balance numeric default 0,
  reserved numeric default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.missions (
  id uuid default uuid_generate_v4() not null,
  client_id uuid not null,
  title text not null,
  description text not null,
  type text not null,
  city text not null,
  budget numeric not null,
  urgency text default 'low'::text not null,
  status text default 'open'::text not null,
  deadline date,
  selected_student_id uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  purchases_estimate numeric,
  completion_declared_at timestamp with time zone
);

create table public.reviews (
  id uuid default uuid_generate_v4() not null,
  mission_id uuid not null,
  reviewer_id uuid not null,
  reviewed_id uuid not null,
  rating integer not null,
  comment text,
  created_at timestamp with time zone default now()
);

create table public.transactions (
  id uuid default uuid_generate_v4() not null,
  mission_id uuid not null,
  client_id uuid not null,
  student_id uuid not null,
  amount_total numeric not null,
  commission numeric not null,
  amount_student numeric not null,
  fedapay_id text,
  status text default 'pending'::text not null,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.wallet_transactions (
  id uuid default uuid_generate_v4() not null,
  user_id uuid not null,
  type text not null,
  amount numeric not null,
  balance_before numeric not null,
  balance_after numeric not null,
  mission_id uuid,
  fedapay_id text,
  note text,
  created_at timestamp with time zone default now(),
  reverses_id uuid
);

create table public.applications (
  id uuid default uuid_generate_v4() not null,
  mission_id uuid not null,
  student_id uuid not null,
  message text not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  accepted_at timestamp with time zone
);

create table public.messages (
  id uuid default uuid_generate_v4() not null,
  mission_id uuid not null,
  sender_id uuid not null,
  receiver_id uuid not null,
  content text not null,
  read boolean default false,
  created_at timestamp with time zone default now(),
  type text default 'text'::text not null,
  media_url text,
  location_lat double precision,
  location_lng double precision
);

create table public.mission_completions (
  mission_id uuid not null,
  student_id uuid,
  created_at timestamp with time zone default now() not null
);

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  recipient_id uuid not null,
  type text not null,
  title text not null,
  body text default ''::text not null,
  mission_id uuid,
  actor_id uuid,
  dedupe_key text not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

-- 4. CONTRAINTES (clés primaires, uniques, checks, puis clés étrangères)

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.student_profiles add constraint student_profiles_pkey PRIMARY KEY (id);
alter table public.universities add constraint universities_pkey PRIMARY KEY (id);
alter table public.wallets add constraint wallets_pkey PRIMARY KEY (id);
alter table public.missions add constraint missions_pkey PRIMARY KEY (id);
alter table public.reviews add constraint reviews_pkey PRIMARY KEY (id);
alter table public.transactions add constraint transactions_pkey PRIMARY KEY (id);
alter table public.wallet_transactions add constraint wallet_transactions_pkey PRIMARY KEY (id);
alter table public.applications add constraint applications_pkey PRIMARY KEY (id);
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.mission_completions add constraint mission_completions_pkey PRIMARY KEY (mission_id);
alter table public.profiles add constraint profiles_user_id_key UNIQUE (user_id);
alter table public.student_profiles add constraint student_profiles_user_id_key UNIQUE (user_id);
alter table public.universities add constraint universities_name_key UNIQUE (name);
alter table public.wallets add constraint wallets_user_id_key UNIQUE (user_id);
alter table public.reviews add constraint reviews_mission_id_reviewer_id_key UNIQUE (mission_id, reviewer_id);
alter table public.applications add constraint applications_mission_id_student_id_key UNIQUE (mission_id, student_id);
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['student'::text, 'client'::text, 'admin'::text])));
alter table public.wallets add constraint wallets_balance_check CHECK ((balance >= (0)::numeric));
alter table public.wallets add constraint wallets_reserved_check CHECK ((reserved >= (0)::numeric));
alter table public.missions add constraint missions_budget_check CHECK ((budget >= (0)::numeric));
alter table public.missions add constraint missions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text])));
alter table public.missions add constraint missions_urgency_check CHECK ((urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public.missions add constraint missions_purchases_estimate_check CHECK (((purchases_estimate IS NULL) OR ((purchases_estimate > (0)::numeric) AND (purchases_estimate <= (999999999)::numeric) AND (purchases_estimate = trunc(purchases_estimate)))));
alter table public.missions add constraint missions_completion_declared_check CHECK (((completion_declared_at IS NULL) OR (status <> 'open'::text)));
alter table public.reviews add constraint reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.transactions add constraint transactions_amount_student_check CHECK ((amount_student >= (0)::numeric));
alter table public.transactions add constraint transactions_amount_total_check CHECK ((amount_total >= (0)::numeric));
alter table public.transactions add constraint transactions_commission_check CHECK ((commission >= (0)::numeric));
alter table public.transactions add constraint transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])));
alter table public.wallet_transactions add constraint wallet_transactions_amount_check CHECK ((amount > (0)::numeric));
alter table public.wallet_transactions add constraint wallet_transactions_type_check CHECK ((type = ANY (ARRAY['deposit'::text, 'reserve'::text, 'release'::text, 'commission'::text, 'refund'::text, 'withdrawal'::text])));
alter table public.applications add constraint applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])));
alter table public.applications add constraint applications_accepted_at_check CHECK (((accepted_at IS NULL) OR (status = 'accepted'::text)));
alter table public.messages add constraint messages_type_check CHECK ((type = ANY (ARRAY['text'::text, 'voice'::text, 'image'::text, 'location'::text])));
alter table public.profiles add constraint profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.student_profiles add constraint fk_student_profiles_profile FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
alter table public.student_profiles add constraint student_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.wallets add constraint wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.wallets add constraint wallets_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
alter table public.missions add constraint missions_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.missions add constraint missions_client_id_profiles_fkey FOREIGN KEY (client_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
alter table public.missions add constraint missions_selected_student_id_fkey FOREIGN KEY (selected_student_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.reviews add constraint reviews_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_reviewed_id_fkey FOREIGN KEY (reviewed_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_reviewer_id_profiles_fkey FOREIGN KEY (reviewer_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
alter table public.transactions add constraint transactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.transactions add constraint transactions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;
alter table public.transactions add constraint transactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.wallet_transactions add constraint wallet_transactions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE SET NULL;
alter table public.wallet_transactions add constraint wallet_transactions_reverses_id_fkey FOREIGN KEY (reverses_id) REFERENCES wallet_transactions(id);
alter table public.wallet_transactions add constraint wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.wallet_transactions add constraint wallet_transactions_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
alter table public.applications add constraint applications_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;
alter table public.applications add constraint applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_sender_id_profiles_fkey FOREIGN KEY (sender_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
alter table public.mission_completions add constraint mission_completions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_type_check CHECK ((type = ANY (ARRAY['application_received'::text, 'application_accepted'::text, 'application_rejected'::text, 'mission_cancelled'::text, 'payment_released'::text, 'review_received'::text, 'verification_approved'::text, 'verification_rejected'::text, 'verification_reset'::text, 'badge_revoked'::text, 'account_reactivated'::text, 'card_submitted'::text, 'message_received'::text, 'completion_declared'::text])));
alter table public.notifications add constraint notifications_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120)));
alter table public.notifications add constraint notifications_body_check CHECK ((char_length(body) <= 280));
alter table public.notifications add constraint notifications_dedupe_key_check CHECK (((char_length(dedupe_key) >= 1) AND (char_length(dedupe_key) <= 200)));
alter table public.notifications add constraint notifications_recipient_dedupe_key UNIQUE (recipient_id, dedupe_key);
alter table public.notifications add constraint notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- 5. INDEX (hors index portés par une contrainte)

CREATE UNIQUE INDEX applications_one_accepted_per_mission ON public.applications USING btree (mission_id) WHERE (status = 'accepted'::text);
CREATE INDEX idx_applications_mission_id ON public.applications USING btree (mission_id);
CREATE INDEX idx_applications_student_id ON public.applications USING btree (student_id);
CREATE INDEX idx_messages_created_at ON public.messages USING btree (mission_id, created_at);
CREATE INDEX idx_messages_mission_id ON public.messages USING btree (mission_id);
CREATE INDEX idx_missions_city ON public.missions USING btree (city);
CREATE INDEX idx_missions_client_id ON public.missions USING btree (client_id);
CREATE INDEX idx_missions_status ON public.missions USING btree (status);
CREATE INDEX idx_missions_status_city ON public.missions USING btree (status, city);
CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);
CREATE INDEX idx_reviews_reviewed_id ON public.reviews USING btree (reviewed_id);
CREATE INDEX idx_student_profiles_user_id ON public.student_profiles USING btree (user_id);
CREATE INDEX idx_transactions_mission_id ON public.transactions USING btree (mission_id);
CREATE INDEX idx_wallet_transactions_created_at ON public.wallet_transactions USING btree (user_id, created_at DESC);
CREATE INDEX idx_wallet_transactions_mission_id ON public.wallet_transactions USING btree (mission_id);
CREATE INDEX idx_wallet_transactions_type ON public.wallet_transactions USING btree (type);
CREATE INDEX idx_wallet_transactions_user_id ON public.wallet_transactions USING btree (user_id);
CREATE UNIQUE INDEX wallet_transactions_deposit_ext_ref_uniq ON public.wallet_transactions USING btree (fedapay_id) WHERE ((type = 'deposit'::text) AND (fedapay_id IS NOT NULL));
CREATE UNIQUE INDEX wallet_transactions_one_movement_per_mission ON public.wallet_transactions USING btree (user_id, mission_id, type) WHERE ((mission_id IS NOT NULL) AND (type = ANY (ARRAY['reserve'::text, 'release'::text, 'refund'::text, 'commission'::text])));
CREATE UNIQUE INDEX wallet_transactions_one_reversal_per_withdrawal ON public.wallet_transactions USING btree (reverses_id) WHERE (reverses_id IS NOT NULL);
CREATE INDEX idx_wallets_user_id ON public.wallets USING btree (user_id);

CREATE INDEX notifications_recipient_created_idx ON public.notifications USING btree (recipient_id, created_at DESC, id DESC);
CREATE INDEX notifications_recipient_unread_idx ON public.notifications USING btree (recipient_id, created_at DESC) WHERE (read_at IS NULL);

-- 6. FONCTIONS (propriétaire postgres ; SECURITY DEFINER et search_path dans la définition)

CREATE OR REPLACE FUNCTION public.applications_apply_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status   text;
  v_client   uuid;
  v_deadline date;
  v_today    date := (now() at time zone 'Africa/Porto-Novo')::date;
  v_role     text;
  v_suspend  boolean;
  v_verified boolean;
  v_until    date;
  v_reject   text;
  v_card     text;
begin
  if not public.edu_is_api_caller() then
    return new;
  end if;

  select m.status, m.client_id, m.deadline
    into v_status, v_client, v_deadline
  from public.missions m
  where m.id = new.mission_id;

  if not found or v_status is distinct from 'open' then
    raise exception 'Candidature refusee : la mission n''est pas ouverte.' using errcode = '42501';
  end if;

  if v_deadline is not null and v_deadline < v_today then
    raise exception 'Candidature refusee : l''echeance de la mission est depassee.' using errcode = '42501';
  end if;

  if new.status is distinct from 'pending' then
    raise exception 'Candidature refusee : le statut initial doit etre pending.' using errcode = '42501';
  end if;

  if v_client is not distinct from new.student_id then
    raise exception 'Candidature refusee : le client ne postule pas a sa propre mission.' using errcode = '42501';
  end if;

  if new.message is null
     or char_length(btrim(new.message)) < 1
     or char_length(btrim(new.message)) > 500
     or char_length(new.message) > 2000 then
    raise exception 'Candidature refusee : le message doit contenir de 1 a 500 caracteres.' using errcode = '42501';
  end if;

  select p.role, coalesce(p.is_suspended, false), coalesce(p.is_verified, false), p.verified_until, p.rejection_reason
    into v_role, v_suspend, v_verified, v_until, v_reject
  from public.profiles p
  where p.user_id = new.student_id;

  if not found or v_role is distinct from 'student' then
    raise exception 'Candidature refusee : seul un compte etudiant peut postuler.' using errcode = '42501';
  end if;

  if v_suspend then
    raise exception 'Candidature refusee : compte suspendu.' using errcode = '42501';
  end if;

  -- Regle D2
  if v_verified then
    if v_until is not null and v_until < v_today then
      raise exception 'Candidature refusee : le badge de verification a expire.' using errcode = '42501';
    end if;
  elsif v_reject is not null and v_reject <> '' then
    raise exception 'Candidature refusee : la carte etudiante a ete refusee.' using errcode = '42501';
  else
    select sp.card_url into v_card from public.student_profiles sp where sp.user_id = new.student_id;
    if v_card is null or v_card = '' then
      raise exception 'Candidature refusee : aucune carte etudiante envoyee.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.applications_apply_rules() from public, anon, authenticated, service_role;
grant execute on function public.applications_apply_rules() to service_role;

CREATE OR REPLACE FUNCTION public.check_verification_expiry()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.profiles
  set is_verified = false
  where is_verified = true
    and verified_until is not null
    and verified_until < current_date;
end;
$function$;

revoke all on function public.check_verification_expiry() from public, anon, authenticated, service_role;
grant execute on function public.check_verification_expiry() to service_role;

CREATE OR REPLACE FUNCTION public.edu_is_api_caller()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(nullif(current_setting('role', true), 'none'), session_user) in ('anon', 'authenticated');
$function$;

revoke all on function public.edu_is_api_caller() from public, anon, authenticated, service_role;
grant execute on function public.edu_is_api_caller() to public;
grant execute on function public.edu_is_api_caller() to anon;
grant execute on function public.edu_is_api_caller() to authenticated;
grant execute on function public.edu_is_api_caller() to service_role;

CREATE OR REPLACE FUNCTION public.enforce_metadata_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
begin
  select role into v_role from public.profiles where user_id = new.id;

  if v_role is null then
    v_role := coalesce(new.raw_user_meta_data->>'role', 'student');
    if v_role not in ('student', 'client') then
      v_role := 'student';
    end if;
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
                            || jsonb_build_object('role', v_role);
  return new;
end;
$function$;

revoke all on function public.enforce_metadata_role() from public, anon, authenticated, service_role;
grant execute on function public.enforce_metadata_role() to service_role;

CREATE OR REPLACE FUNCTION public.guard_application_accepted_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_interdit boolean;
begin
  -- Appelants qui n'ecrivent jamais la colonne : roles API (administrateur applicatif compris, son JWT est
  -- « authenticated ») et service_role, calcule comme dans edu_is_api_caller() (role effectif).
  v_interdit := public.edu_is_api_caller()
    or coalesce(nullif(current_setting('role', true), 'none'), session_user) = 'service_role';

  if tg_op = 'INSERT' then
    if new.accepted_at is not null then
      if v_interdit then
        raise exception 'La date de retention est reservee a la base.'
          using errcode = '42501';
      end if;
      return new; -- role hors API et hors service_role (import) : valeur conservee, le CHECK la valide
    end if;
    if new.status = 'accepted' then
      new.accepted_at := now();
    end if;
    return new;
  end if;

  -- UPDATE : valeur differente de la valeur actuelle
  if new.accepted_at is distinct from old.accepted_at then
    if v_interdit then
      raise exception 'La date de retention est reservee a la base.'
        using errcode = '42501';
    end if;
    return new; -- role hors API et hors service_role (reparation) : le CHECK valide
  end if;

  -- UPDATE : transitions automatiques, quel que soit le role
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  elsif new.status is distinct from 'accepted' then
    new.accepted_at := null;
  end if;
  -- sinon : statut « accepted » inchange, valeur conservee

  return new;
end;
$function$;

revoke all on function public.guard_application_accepted_at() from public, anon, authenticated, service_role;
grant execute on function public.guard_application_accepted_at() to service_role;

CREATE OR REPLACE FUNCTION public.guard_applications()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_status  text;
  v_client  uuid;
  v_student uuid;
begin
  if current_user not in ('authenticated', 'anon') or (select public.is_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select m.status, m.client_id
    into v_status, v_client
    from public.missions m
    where m.id = new.mission_id;

    if new.status is distinct from 'pending'
       or v_status is distinct from 'open'
       or v_client is not distinct from new.student_id
       or not exists (
         select 1
         from public.profiles p
         where p.user_id = new.student_id
           and p.role = 'student'
       ) then
      raise exception 'Candidature refusee : mission ouverte, statut pending, candidat etudiant different du client requis.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.mission_id is distinct from old.mission_id
     or new.student_id is distinct from old.student_id
     or new.message is distinct from old.message then
    raise exception 'La mission, le candidat et le message d''une candidature ne sont pas modifiables.'
      using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Seul le client proprietaire change le statut. Le verrou de la mission serialise deux
  -- acceptations simultanees (la RLS ne laisse verrouiller que la mission du client).
  select m.status, m.client_id, m.selected_student_id
  into v_status, v_client, v_student
  from public.missions m
  where m.id = old.mission_id
  for update;

  if not found or (select auth.uid()) is distinct from v_client then
    raise exception 'Seul le client de la mission peut modifier le statut d''une candidature.'
      using errcode = '42501';
  end if;

  if old.status = 'pending' and new.status = 'accepted' then
    if v_status is distinct from 'open'
       or exists (
         select 1
         from public.applications a
         where a.mission_id = old.mission_id
           and a.id <> old.id
           and a.status = 'accepted'
       ) then
      raise exception 'Acceptation refusee : la mission doit etre ouverte et sans autre candidature acceptee.'
        using errcode = '42501';
    end if;
  elsif old.status = 'pending' and new.status = 'rejected' then
    null;
  elsif old.status = 'accepted' and new.status = 'pending' then
    -- Compensation : l'acceptation n'est annulable que tant que la mission n'est pas partie
    if v_status is distinct from 'open' or v_student is not null then
      raise exception 'Une candidature acceptee d''une mission en cours ne peut plus etre remise en attente.'
        using errcode = '42501';
    end if;
  else
    raise exception 'Transition de statut de candidature refusee (% vers %).', old.status, new.status
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_applications() from public, anon, authenticated, service_role;
grant execute on function public.guard_applications() to service_role;

CREATE OR REPLACE FUNCTION public.guard_mission_completion_declared()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.completion_declared_at is not null then
      raise exception 'La declaration de fin est reservee au serveur.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.completion_declared_at is not distinct from old.completion_declared_at then
    return new;
  end if;

  -- Roles API (anon, authenticated), administrateur applicatif compris : jamais.
  if public.edu_is_api_caller() then
    raise exception 'La declaration de fin est reservee au serveur.'
      using errcode = '42501';
  end if;

  -- Autres roles (service role, SQL) : seulement sur une mission en cours avec un etudiant retenu,
  -- sans changement de statut dans la meme ecriture.
  if old.status is distinct from 'in_progress'
     or new.status is distinct from 'in_progress'
     or new.selected_student_id is null then
    raise exception 'La declaration de fin n''est possible que sur une mission en cours avec un etudiant retenu.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_mission_completion_declared() from public, anon, authenticated, service_role;
grant execute on function public.guard_mission_completion_declared() to service_role;

CREATE OR REPLACE FUNCTION public.guard_missions()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_left numeric;
  v_api  boolean := current_user in ('authenticated', 'anon');
begin
  -- ---------------------------------------------------------------------------
  -- Regles d'integrite financiere : TOUS les roles (service role, admin et SQL compris)
  -- ---------------------------------------------------------------------------
  if tg_op = 'DELETE' then
    -- Une mission portant un mouvement du portefeuille ne se supprime pas (la cle etrangere
    -- est ON DELETE SET NULL : les fonds seraient bloques). Exception : suppression en
    -- cascade d'un compte (le client n'existe deja plus dans auth.users, ses mouvements
    -- disparaissent aussi).
    if exists (select 1 from public.wallet_transactions t where t.mission_id = old.id) then
      if v_api then
        raise exception 'Une mission dont les fonds ont ete reserves ne peut pas etre supprimee.'
          using errcode = '42501';
      elsif public.mission_client_exists(old.client_id) then
        raise exception 'Une mission dont les fonds ont ete reserves ne peut pas etre supprimee.'
          using errcode = '42501';
      end if;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('cancelled', 'done') then
    -- Fonds encore reserves pour la mission (meme formule que wallet_mission_reserved_left)
    select coalesce(sum(
      case t.type
        when 'reserve' then t.amount
        when 'refund'  then -t.amount
        when 'release' then -t.amount
        else 0
      end
    ), 0)
    into v_left
    from public.wallet_transactions t
    where t.user_id = new.client_id
      and t.mission_id = new.id
      and t.type in ('reserve', 'refund', 'release');

    if v_left <> 0 then
      raise exception 'Des fonds sont encore reserves pour cette mission : remboursement ou liberation requis avant ce statut.'
        using errcode = '42501';
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- Regles de transition : roles API non admin seulement (le service role, le SQL et
  -- les fonctions SECURITY DEFINER les contournent)
  -- ---------------------------------------------------------------------------
  if not v_api or (select public.is_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'open'
       or new.selected_student_id is not null
       or new.budget is null
       or new.budget <= 0 then
      raise exception 'Creation de mission refusee : statut open, aucun etudiant retenu et budget positif requis.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.client_id is distinct from old.client_id
     or new.budget is distinct from old.budget then
    raise exception 'Le proprietaire et le budget d''une mission ne sont pas modifiables.'
      using errcode = '42501';
  end if;

  if new.purchases_estimate is distinct from old.purchases_estimate
     and (old.status <> 'open' or new.status <> 'open') then
    raise exception 'L''estimation des achats n''est plus modifiable une fois la mission demarree.'
      using errcode = '42501';
  end if;

  if new.selected_student_id is distinct from old.selected_student_id then
    if old.selected_student_id is not null
       or new.selected_student_id is null
       or not exists (
         select 1
         from public.applications a
         where a.mission_id = new.id
           and a.student_id = new.selected_student_id
           and a.status = 'accepted'
       ) then
      raise exception 'L''etudiant retenu doit etre un candidat accepte de cette mission.'
        using errcode = '42501';
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'in_progress' and new.status = 'cancelled' then
      raise exception 'L''annulation d''une mission en cours est reservee a l''administration.'
        using errcode = '42501';
    end if;

    if not (
         (old.status = 'open'        and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status = 'done')
    ) then
      raise exception 'Transition de statut de mission refusee (% vers %).', old.status, new.status
        using errcode = '42501';
    end if;

    if new.status in ('in_progress', 'done') and new.selected_student_id is null then
      raise exception 'Un etudiant retenu est requis pour ce statut.'
        using errcode = '42501';
    end if;

    -- Une mission ne demarre que si ses fonds sont reserves (un etudiant ne travaille pas
    -- sur une mission non financee)
    if old.status = 'open' and new.status = 'in_progress' then
      select coalesce(sum(
        case t.type
          when 'reserve' then t.amount
          when 'refund'  then -t.amount
          when 'release' then -t.amount
          else 0
        end
      ), 0)
      into v_left
      from public.wallet_transactions t
      where t.user_id = new.client_id
        and t.mission_id = new.id
        and t.type in ('reserve', 'refund', 'release');

      if v_left <= 0 then
        raise exception 'Les fonds de la mission doivent etre reserves avant de la demarrer.'
          using errcode = '42501';
      end if;
    end if;

    if new.status = 'done' and not exists (
         select 1
         from public.wallet_transactions t
         where t.mission_id = new.id
           and t.user_id = new.client_id
           and t.type = 'release'
       ) then
      raise exception 'Les fonds doivent etre liberes avant de terminer la mission.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_missions() from public, anon, authenticated, service_role;
grant execute on function public.guard_missions() to service_role;

CREATE OR REPLACE FUNCTION public.guard_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    -- Double verrou : l'API n'a deja ni privilege ni politique INSERT.
    if public.edu_is_api_caller() then
      raise exception 'Une notification ne peut pas etre creee par ce role.'
        using errcode = '42501';
    end if;
    if new.read_at is not null then
      raise exception 'Une notification est creee non lue.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE, tous roles : seule read_at peut changer. Exception : actor_id peut devenir null
  -- (cle etrangere ON DELETE SET NULL, suppression du compte de l'acteur) ; il ne prend jamais de valeur.
  if new.id is distinct from old.id
     or new.recipient_id is distinct from old.recipient_id
     or new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.mission_id is distinct from old.mission_id
     or (new.actor_id is distinct from old.actor_id and new.actor_id is not null)
     or new.dedupe_key is distinct from old.dedupe_key
     or new.created_at is distinct from old.created_at then
    raise exception 'Seule la date de lecture d''une notification peut etre modifiee.'
      using errcode = '42501';
  end if;

  -- Une fois lue, la date de lecture ne change plus (jamais de retour a null).
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'La date de lecture d''une notification ne peut plus etre modifiee.'
      using errcode = '42501';
  end if;

  -- Appelant API : la date est celle du serveur, jamais une date fournie.
  if old.read_at is null and new.read_at is not null and public.edu_is_api_caller() then
    new.read_at := now();
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_notifications() from public, anon, authenticated, service_role;
grant execute on function public.guard_notifications() to service_role;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if current_user in ('authenticated', 'anon') and not (select public.is_admin()) then
    if new.role is distinct from old.role
       or new.user_id is distinct from old.user_id
       or new.is_suspended is distinct from old.is_suspended
       or new.rating is distinct from old.rating
       or new.missions_done is distinct from old.missions_done
       -- is_verified : seul true -> false est permis
       or (new.is_verified is distinct from old.is_verified
           and not (old.is_verified = true and new.is_verified = false))
       -- rejection_reason : seul le retrait (-> null) est permis, et seulement
       -- si le compte n'est pas (ou plus) verifie dans la meme requete
       or (new.rejection_reason is distinct from old.rejection_reason
           and (new.rejection_reason is not null or new.is_verified is distinct from false))
       -- verified_until : idem, jamais null sur un compte qui reste verifie
       or (new.verified_until is distinct from old.verified_until
           and (new.verified_until is not null or new.is_verified is distinct from false)) then
      raise exception 'Modification de colonne protegee refusee (role, verification, suspension, note).'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_profile_sensitive_columns() from public, anon, authenticated, service_role;
grant execute on function public.guard_profile_sensitive_columns() to service_role;

CREATE OR REPLACE FUNCTION public.handle_mission_done()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_inserted int;
begin
  if new.status = 'done' and old.status != 'done' and new.selected_student_id is not null then
    insert into public.mission_completions (mission_id, student_id)
    values (new.id, new.selected_student_id)
    on conflict (mission_id) do nothing;

    get diagnostics v_inserted = row_count;

    if v_inserted = 1 then
      update public.profiles
      set missions_done = missions_done + 1
      where user_id = new.selected_student_id;
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.handle_mission_done() from public, anon, authenticated, service_role;
grant execute on function public.handle_mission_done() to service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'student');

  if v_role not in ('student', 'client') then
    v_role := 'student';
  end if;

  insert into public.profiles (user_id, role, is_verified, is_suspended, rating, missions_done)
  values (new.id, v_role, false, false, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to service_role;

CREATE OR REPLACE FUNCTION public.handle_new_wallet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.wallets (user_id, balance, reserved)
  values (new.user_id, 0, 0)
  on conflict (user_id) do nothing;
  return new;
exception
  when others then
    raise log 'Erreur handle_new_wallet pour %: %', new.user_id, sqlerrm;
    return new;
end;
$function$;

revoke all on function public.handle_new_wallet() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_wallet() to service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$function$;

revoke all on function public.is_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

CREATE OR REPLACE FUNCTION public.messages_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_client   uuid;
  v_selected uuid;
  v_student  uuid;
  v_ok       boolean;
begin
  if not public.edu_is_api_caller() then
    return new;
  end if;

  if new.mission_id is null or new.sender_id is null or new.receiver_id is null
     or new.sender_id = new.receiver_id then
    raise exception 'Message refuse : mission, expediteur et destinataire distincts requis.' using errcode = '42501';
  end if;

  select m.client_id, m.selected_student_id
    into v_client, v_selected
  from public.missions m
  where m.id = new.mission_id;

  if not found then
    raise exception 'Message refuse : mission introuvable.' using errcode = '42501';
  end if;

  -- La paire doit etre {client de la mission, etudiant candidat ou retenu}
  if new.sender_id = v_client then
    v_student := new.receiver_id;
  elsif new.receiver_id = v_client then
    v_student := new.sender_id;
  else
    raise exception 'Message refuse : le client de la mission doit etre l''une des deux parties.' using errcode = '42501';
  end if;

  v_ok := v_student is not distinct from v_selected
          or exists (select 1 from public.applications a
                     where a.mission_id = new.mission_id and a.student_id = v_student);
  if not v_ok then
    raise exception 'Message refuse : l''etudiant n''est ni candidat ni retenu pour cette mission.' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles p where p.user_id = new.sender_id and p.is_suspended is true) then
    raise exception 'Message refuse : compte suspendu.' using errcode = '42501';
  end if;

  if new.content is not null and char_length(new.content) > 4000 then
    raise exception 'Message refuse : contenu trop long (4000 caracteres au plus).' using errcode = '42501';
  end if;

  if new.media_url is not null
     and position('/message-media/' || new.sender_id::text || '/' in new.media_url) = 0 then
    raise exception 'Message refuse : la piece jointe doit se trouver dans le dossier de l''expediteur.' using errcode = '42501';
  end if;

  if (new.location_lat is not null and new.location_lat not between -90 and 90)
     or (new.location_lng is not null and new.location_lng not between -180 and 180) then
    raise exception 'Message refuse : coordonnees invalides.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.messages_rules() from public, anon, authenticated, service_role;
grant execute on function public.messages_rules() to service_role;

CREATE OR REPLACE FUNCTION public.mission_client_exists(p_client uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from auth.users u where u.id = p_client);
$function$;

revoke all on function public.mission_client_exists(p_client uuid) from public, anon, authenticated, service_role;
grant execute on function public.mission_client_exists(p_client uuid) to service_role;

CREATE OR REPLACE FUNCTION public.recompute_profile_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_rating_for(new.reviewed_id);
  end if;
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and old.reviewed_id is distinct from new.reviewed_id) then
    perform public.recompute_rating_for(old.reviewed_id);
  end if;
  return null;
end;
$function$;

revoke all on function public.recompute_profile_rating() from public, anon, authenticated, service_role;
grant execute on function public.recompute_profile_rating() to service_role;

CREATE OR REPLACE FUNCTION public.recompute_rating_for(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform 1 from public.profiles where user_id = p_user_id for update;

  update public.profiles
  set rating = coalesce(
    (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.reviewed_id = p_user_id),
    0
  )
  where user_id = p_user_id;
end;
$function$;

revoke all on function public.recompute_rating_for(p_user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.recompute_rating_for(p_user_id uuid) to service_role;

CREATE OR REPLACE FUNCTION public.reviews_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status  text;
  v_client  uuid;
  v_student uuid;
begin
  if not public.edu_is_api_caller() then
    return new;
  end if;

  select m.status, m.client_id, m.selected_student_id
    into v_status, v_client, v_student
  from public.missions m
  where m.id = new.mission_id;

  if not found or v_status is distinct from 'done' or v_student is null then
    raise exception 'Avis refuse : la mission doit etre terminee.' using errcode = '42501';
  end if;

  if new.reviewer_id is not distinct from new.reviewed_id
     or not (
          (new.reviewer_id = v_client  and new.reviewed_id = v_student)
       or (new.reviewer_id = v_student and new.reviewed_id = v_client)
     ) then
    raise exception 'Avis refuse : seuls le client et l''etudiant retenu de cette mission peuvent s''evaluer.'
      using errcode = '42501';
  end if;

  if new.comment is not null and char_length(new.comment) > 2000 then
    raise exception 'Avis refuse : commentaire trop long (2000 caracteres au plus).' using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.reviews_rules() from public, anon, authenticated, service_role;
grant execute on function public.reviews_rules() to service_role;

CREATE OR REPLACE FUNCTION public.student_profiles_card_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reset_pending constant boolean := true;   -- decision D-43
begin
  if not public.edu_is_api_caller() then
    return new;
  end if;

  if new.card_url is null then
    return new;
  end if;

  if char_length(new.card_url) > 300
     or new.card_url like '%..%'
     or new.card_url !~ ('^' || new.user_id::text || '/[A-Za-z0-9._ -]+(/[A-Za-z0-9._ -]+)*$') then
    raise exception 'Carte refusee : le chemin doit se trouver dans le dossier de l''utilisateur.' using errcode = '42501';
  end if;

  if v_reset_pending then
    update public.profiles
       set is_verified = false,
           rejection_reason = null,
           verification_submitted_at = now()
     where user_id = new.user_id;
  end if;

  return new;
end;
$function$;

revoke all on function public.student_profiles_card_guard() from public, anon, authenticated, service_role;
grant execute on function public.student_profiles_card_guard() to service_role;

CREATE OR REPLACE FUNCTION public.sync_role_to_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.role = new.role then
    return new;
  end if;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                           || jsonb_build_object('role', new.role)
  where id = new.user_id;

  return new;
end;
$function$;

revoke all on function public.sync_role_to_auth() from public, anon, authenticated, service_role;
grant execute on function public.sync_role_to_auth() to service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

revoke all on function public.update_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.update_updated_at() to service_role;

CREATE OR REPLACE FUNCTION public.wallet_cancel_mission(p_mission_id uuid, p_client_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid     uuid := auth.uid();
  v_is_user boolean := auth.uid() is not null or coalesce(auth.role(), '') in ('authenticated', 'anon');
  v_client  uuid;
  v_mission public.missions%rowtype;
  v_wallet  public.wallets%rowtype;
  v_left    numeric;
begin
  if p_mission_id is null then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if v_is_user then
    if v_uid is null or (p_client_id is not null and p_client_id is distinct from v_uid) then
      return jsonb_build_object('success', false, 'error', 'forbidden');
    end if;
    v_client := v_uid;
  else
    if p_client_id is null then
      return jsonb_build_object('success', false, 'error', 'forbidden');
    end if;
    v_client := p_client_id;
  end if;

  -- Verrou de la mission : serialise avec reserve / release / refund / acceptation
  select * into v_mission from public.missions where id = p_mission_id for update;

  if not found or v_mission.client_id is distinct from v_client then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if v_mission.status is distinct from 'open' then
    return jsonb_build_object('success', false, 'error', 'invalid_status');
  end if;

  v_left := public.wallet_mission_reserved_left(v_client, p_mission_id);

  if v_left < 0 then
    return jsonb_build_object('success', false, 'error', 'inconsistent_funds');
  end if;

  if v_left > 0 then
    select * into v_wallet from public.wallets where user_id = v_client for update;

    if not found then
      return jsonb_build_object('success', false, 'error', 'wallet_not_found');
    end if;

    insert into public.wallet_transactions
      (user_id, type, amount, balance_before, balance_after, mission_id, note)
    values
      (v_client, 'refund', v_left,
       v_wallet.balance - v_wallet.reserved,
       v_wallet.balance - v_wallet.reserved + v_left,
       p_mission_id, 'Remboursement - mission annulée');

    update public.wallets
    set reserved = reserved - v_left,
        updated_at = now()
    where user_id = v_client;
  end if;

  update public.missions set status = 'cancelled' where id = p_mission_id;

  return jsonb_build_object('success', true, 'refunded', v_left);
end;
$function$;

revoke all on function public.wallet_cancel_mission(p_mission_id uuid, p_client_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.wallet_cancel_mission(p_mission_id uuid, p_client_id uuid) to service_role;

CREATE OR REPLACE FUNCTION public.wallet_deposit(p_user_id uuid, p_amount numeric, p_fedapay_id text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_wallet   public.wallets%rowtype;
  v_existing public.wallet_transactions%rowtype;
  v_tx_id    uuid;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    return json_build_object('success', false, 'error', 'Montant invalide', 'code', 'invalid_amount');
  end if;

  if p_fedapay_id is null or btrim(p_fedapay_id) = '' then
    return json_build_object('success', false, 'error', 'Identifiant de paiement manquant', 'code', 'missing_payment_id');
  end if;

  -- Verrouille le portefeuille : deux livraisons simultanees du meme paiement se serialisent
  select * into v_wallet
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'Portefeuille introuvable', 'code', 'wallet_not_found');
  end if;

  -- Rejeu : ce paiement a deja credite un portefeuille
  select * into v_existing
  from public.wallet_transactions
  where type = 'deposit' and fedapay_id = p_fedapay_id
  limit 1;

  if found then
    if v_existing.user_id = p_user_id and v_existing.amount = p_amount then
      return json_build_object(
        'success', true,
        'already_processed', true,
        'new_balance', v_wallet.balance,
        'transaction_id', v_existing.id
      );
    end if;
    raise log 'wallet_deposit: payment_id_conflict, fedapay_id %, utilisateur demande %, utilisateur existant %, appelant % (role %)',
      p_fedapay_id, p_user_id, v_existing.user_id, session_user, auth.role();
    return json_build_object('success', false, 'error', 'Identifiant de paiement déjà utilisé', 'code', 'payment_id_conflict');
  end if;

  begin
    insert into public.wallet_transactions
      (user_id, type, amount, balance_before, balance_after, fedapay_id, note)
    values
      (p_user_id, 'deposit', p_amount,
       v_wallet.balance, v_wallet.balance + p_amount,
       p_fedapay_id, 'Recharge via Mobile Money')
    returning id into v_tx_id;
  exception when unique_violation then
    -- Filet de securite (index unique) : le paiement a ete traite entre-temps par un autre appel
    return json_build_object('success', false, 'error', 'Identifiant de paiement déjà utilisé', 'code', 'payment_id_conflict');
  end;

  update public.wallets
  set balance = balance + p_amount, updated_at = now()
  where user_id = p_user_id;

  return json_build_object(
    'success', true,
    'already_processed', false,
    'new_balance', v_wallet.balance + p_amount,
    'transaction_id', v_tx_id
  );
end;
$function$;

revoke all on function public.wallet_deposit(p_user_id uuid, p_amount numeric, p_fedapay_id text) from public, anon, authenticated, service_role;
grant execute on function public.wallet_deposit(p_user_id uuid, p_amount numeric, p_fedapay_id text) to service_role;

CREATE OR REPLACE FUNCTION public.wallet_mission_reserved_left(p_client_id uuid, p_mission_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(sum(
    case type
      when 'reserve' then amount
      when 'refund'  then -amount
      when 'release' then -amount
      else 0
    end
  ), 0)
  from public.wallet_transactions
  where user_id = p_client_id
    and mission_id = p_mission_id
    and type in ('reserve', 'refund', 'release');
$function$;

revoke all on function public.wallet_mission_reserved_left(p_client_id uuid, p_mission_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.wallet_mission_reserved_left(p_client_id uuid, p_mission_id uuid) to service_role;

CREATE OR REPLACE FUNCTION public.wallet_refund(p_client_id uuid, p_mission_id uuid, p_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_wallet  public.wallets%rowtype;
  v_mission public.missions%rowtype;
  v_left    numeric;
  v_is_user boolean := auth.uid() is not null or coalesce(auth.role(), '') in ('authenticated', 'anon');
begin
  if p_client_id is null or p_mission_id is null or p_amount is null then
    return json_build_object('success', false, 'error', 'Operation non autorisee');
  end if;

  -- Verrou de la mission (pour tous les appelants)
  select * into v_mission from public.missions where id = p_mission_id for update;

  if not found
     or v_mission.client_id is distinct from p_client_id
     or v_mission.status not in ('open', 'in_progress', 'cancelled') then
    return json_build_object('success', false, 'error', 'Operation non autorisee');
  end if;

  if v_is_user and (auth.uid() is distinct from v_mission.client_id
                    or v_mission.status is distinct from 'open') then
    return json_build_object('success', false, 'error', 'Operation non autorisee');
  end if;

  v_left := public.wallet_mission_reserved_left(p_client_id, p_mission_id);

  if v_left <= 0 or p_amount <> v_left then
    return json_build_object('success', false, 'error', 'Montant incoherent avec les fonds reserves');
  end if;

  select * into v_wallet
  from public.wallets where user_id = p_client_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'Portefeuille introuvable');
  end if;

  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, mission_id, note)
  values
    (p_client_id, 'refund', p_amount,
     v_wallet.balance - v_wallet.reserved,
     v_wallet.balance - v_wallet.reserved + p_amount,
     p_mission_id, 'Remboursement - mission annulée');

  update public.wallets
  set reserved = reserved - p_amount,
      updated_at = now()
  where user_id = p_client_id;

  return json_build_object('success', true, 'refunded', p_amount);
end;
$function$;

revoke all on function public.wallet_refund(p_client_id uuid, p_mission_id uuid, p_amount numeric) from public, anon, authenticated, service_role;
grant execute on function public.wallet_refund(p_client_id uuid, p_mission_id uuid, p_amount numeric) to service_role;

CREATE OR REPLACE FUNCTION public.wallet_release(p_client_id uuid, p_student_id uuid, p_mission_id uuid, p_amount_total numeric, p_commission_rate numeric DEFAULT 0.12)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- Taux de commission fixe, impose a TOUS les appelants (service role compris)
  c_rate           constant numeric := 0.12;
  v_commission     numeric;
  v_net_student    numeric;
  v_client_wallet  public.wallets%rowtype;
  v_student_wallet public.wallets%rowtype;
  v_mission        public.missions%rowtype;
  v_left           numeric;
  v_is_user        boolean := auth.uid() is not null or coalesce(auth.role(), '') in ('authenticated', 'anon');
begin
  if p_client_id is null or p_student_id is null or p_mission_id is null or p_amount_total is null then
    return json_build_object('success', false, 'error', 'Operation non autorisee');
  end if;

  -- Un client ne se paie pas lui-meme
  if p_client_id = p_student_id then
    return json_build_object('success', false, 'error', 'Operation non autorisee');
  end if;

  -- Verrou de la mission (pour tous les appelants)
  select * into v_mission from public.missions where id = p_mission_id for update;

  if not found
     or v_mission.client_id is distinct from p_client_id
     or v_mission.selected_student_id is distinct from p_student_id
     or v_mission.status is distinct from 'in_progress' then
    return json_build_object('success', false, 'error', 'Operation non autorisee');
  end if;

  -- Utilisateur connecte : proprietaire de la mission uniquement
  if v_is_user and auth.uid() is distinct from v_mission.client_id then
    return json_build_object('success', false, 'error', 'Operation non autorisee');
  end if;

  -- Taux fixe pour tous les appelants (la signature garde le parametre, valeur 0.12 exigee)
  if p_commission_rate is distinct from c_rate then
    return json_build_object('success', false, 'error', 'Taux de commission invalide');
  end if;

  -- Le montant doit etre exactement ce qui est encore reserve pour cette mission
  v_left := public.wallet_mission_reserved_left(p_client_id, p_mission_id);

  if v_left <= 0 or p_amount_total <> v_left then
    return json_build_object('success', false, 'error', 'Montant incoherent avec les fonds reserves');
  end if;

  v_commission  := round(p_amount_total * c_rate, 0);
  v_net_student := p_amount_total - v_commission;

  if v_net_student <= 0 then
    return json_build_object('success', false, 'error', 'Taux de commission invalide');
  end if;

  -- Verrouille les deux portefeuilles dans un ordre fixe (evite l'interblocage entre
  -- deux paiements croises client A -> etudiant B et client B -> etudiant A)
  perform 1
  from public.wallets
  where user_id in (p_client_id, p_student_id)
  order by user_id
  for update;

  select * into v_client_wallet from public.wallets where user_id = p_client_id;

  if not found then
    return json_build_object('success', false, 'error', 'Portefeuille client introuvable');
  end if;

  select * into v_student_wallet from public.wallets where user_id = p_student_id;

  if not found then
    return json_build_object('success', false, 'error', 'Portefeuille étudiant introuvable');
  end if;

  -- Mouvement client : débloque le reserved
  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, mission_id, note)
  values
    (p_client_id, 'release', p_amount_total,
     v_client_wallet.balance - v_client_wallet.reserved,
     v_client_wallet.balance - v_client_wallet.reserved,
     p_mission_id, 'Mission terminée - fonds libérés');

  update public.wallets
  set reserved = reserved - p_amount_total,
      balance  = balance  - p_amount_total,
      updated_at = now()
  where user_id = p_client_id;

  -- Mouvement commission EduCash (trace dans wallet_transactions ; amount > 0 exige par contrainte)
  if v_commission > 0 then
    insert into public.wallet_transactions
      (user_id, type, amount, balance_before, balance_after, mission_id, note)
    values
      (p_client_id, 'commission', v_commission,
       0, 0,
       p_mission_id, 'Commission EduCash 12%');
  end if;

  -- Crédite l'étudiant
  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, mission_id, note)
  values
    (p_student_id, 'release', v_net_student,
     v_student_wallet.balance, v_student_wallet.balance + v_net_student,
     p_mission_id, 'Paiement reçu - mission complétée');

  update public.wallets
  set balance = balance + v_net_student, updated_at = now()
  where user_id = p_student_id;

  return json_build_object(
    'success', true,
    'amount_student', v_net_student,
    'commission', v_commission
  );
end;
$function$;

revoke all on function public.wallet_release(p_client_id uuid, p_student_id uuid, p_mission_id uuid, p_amount_total numeric, p_commission_rate numeric) from public, anon, authenticated, service_role;
grant execute on function public.wallet_release(p_client_id uuid, p_student_id uuid, p_mission_id uuid, p_amount_total numeric, p_commission_rate numeric) to service_role;

CREATE OR REPLACE FUNCTION public.wallet_reserve(p_user_id uuid, p_amount numeric, p_mission_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_wallet    public.wallets%rowtype;
  v_mission   public.missions%rowtype;
  v_available numeric;
  -- Appelant "utilisateur" : identifiant de session present, ou jeton authenticated / anon
  v_is_user   boolean := auth.uid() is not null or coalesce(auth.role(), '') in ('authenticated', 'anon');
begin
  if v_is_user and auth.uid() is distinct from p_user_id then
    return json_build_object('success', false, 'error', 'Operation non autorisee');
  end if;

  if p_user_id is null or p_mission_id is null or p_amount is null or p_amount <= 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;

  -- Verrou de la mission : serialise reserve / release / refund d'une meme mission
  select * into v_mission from public.missions where id = p_mission_id for update;

  if not found
     or v_mission.client_id is distinct from p_user_id
     or v_mission.status is distinct from 'open'
     or v_mission.budget is distinct from p_amount then
    return json_build_object('success', false, 'error', 'Operation non autorisee');
  end if;

  -- Une mission ne peut etre reservee qu'une seule fois
  if exists (
    select 1 from public.wallet_transactions
    where user_id = p_user_id and mission_id = p_mission_id and type = 'reserve'
  ) then
    return json_build_object('success', false, 'error', 'Fonds deja reserves pour cette mission');
  end if;

  select * into v_wallet
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'Portefeuille introuvable');
  end if;

  v_available := v_wallet.balance - v_wallet.reserved;

  if v_available < p_amount then
    return json_build_object(
      'success', false,
      'error', 'Solde insuffisant',
      'available', v_available,
      'required', p_amount
    );
  end if;

  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, mission_id, note)
  values
    (p_user_id, 'reserve', p_amount,
     v_available, v_available - p_amount,
     p_mission_id, 'Fonds bloqués - mission publiée');

  update public.wallets
  set reserved = reserved + p_amount, updated_at = now()
  where user_id = p_user_id;

  return json_build_object(
    'success', true,
    'reserved', v_wallet.reserved + p_amount,
    'available', v_available - p_amount
  );
end;
$function$;

revoke all on function public.wallet_reserve(p_user_id uuid, p_amount numeric, p_mission_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.wallet_reserve(p_user_id uuid, p_amount numeric, p_mission_id uuid) to service_role;

CREATE OR REPLACE FUNCTION public.wallet_withdraw(p_user_id uuid, p_amount numeric, p_fedapay_id text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_delay_seconds constant integer := 120;
  v_min_amount    constant numeric := 2000;
  v_wallet        public.wallets%rowtype;
  v_available     numeric;
  v_last_at       timestamptz;
  v_wait          integer;
  v_tx_id         uuid;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    return json_build_object('success', false, 'error', 'Montant invalide', 'code', 'invalid_amount');
  end if;

  if p_amount < v_min_amount then
    return json_build_object('success', false, 'error', 'Montant minimum de retrait : 2 000 FCFA', 'code', 'below_minimum');
  end if;

  -- Verrouille le portefeuille : deux retraits simultanes se serialisent, le delai ne se contourne pas
  select * into v_wallet
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'Portefeuille introuvable', 'code', 'wallet_not_found');
  end if;

  -- Anti-enchainement : dernier retrait de moins de v_delay_seconds secondes, hors retraits recredites
  select max(t.created_at) into v_last_at
  from public.wallet_transactions t
  where t.user_id = p_user_id
    and t.type = 'withdrawal'
    and t.created_at > now() - (v_delay_seconds * interval '1 second')
    and not exists (select 1 from public.wallet_transactions r where r.reverses_id = t.id);

  if v_last_at is not null then
    v_wait := greatest(1, ceil(extract(epoch from (v_last_at + (v_delay_seconds * interval '1 second') - now())))::integer);
    return json_build_object(
      'success', false,
      'error', 'Un retrait vient d''être demandé. Réessayez dans quelques instants.',
      'code', 'withdraw_too_soon',
      'retry_after_seconds', v_wait
    );
  end if;

  v_available := v_wallet.balance - v_wallet.reserved;

  if v_available < p_amount then
    return json_build_object(
      'success', false,
      'error', 'Solde disponible insuffisant',
      'code', 'insufficient_funds',
      'available', v_available
    );
  end if;

  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, fedapay_id, note)
  values
    (p_user_id, 'withdrawal', p_amount,
     v_available, v_available - p_amount,
     p_fedapay_id, 'Retrait vers Mobile Money')
  returning id into v_tx_id;

  update public.wallets
  set balance = balance - p_amount, updated_at = now()
  where user_id = p_user_id;

  return json_build_object(
    'success', true,
    'withdrawn', p_amount,
    'new_balance', v_wallet.balance - p_amount,
    'transaction_id', v_tx_id
  );
end;
$function$;

revoke all on function public.wallet_withdraw(p_user_id uuid, p_amount numeric, p_fedapay_id text) from public, anon, authenticated, service_role;
grant execute on function public.wallet_withdraw(p_user_id uuid, p_amount numeric, p_fedapay_id text) to service_role;

CREATE OR REPLACE FUNCTION public.wallet_withdraw_reverse(p_transaction_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tx          public.wallet_transactions%rowtype;
  v_wallet      public.wallets%rowtype;
  v_existing_id uuid;
  v_available   numeric;
  v_new_id      uuid;
begin
  if p_transaction_id is null then
    return json_build_object('success', false, 'error', 'Mouvement introuvable', 'code', 'transaction_not_found');
  end if;

  select * into v_tx
  from public.wallet_transactions
  where id = p_transaction_id;

  if not found then
    return json_build_object('success', false, 'error', 'Mouvement introuvable', 'code', 'transaction_not_found');
  end if;

  if v_tx.type <> 'withdrawal' then
    return json_build_object('success', false, 'error', 'Seul un retrait peut être annulé', 'code', 'not_a_withdrawal');
  end if;

  -- Verrouille le portefeuille du retrait : serialise les recredits et les autres mouvements
  select * into v_wallet
  from public.wallets
  where user_id = v_tx.user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'Portefeuille introuvable', 'code', 'wallet_not_found');
  end if;

  select id into v_existing_id
  from public.wallet_transactions
  where reverses_id = p_transaction_id;

  if found then
    return json_build_object(
      'success', true,
      'already_reversed', true,
      'refunded', v_tx.amount,
      'new_balance', v_wallet.balance,
      'transaction_id', p_transaction_id,
      'reversal_transaction_id', v_existing_id
    );
  end if;

  v_available := v_wallet.balance - v_wallet.reserved;

  begin
    insert into public.wallet_transactions
      (user_id, type, amount, balance_before, balance_after, mission_id, note, reverses_id)
    values
      (v_tx.user_id, 'refund', v_tx.amount,
       v_available, v_available + v_tx.amount,
       null, 'Retrait annulé - virement non effectué', p_transaction_id)
    returning id into v_new_id;
  exception when unique_violation then
    -- Filet de securite (index unique) : deja compense par un appel concurrent
    select id into v_existing_id from public.wallet_transactions where reverses_id = p_transaction_id;
    return json_build_object(
      'success', true,
      'already_reversed', true,
      'refunded', v_tx.amount,
      'new_balance', v_wallet.balance,
      'transaction_id', p_transaction_id,
      'reversal_transaction_id', v_existing_id
    );
  end;

  update public.wallets
  set balance = balance + v_tx.amount, updated_at = now()
  where user_id = v_tx.user_id;

  raise log 'wallet_withdraw_reverse: retrait % (utilisateur %) recredite, appelant % (role %, auth.uid %), recredit %, motif : %',
    p_transaction_id, v_tx.user_id, session_user, auth.role(), coalesce(auth.uid()::text, 'aucun (service role)'), v_new_id,
    left(coalesce(p_reason, 'non precise'), 200);

  return json_build_object(
    'success', true,
    'already_reversed', false,
    'refunded', v_tx.amount,
    'new_balance', v_wallet.balance + v_tx.amount,
    'transaction_id', p_transaction_id,
    'reversal_transaction_id', v_new_id
  );
end;
$function$;

revoke all on function public.wallet_withdraw_reverse(p_transaction_id uuid, p_reason text) from public, anon, authenticated, service_role;
grant execute on function public.wallet_withdraw_reverse(p_transaction_id uuid, p_reason text) to service_role;

-- 7. TRIGGERS (public, plus les deux triggers posés sur auth.users)

CREATE TRIGGER applications_apply_rules BEFORE INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.applications_apply_rules();
CREATE TRIGGER guard_application_accepted_at BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.guard_application_accepted_at();
CREATE TRIGGER guard_applications BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.guard_applications();
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER messages_rules BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_rules();
CREATE TRIGGER guard_mission_completion_declared BEFORE INSERT OR UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.guard_mission_completion_declared();
CREATE TRIGGER guard_missions BEFORE INSERT OR DELETE OR UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.guard_missions();
CREATE TRIGGER trg_mission_done AFTER UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.handle_mission_done();
CREATE TRIGGER trg_missions_updated_at BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER guard_notifications BEFORE INSERT OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.guard_notifications();
CREATE TRIGGER guard_profile_sensitive_columns BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_columns();
CREATE TRIGGER on_profile_role_changed AFTER UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_auth();
CREATE TRIGGER trg_create_wallet_on_signup AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_new_wallet();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER recompute_profile_rating AFTER INSERT OR DELETE OR UPDATE OF rating, reviewed_id ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.recompute_profile_rating();
CREATE TRIGGER reviews_rules BEFORE INSERT OR UPDATE OF mission_id, reviewer_id, reviewed_id, rating, comment ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.reviews_rules();
CREATE TRIGGER student_profiles_card_guard BEFORE INSERT OR UPDATE OF card_url ON public.student_profiles FOR EACH ROW EXECUTE FUNCTION public.student_profiles_card_guard();
CREATE TRIGGER trg_student_profiles_updated_at BEFORE UPDATE ON public.student_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER enforce_metadata_role BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION public.enforce_metadata_role();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. RLS ET POLITIQUES

alter table public.applications enable row level security;
alter table public.messages enable row level security;
alter table public.mission_completions enable row level security;
alter table public.missions enable row level security;
alter table public.profiles enable row level security;
alter table public.reviews enable row level security;
alter table public.student_profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.universities enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallets enable row level security;

create policy applications_insert_student on public.applications as permissive for insert to public
  with check ((auth.uid() = student_id));

create policy applications_select on public.applications as permissive for select to public
  using (((auth.uid() = student_id) OR (auth.uid() IN ( SELECT missions.client_id
   FROM missions
  WHERE (missions.id = applications.mission_id)))));

create policy applications_update_client on public.applications as permissive for update to public
  using ((auth.uid() IN ( SELECT missions.client_id
   FROM missions
  WHERE (missions.id = applications.mission_id))));

create policy messages_insert on public.messages as permissive for insert to public
  with check ((auth.uid() = sender_id));

create policy messages_select on public.messages as permissive for select to public
  using (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));

create policy messages_update_read on public.messages as permissive for update to public
  using ((auth.uid() = receiver_id));

create policy missions_select_public on public.missions as permissive for select to public
  using (((status = 'open'::text) OR (client_id = auth.uid()) OR (selected_student_id = auth.uid())));

create policy missions_update_own on public.missions as permissive for update to public
  using ((auth.uid() = client_id));

create policy "Admin lit tous les profils" on public.profiles as permissive for select to public
  using ((( SELECT is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)));

create policy "Admin met à jour tous les profils" on public.profiles as permissive for update to public
  using (( SELECT is_admin() AS is_admin))
  with check (( SELECT is_admin() AS is_admin));

create policy "Utilisateur met à jour son propre profil" on public.profiles as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Utilisateur modifie son propre profil" on public.profiles as permissive for insert to public
  with check (((( SELECT auth.uid() AS uid) = user_id) AND (role = ANY (ARRAY['student'::text, 'client'::text])) AND (is_verified = false) AND (is_suspended = false) AND (verified_until IS NULL) AND (rejection_reason IS NULL) AND (rating = (0)::numeric) AND (missions_done = 0)));

create policy profiles_select_public on public.profiles as permissive for select to public
  using (true);

create policy "Auteur publie un avis" on public.reviews as permissive for insert to public
  with check (((( SELECT auth.uid() AS uid) = reviewer_id) AND (EXISTS ( SELECT 1
   FROM missions m
  WHERE ((m.id = reviews.mission_id) AND (m.status = 'done'::text) AND (m.selected_student_id IS NOT NULL) AND (((m.client_id = reviews.reviewer_id) AND (m.selected_student_id = reviews.reviewed_id)) OR ((m.selected_student_id = reviews.reviewer_id) AND (m.client_id = reviews.reviewed_id))))))));

create policy reviews_select_public on public.reviews as permissive for select to public
  using (true);

create policy "Admin lit tous les student_profiles" on public.student_profiles as permissive for select to public
  using ((( SELECT is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)));

create policy student_profiles_insert_own on public.student_profiles as permissive for insert to public
  with check ((auth.uid() = user_id));

create policy student_profiles_select_public on public.student_profiles as permissive for select to public
  using (true);

create policy student_profiles_update_own on public.student_profiles as permissive for update to public
  using ((auth.uid() = user_id));

create policy transactions_select on public.transactions as permissive for select to public
  using (((auth.uid() = client_id) OR (auth.uid() = student_id)));

create policy universities_select_public on public.universities as permissive for select to public
  using (true);

create policy wallet_transactions_select_own on public.wallet_transactions as permissive for select to public
  using ((auth.uid() = user_id));

create policy wallets_select_own on public.wallets as permissive for select to public
  using ((auth.uid() = user_id));

create policy "Admin lit toutes les cartes étudiantes" on storage.objects as permissive for select to public
  using (((bucket_id = 'student-cards'::text) AND ( SELECT is_admin() AS is_admin)));

create policy "Delete own message media" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'message-media'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy "Upload avatar" on storage.objects as permissive for insert to public
  with check (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (string_to_array(name, '/'::text))[1])));

create policy "Upload message media" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'message-media'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy avatars_public_read on storage.objects as permissive for select to public
  using ((bucket_id = 'avatars'::text));

create policy avatars_update_own on storage.objects as permissive for update to public
  using (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy message_media_select_participants on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'message-media'::text) AND (((( SELECT auth.uid() AS uid))::text = (storage.foldername(name))[1]) OR (EXISTS ( SELECT 1
   FROM messages m
  WHERE ((m.media_url IS NOT NULL) AND ("substring"(m.media_url, '/message-media/(.+)$'::text) = objects.name) AND (split_part(objects.name, '/'::text, 1) = (m.sender_id)::text) AND ((m.sender_id = ( SELECT auth.uid() AS uid)) OR (m.receiver_id = ( SELECT auth.uid() AS uid)))))))));

create policy "Étudiant gère sa carte" on storage.objects as permissive for all to public
  using (((bucket_id = 'student-cards'::text) AND ((auth.uid())::text = (string_to_array(name, '/'::text))[1])))
  with check (((bucket_id = 'student-cards'::text) AND ((auth.uid())::text = (string_to_array(name, '/'::text))[1])));

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications as permissive for select to authenticated
  using ((recipient_id = ( SELECT auth.uid() AS uid)));

create policy notifications_update_read_own on public.notifications as permissive for update to authenticated
  using ((recipient_id = ( SELECT auth.uid() AS uid)))
  with check ((recipient_id = ( SELECT auth.uid() AS uid)));

-- 9. PRIVILÈGES (anon, authenticated, service_role)
-- Le privilège MAINTAIN (PostgreSQL 17) est omis : sans effet sur l'accès aux données.

revoke all on table public.profiles from anon, authenticated, service_role;
grant INSERT, UPDATE on table public.profiles to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to service_role;
revoke all on table public.student_profiles from anon, authenticated, service_role;
grant INSERT, UPDATE on table public.student_profiles to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_profiles to service_role;
revoke all on table public.universities from anon, authenticated, service_role;
grant SELECT on table public.universities to anon;
grant SELECT on table public.universities to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.universities to service_role;
revoke all on table public.wallets from anon, authenticated, service_role;
grant SELECT on table public.wallets to anon;
grant SELECT on table public.wallets to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wallets to service_role;
revoke all on table public.missions from anon, authenticated, service_role;
grant SELECT on table public.missions to anon;
grant SELECT, UPDATE on table public.missions to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.missions to service_role;
revoke all on table public.reviews from anon, authenticated, service_role;
grant SELECT on table public.reviews to anon;
grant INSERT, SELECT, UPDATE on table public.reviews to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reviews to service_role;
revoke all on table public.transactions from anon, authenticated, service_role;
grant SELECT on table public.transactions to anon;
grant SELECT on table public.transactions to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.transactions to service_role;
revoke all on table public.wallet_transactions from anon, authenticated, service_role;
grant SELECT on table public.wallet_transactions to anon;
grant SELECT on table public.wallet_transactions to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wallet_transactions to service_role;
revoke all on table public.applications from anon, authenticated, service_role;
grant SELECT on table public.applications to anon;
grant INSERT, SELECT, UPDATE on table public.applications to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.applications to service_role;
revoke all on table public.messages from anon, authenticated, service_role;
grant SELECT on table public.messages to anon;
grant INSERT, SELECT on table public.messages to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.messages to service_role;
revoke all on table public.mission_completions from anon, authenticated, service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.mission_completions to service_role;

-- Privilèges par colonne (SELECT=r, INSERT=a, UPDATE=w)

grant update (read) on table public.messages to authenticated;
grant select (avatar_url) on table public.profiles to anon;
grant select (avatar_url) on table public.profiles to authenticated;
grant select (bio) on table public.profiles to anon;
grant select (bio) on table public.profiles to authenticated;
grant select (city) on table public.profiles to anon;
grant select (city) on table public.profiles to authenticated;
grant select (created_at) on table public.profiles to anon;
grant select (created_at) on table public.profiles to authenticated;
grant select (full_name) on table public.profiles to anon;
grant select (full_name) on table public.profiles to authenticated;
grant select (id) on table public.profiles to anon;
grant select (id) on table public.profiles to authenticated;
grant select (is_suspended) on table public.profiles to anon;
grant select (is_suspended) on table public.profiles to authenticated;
grant select (is_verified) on table public.profiles to anon;
grant select (is_verified) on table public.profiles to authenticated;
grant select (missions_done) on table public.profiles to anon;
grant select (missions_done) on table public.profiles to authenticated;
grant select (rating) on table public.profiles to anon;
grant select (rating) on table public.profiles to authenticated;
grant select (role) on table public.profiles to anon;
grant select (role) on table public.profiles to authenticated;
grant select (updated_at) on table public.profiles to anon;
grant select (updated_at) on table public.profiles to authenticated;
grant select (user_id) on table public.profiles to anon;
grant select (user_id) on table public.profiles to authenticated;
grant select (verified_until) on table public.profiles to anon;
grant select (verified_until) on table public.profiles to authenticated;
grant select (availability) on table public.student_profiles to anon;
grant select (availability) on table public.student_profiles to authenticated;
grant select (created_at) on table public.student_profiles to anon;
grant select (created_at) on table public.student_profiles to authenticated;
grant select (id) on table public.student_profiles to anon;
grant select (id) on table public.student_profiles to authenticated;
grant select (level) on table public.student_profiles to anon;
grant select (level) on table public.student_profiles to authenticated;
grant select (school) on table public.student_profiles to anon;
grant select (school) on table public.student_profiles to authenticated;
grant select (skills) on table public.student_profiles to anon;
grant select (skills) on table public.student_profiles to authenticated;
grant select (updated_at) on table public.student_profiles to anon;
grant select (updated_at) on table public.student_profiles to authenticated;
grant select (user_id) on table public.student_profiles to anon;
grant select (user_id) on table public.student_profiles to authenticated;

revoke all on table public.notifications from public, anon, authenticated, service_role;
grant SELECT on table public.notifications to authenticated;
grant UPDATE (read_at) on table public.notifications to authenticated;
grant DELETE, INSERT, SELECT, UPDATE on table public.notifications to service_role;

-- 10. BUCKETS (storage.buckets ; les politiques storage.objects sont en section 8)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-media', 'message-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'audio/*'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-cards', 'student-cards', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- 11. REALTIME

alter publication supabase_realtime add table public.messages;

-- 12. JOBS CRON
-- Aucun job pg_cron visible dans cron.job au 2026-10-14 (métadonnées seulement lues).

-- =============================================================================
-- OBJETS PROPRES À SUPABASE À ADAPTER POUR NEON
-- - auth.users : trigger on_auth_user_created (handle_new_user), trigger
--   enforce_metadata_role, fonction sync_role_to_auth (écrit dans auth.users),
--   clés étrangères user_id, client_id, etc. vers auth.users(id).
-- - auth.uid() : utilisé par la plupart des politiques RLS et des fonctions. Table notifications :
--   auth.uid() uniquement dans ses deux politiques ; la fonction de garde n'utilise que
--   edu_is_api_caller(), gen_random_uuid() est natif (PostgreSQL 13+), aucune clé vers auth.users.
-- - edu_is_api_caller() : point à adapter (détection de l'appelant API
--   par rôle PostgREST/JWT) ; les gardes et fonctions wallet en dépendent. Second point, propre à
--   Supabase : le littéral 'service_role' de guard_application_accepted_at (script 91), à regrouper
--   avec le premier dans une seule fonction à terme.
-- - storage.* : tables storage.buckets et storage.objects, politiques sur
--   storage.objects (avatars, message-media, student-cards, utilisent
--   storage.foldername()), triggers storage
--   gérés par Supabase (non repris ici).
-- - realtime : publication supabase_realtime (table public.messages ; notifications n'y est pas).
-- - rôles API : anon, authenticated, service_role et leurs GRANT/REVOKE.
-- - extensions : pg_cron (schéma pg_catalog), pg_net (public), supabase_vault
--   (vault), pg_stat_statements, uuid-ossp et pgcrypto (extensions).
-- - search_path : uuid_generate_v4(), REFERENCES profiles(user_id) et is_admin()
--   dans les politiques supposent le search_path par défaut de Supabase
--   (public, extensions).
--
-- ÉTAT APRÈS RD-SEC-03b
-- Ce fichier décrit l'état APRÈS application des scripts 60 (14 fonctions en
-- search_path vide) et 61 (code mort supprimé) en production, et 62 (bucket
-- message-media privé, appliqué après le déploiement du code d'URL signées).
-- Tant que le script 62 n'est pas appliqué, la production garde message-media
-- public.
--
-- DETTE CONNUE
-- - Politiques conservées volontairement bien que redondantes : "Admin lit tous
--   les profils" et "Admin lit tous les student_profiles" (englobées par les
--   politiques using (true)), "Admin lit toutes les cartes étudiantes"
--   (l'admin passe par le service role). Elles portent l'intention admin si la
--   lecture publique est resserrée un jour.
-- =============================================================================

commit;
