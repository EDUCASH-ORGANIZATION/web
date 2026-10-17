import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Script 96 de RD-CLOSE-01 appliqué en production le 2026-10-17 : supabase/schema.sql décrit l'état APRÈS le 96.
// Ce garde vérifie ce qui porte la sécurité : colonnes de cycle, CHECK d'ordre, garde d'irréversibilité,
// journal sans politique ni droit pour anon et authenticated, six clés étrangères en RESTRICT.
const SCHEMA = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8")
const lines = SCHEMA.split("\n")

const lineOf = (prefix) => {
  const found = lines.filter((l) => l.startsWith(prefix))
  expect(found, `ligne attendue une fois : ${prefix}`).toHaveLength(1)
  return found[0]
}

describe("schéma de référence : fermeture de compte (script 96)", () => {
  it("profiles porte les trois colonnes de cycle et le CHECK d'ordre", () => {
    const start = SCHEMA.indexOf("create table public.profiles (")
    const body = SCHEMA.slice(start, SCHEMA.indexOf("\n);", start))
    for (const col of ["closed_at timestamp with time zone", "pseudonymized_at timestamp with time zone", "closure_prev_suspended boolean"]) {
      expect(body).toContain(`  ${col}`)
    }
    expect(lineOf("alter table public.profiles add constraint profiles_closure_order_check ")).toBe(
      "alter table public.profiles add constraint profiles_closure_order_check CHECK (((pseudonymized_at IS NULL) OR (closed_at IS NOT NULL)));"
    )
  })

  it("la garde refuse la réouverture pour tous les rôles et protège les colonnes pour l'API", () => {
    const start = SCHEMA.indexOf("CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()")
    const body = SCHEMA.slice(start, SCHEMA.indexOf("$function$;", start + 60))
    expect(body.indexOf("old.pseudonymized_at is not null")).toBeGreaterThan(-1)
    expect(body.indexOf("old.pseudonymized_at is not null")).toBeLessThan(body.indexOf("current_user in ('authenticated', 'anon')"))
    for (const col of ["closed_at", "pseudonymized_at", "closure_prev_suspended"]) {
      expect(body).toContain(`new.${col} is distinct from old.${col}`)
    }
    // contrôles d'origine, toujours présents
    for (const control of [
      "new.role is distinct from old.role",
      "new.user_id is distinct from old.user_id",
      "new.is_suspended is distinct from old.is_suspended",
      "new.rating is distinct from old.rating",
      "new.missions_done is distinct from old.missions_done",
      "new.is_verified is distinct from old.is_verified",
      "new.rejection_reason is distinct from old.rejection_reason",
      "new.verified_until is distinct from old.verified_until",
    ]) {
      expect(body).toContain(control)
    }
  })

  it("le journal n'a ni politique ni droit pour anon et authenticated, service_role lit et insère seulement", () => {
    expect(SCHEMA).toContain("alter table public.account_closure_events enable row level security;")
    expect(SCHEMA).not.toMatch(/create policy [^\n]* on public\.account_closure_events/)
    expect(SCHEMA).toContain("revoke all on table public.account_closure_events from public, anon, authenticated, service_role;")
    expect(SCHEMA).toContain("grant INSERT, SELECT on table public.account_closure_events to service_role;")
    expect(SCHEMA).not.toMatch(/grant [^\n]* on table public\.account_closure_events to (anon|authenticated)/)
  })

  it("closed_at est lisible par anon et authenticated", () => {
    expect(SCHEMA).toContain("grant select (closed_at) on table public.profiles to anon;")
    expect(SCHEMA).toContain("grant select (closed_at) on table public.profiles to authenticated;")
    expect(SCHEMA).not.toMatch(/grant select \((pseudonymized_at|closure_prev_suspended)\)/)
  })

  it("six clés étrangères financières et d'achats sont en RESTRICT, ligne de contrainte complète", () => {
    const fk = (table, name, column, target) =>
      expect(lineOf(`alter table public.${table} add constraint ${name} `)).toBe(
        `alter table public.${table} add constraint ${name} FOREIGN KEY (${column}) REFERENCES ${target} ON DELETE RESTRICT;`
      )
    fk("transactions", "transactions_client_id_fkey", "client_id", "auth.users(id)")
    fk("transactions", "transactions_student_id_fkey", "student_id", "auth.users(id)")
    fk("wallet_transactions", "wallet_transactions_user_id_fkey", "user_id", "auth.users(id)")
    fk("wallet_transactions", "wallet_transactions_user_id_profiles_fkey", "user_id", "profiles(user_id)")
    fk("purchase_requests", "purchase_requests_client_id_fkey", "client_id", "public.profiles(user_id)")
    fk("purchase_requests", "purchase_requests_student_id_fkey", "student_id", "public.profiles(user_id)")
    fk("account_closure_events", "account_closure_events_user_id_fkey", "user_id", "public.profiles(user_id)")
  })
})
