import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// RD-ACCEPT-01 : le schéma de référence (supabase/schema.sql) décrit la colonne
// applications.accepted_at telle que le script 91 la crée. Ce garde vérifie les éléments qui portent la
// sécurité : colonne nullable sans défaut, CHECK « aucune date hors statut accepted », fonction de garde
// SECURITY INVOKER à search_path vide qui s'appuie sur edu_is_api_caller(), trigger BEFORE INSERT OR UPDATE
// placé avant guard_applications dans l'ordre alphabétique, aucune politique RLS nouvelle, et les en-têtes.
const SCHEMA = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8")
const lines = SCHEMA.split("\n")

function functionBody(name) {
  const start = SCHEMA.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`)
  expect(start, `fonction ${name} absente`).toBeGreaterThan(-1)
  const end = SCHEMA.indexOf("$function$;", SCHEMA.indexOf("$function$", start) + 1)
  expect(end).toBeGreaterThan(start)
  return SCHEMA.slice(start, end)
}

function applicationsTable() {
  const start = SCHEMA.indexOf("create table public.applications (")
  expect(start).toBeGreaterThan(-1)
  return SCHEMA.slice(start, SCHEMA.indexOf("\n);", start))
}

describe("schéma de référence : applications.accepted_at", () => {
  it("la colonne est un timestamptz nullable, sans défaut", () => {
    const col = applicationsTable()
      .split("\n")
      .find((l) => l.includes("accepted_at"))
    expect(col).toBeDefined()
    expect(col.trim()).toBe("accepted_at timestamp with time zone")
    expect(col).not.toMatch(/default|not null/i)
  })

  it("le CHECK interdit toute date hors statut accepted", () => {
    expect(SCHEMA).toContain(
      "alter table public.applications add constraint applications_accepted_at_check CHECK (((accepted_at IS NULL) OR (status = 'accepted'::text)));"
    )
  })

  it("les 3 statuts de candidature sont inchangés", () => {
    expect(SCHEMA).toContain(
      "alter table public.applications add constraint applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])));"
    )
  })

  it("la fonction de garde est SECURITY INVOKER, à search_path vide, et refuse les appelants API et service_role", () => {
    const body = functionBody("guard_application_accepted_at")
    expect(body).toContain("SET search_path TO ''")
    expect(body).not.toMatch(/security definer/i)
    expect(body).toContain("public.edu_is_api_caller()")
    expect(body).toContain("= 'service_role'")
    expect(body).toContain("errcode = '42501'")
    expect(body).toContain("new.accepted_at := now()")
    expect(body).toContain("new.accepted_at := null")
  })

  it("la fonction n'est exécutable que par service_role", () => {
    expect(SCHEMA).toContain(
      "revoke all on function public.guard_application_accepted_at() from public, anon, authenticated, service_role;"
    )
    const grants = lines.filter((l) => l.startsWith("grant execute on function public.guard_application_accepted_at()"))
    expect(grants).toEqual([
      "grant execute on function public.guard_application_accepted_at() to service_role;",
    ])
  })

  it("le trigger couvre INSERT et UPDATE, avant écriture", () => {
    expect(SCHEMA).toContain(
      "CREATE TRIGGER guard_application_accepted_at BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.guard_application_accepted_at();"
    )
  })

  it("les triggers d'applications sont les 4 attendus, dans l'ordre d'exécution alphabétique", () => {
    const names = lines
      .filter((l) => l.startsWith("CREATE TRIGGER") && l.includes(" ON public.applications "))
      .map((l) => l.match(/CREATE TRIGGER (\S+)/)[1])
    expect([...names].sort()).toEqual([
      "applications_apply_rules",
      "guard_application_accepted_at",
      "guard_applications",
      "trg_applications_updated_at",
    ])
    const sorted = [...names].sort()
    expect(sorted.indexOf("guard_application_accepted_at")).toBeLessThan(sorted.indexOf("guard_applications"))
    expect(sorted.indexOf("guard_applications")).toBeLessThan(sorted.indexOf("trg_applications_updated_at"))
  })

  it("aucune politique RLS nouvelle, aucun privilège de colonne, grants de table inchangés", () => {
    const policies = lines.filter((l) => l.startsWith("create policy") && l.includes("on public.applications"))
    expect(policies.map((l) => l.match(/create policy (\S+)/)[1])).toEqual([
      "applications_insert_student",
      "applications_select",
      "applications_update_client",
    ])
    const colGrants = lines.filter((l) => /^grant .*\(.*\) on table public\.applications/i.test(l))
    expect(colGrants).toEqual([])
    expect(SCHEMA).toContain("grant SELECT on table public.applications to anon;")
    expect(SCHEMA).toContain("grant INSERT, SELECT, UPDATE on table public.applications to authenticated;")
    expect(SCHEMA).toContain(
      "grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.applications to service_role;"
    )
  })

  it("guard_applications ne mentionne pas la date et aucun UPDATE de données ne la remplit", () => {
    expect(functionBody("guard_applications")).not.toContain("accepted_at")
    expect(SCHEMA).not.toMatch(/update\s+public\.applications\s+set\s+accepted_at/i)
  })

  it("l'en-tête signale les scripts 90 et 91 comme appliqués en production", () => {
    const head = SCHEMA.slice(0, 2200)
    expect(head).toContain("Script 91 de RD-ACCEPT-01 appliqué en production le 2026-10-16.")
    expect(SCHEMA).not.toContain("Script 91 (RD-ACCEPT-01) NON appliqué")
    expect(head).toContain("Script 90 de RD-DONE-01 appliqué en production le 2026-10-15.")
    expect(SCHEMA).not.toContain("Script 90 (RD-DONE-01) NON appliqué")
  })
})
