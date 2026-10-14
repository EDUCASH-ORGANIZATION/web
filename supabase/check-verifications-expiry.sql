-- OBSOLETE, NE PAS EXECUTER EN PRODUCTION (RD-SEC-03, 2026-10-14).
-- Motif : recrée check_verification_expiry en SECURITY DEFINER sans search_path (la production fixe search_path) ; le rejouer réintroduit une faille de résolution de noms et écrase la définition de production.
-- État de référence de la base : supabase/schema.sql (régénéré depuis la production).

-- ─────────────────────────────────────────────────────────────────────────────
-- Fonction SQL appelée par la Edge Function check-verifications-expiry
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.check_verification_expiry()
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set
    is_verified = false
  where
    is_verified  = true
    and verified_until is not null
    and verified_until < current_date;
end;
$$;

-- Accorde l'exécution au service role (appelé depuis la Edge Function)
grant execute on function public.check_verification_expiry() to service_role;
