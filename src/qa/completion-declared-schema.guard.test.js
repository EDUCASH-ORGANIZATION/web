import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// RD-DONE-01 : le schéma de référence (supabase/schema.sql) décrit la colonne
// missions.completion_declared_at telle que le script 90 la crée. Ce garde vérifie les éléments qui
// portent la sécurité : colonne nullable sans défaut, CHECK « aucune date sur une mission ouverte »,
// fonction de garde SECURITY INVOKER à search_path vide qui s'appuie sur edu_is_api_caller(), trigger
// BEFORE INSERT OR UPDATE, aucune politique RLS nouvelle, et compteur missions_done toujours idempotent.
const SCHEMA = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8")
const lines = SCHEMA.split("\n")

function functionBody(name) {
  const start = SCHEMA.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`)
  expect(start, `fonction ${name} absente`).toBeGreaterThan(-1)
  const end = SCHEMA.indexOf("$function$;", SCHEMA.indexOf("$function$", start) + 1)
  expect(end).toBeGreaterThan(start)
  return SCHEMA.slice(start, end)
}

function missionsTable() {
  const start = SCHEMA.indexOf("create table public.missions (")
  expect(start).toBeGreaterThan(-1)
  return SCHEMA.slice(start, SCHEMA.indexOf("\n);", start))
}

describe("schéma de référence : missions.completion_declared_at", () => {
  it("la colonne est un timestamptz nullable, sans défaut", () => {
    const col = missionsTable()
      .split("\n")
      .find((l) => l.includes("completion_declared_at"))
    expect(col).toBeDefined()
    expect(col.trim()).toBe("completion_declared_at timestamp with time zone")
    expect(col).not.toMatch(/default|not null/i)
  })

  it("le CHECK interdit toute date sur une mission ouverte", () => {
    expect(SCHEMA).toContain(
      "alter table public.missions add constraint missions_completion_declared_check CHECK (((completion_declared_at IS NULL) OR (status <> 'open'::text)));"
    )
  })

  it("les 4 statuts de mission sont inchangés", () => {
    expect(SCHEMA).toContain(
      "alter table public.missions add constraint missions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text])));"
    )
  })

  it("la fonction de garde est SECURITY INVOKER, à search_path vide, et refuse les appelants API", () => {
    const body = functionBody("guard_mission_completion_declared")
    expect(body).toContain("SET search_path TO ''")
    expect(body).not.toMatch(/security definer/i)
    expect(body).toContain("if public.edu_is_api_caller() then")
    expect(body).toContain("old.status is distinct from 'in_progress'")
    expect(body).toContain("new.status is distinct from 'in_progress'")
    expect(body).toContain("new.selected_student_id is null")
    expect(body).toContain("errcode = '42501'")
  })

  it("la fonction n'est exécutable que par service_role", () => {
    expect(SCHEMA).toContain(
      "revoke all on function public.guard_mission_completion_declared() from public, anon, authenticated, service_role;"
    )
    const grants = lines.filter((l) => l.startsWith("grant execute on function public.guard_mission_completion_declared()"))
    expect(grants).toEqual([
      "grant execute on function public.guard_mission_completion_declared() to service_role;",
    ])
  })

  it("le trigger couvre INSERT et UPDATE, avant écriture", () => {
    expect(SCHEMA).toContain(
      "CREATE TRIGGER guard_mission_completion_declared BEFORE INSERT OR UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.guard_mission_completion_declared();"
    )
  })

  it("aucune politique RLS nouvelle sur missions et aucun privilège de colonne", () => {
    const policies = lines.filter((l) => l.startsWith("create policy") && l.includes("on public.missions"))
    expect(policies.map((l) => l.match(/create policy (\S+)/)[1])).toEqual([
      "missions_select_public",
      "missions_update_own",
    ])
    const colGrants = lines.filter((l) => /^grant .*\(.*\) on table public\.missions/i.test(l))
    expect(colGrants).toEqual([])
    expect(SCHEMA).toContain("grant SELECT, UPDATE on table public.missions to authenticated;")
  })

  it("guard_missions et handle_mission_done ne mentionnent pas la déclaration", () => {
    expect(functionBody("guard_missions")).not.toContain("completion_declared_at")
    const done = functionBody("handle_mission_done")
    expect(done).not.toContain("completion_declared_at")
    expect(done).toContain("on conflict (mission_id) do nothing")
    expect(done).toContain("if v_inserted = 1 then")
  })

  it("la mention « NON appliqué » du script 90 figure dans l'en-tête", () => {
    const head = SCHEMA.slice(0, 1800)
    expect(head).toContain("Script 90 (RD-DONE-01) NON appliqué en production")
  })
})
