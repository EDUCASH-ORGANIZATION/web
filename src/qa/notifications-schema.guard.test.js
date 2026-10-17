import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

// RD-NOTIF-01 : le schéma de référence (supabase/schema.sql) décrit la table notifications telle
// que le script 80 la crée, avec le CHECK de types APRÈS le script 94 de RD-ACHATS-01 (21 types,
// appliqué en production). Ce garde vérifie les éléments qui portent la sécurité : liste des types,
// unicité de l'idempotence, RLS, absence de droit anon, seule colonne modifiable (read_at), garde
// SECURITY INVOKER à search_path vide, et absence du temps réel.
const SCHEMA = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8")

const EXPECTED_TYPES = [
  "application_received",
  "application_accepted",
  "application_rejected",
  "mission_cancelled",
  "payment_released",
  "review_received",
  "verification_approved",
  "verification_rejected",
  "verification_reset",
  "badge_revoked",
  "account_reactivated",
  "card_submitted",
  "message_received",
  "completion_declared",
  "purchase_requested",
  "purchase_updated",
  "purchase_cancelled",
  "purchase_paid",
  "purchase_received",
  "purchase_reported",
  "purchase_report_closed",
]

const lines = SCHEMA.split("\n")
const onNotifications = lines.filter((l) => l.includes("public.notifications"))

function functionBody() {
  const start = SCHEMA.indexOf("CREATE OR REPLACE FUNCTION public.guard_notifications()")
  expect(start).toBeGreaterThan(-1)
  const end = SCHEMA.indexOf("$function$;", SCHEMA.indexOf("$function$", start) + 1)
  expect(end).toBeGreaterThan(start)
  return SCHEMA.slice(start, end)
}

describe("schéma de référence : table notifications", () => {
  it("la liste du CHECK sur type est exactement la liste attendue (21 types)", () => {
    const checks = lines.filter((l) => l.includes("notifications_type_check"))
    expect(checks, "une seule définition du CHECK").toHaveLength(1)
    const found = [...checks[0].matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1])
    expect(found).toEqual(EXPECTED_TYPES)
    expect(found).toHaveLength(21)
    expect(new Set(found).size).toBe(21)
  })

  it("la liste du CHECK reste alignée sur le catalogue du code", async () => {
    const catalog = path.join(process.cwd(), "src/lib/notifications/catalog.js")
    expect(existsSync(catalog), "catalogue des notifications déplacé ou supprimé").toBe(true)
    const mod = await import("@/lib/notifications/catalog")
    expect([...mod.NOTIFICATION_TYPES].sort()).toEqual([...EXPECTED_TYPES].sort())
  })

  it("l'idempotence repose sur une contrainte unique (recipient_id, dedupe_key)", () => {
    expect(SCHEMA).toContain(
      "alter table public.notifications add constraint notifications_recipient_dedupe_key UNIQUE (recipient_id, dedupe_key);"
    )
  })

  it("titre, corps et clé sont bornés, sans enum ni jsonb", () => {
    expect(SCHEMA).toContain("(char_length(title) <= 120)")
    expect(SCHEMA).toContain("(char_length(body) <= 280)")
    expect(SCHEMA).toContain("(char_length(dedupe_key) <= 200)")
    const table = SCHEMA.slice(
      SCHEMA.indexOf("create table public.notifications ("),
      SCHEMA.indexOf(");", SCHEMA.indexOf("create table public.notifications ("))
    )
    expect(table).not.toMatch(/jsonb|json\b/)
    expect(SCHEMA).not.toMatch(/create type public\.notification/i)
  })

  it("les clés étrangères visent profiles(user_id), jamais auth.users", () => {
    const fks = onNotifications.filter((l) => l.includes("FOREIGN KEY"))
    expect(fks).toHaveLength(3)
    expect(fks.some((l) => l.includes("auth.users"))).toBe(false)
  })

  it("la RLS est activée et les deux politiques ciblent authenticated seulement", () => {
    expect(SCHEMA).toContain("alter table public.notifications enable row level security;")
    const policies = lines.filter((l) => l.startsWith("create policy") && l.includes("on public.notifications"))
    expect(policies).toHaveLength(2)
    for (const p of policies) {
      expect(p).toContain("to authenticated")
      expect(p).not.toMatch(/to (public|anon)\b/)
      expect(p).not.toMatch(/for (insert|delete|all)\b/)
    }
    expect(SCHEMA).toContain("recipient_id = ( SELECT auth.uid() AS uid)")
  })

  it("anon n'a aucun privilège et authenticated ne peut ni insérer ni supprimer", () => {
    const grants = onNotifications.filter((l) => /^grant /i.test(l))
    expect(grants.some((l) => /\bto anon\b/.test(l))).toBe(false)
    expect(grants.some((l) => /\bto public\b/.test(l))).toBe(false)
    const toAuth = grants.filter((l) => /\bto authenticated\b/.test(l))
    expect(toAuth).toEqual([
      "grant SELECT on table public.notifications to authenticated;",
      "grant UPDATE (read_at) on table public.notifications to authenticated;",
    ])
    expect(SCHEMA).toContain(
      "revoke all on table public.notifications from public, anon, authenticated, service_role;"
    )
  })

  it("seule la colonne read_at est modifiable par un appelant API", () => {
    const updates = onNotifications.filter((l) => /^grant .*update/i.test(l) && /authenticated/.test(l))
    expect(updates).toHaveLength(1)
    expect(updates[0]).toContain("UPDATE (read_at)")
  })

  it("la fonction de garde est SECURITY INVOKER, à search_path vide, et protège les colonnes", () => {
    const body = functionBody()
    expect(body).toContain("SET search_path TO ''")
    expect(body).not.toMatch(/security definer/i)
    expect(body).toContain("public.edu_is_api_caller()")
    expect(body).toContain("new.read_at := now();")
    expect(body).toContain("old.read_at is not null and new.read_at is distinct from old.read_at")
    expect(SCHEMA).toContain(
      "revoke all on function public.guard_notifications() from public, anon, authenticated, service_role;"
    )
    expect(SCHEMA).toContain("grant execute on function public.guard_notifications() to service_role;")
  })

  it("le trigger de garde couvre INSERT et UPDATE", () => {
    expect(SCHEMA).toContain(
      "CREATE TRIGGER guard_notifications BEFORE INSERT OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.guard_notifications();"
    )
  })

  it("la table n'est pas ajoutée à la publication realtime", () => {
    const realtime = lines.filter((l) => /alter publication/i.test(l))
    expect(realtime.some((l) => l.includes("notifications"))).toBe(false)
  })

  it("l'en-tête indique que le script 80 est appliqué en production", () => {
    const head = SCHEMA.slice(0, 1200)
    expect(head).toContain("Script 80 de RD-NOTIF-01 appliqué en production le 2026-10-15.")
    const script80 = head.split("\n").filter((l) => /script 80/i.test(l))
    expect(script80.length).toBeGreaterThan(0)
    expect(script80.some((l) => /NON appliqué|à retirer après application/.test(l))).toBe(false)
  })
})
