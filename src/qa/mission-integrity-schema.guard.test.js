import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Script 97 de RD-SQL-97 appliqué en production le 2026-10-17 : supabase/schema.sql décrit l'état APRÈS le 97.
// Ce garde vérifie ce qui protège l'historique financier : les deux clés mission_id en RESTRICT et le CHECK du libellé réservé.
const SCHEMA = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8")
const lines = SCHEMA.split("\n")

const lineOf = (prefix) => {
  const found = lines.filter((l) => l.startsWith(prefix))
  expect(found, `ligne attendue une fois : ${prefix}`).toHaveLength(1)
  return found[0]
}

describe("schéma de référence : intégrité des missions (script 97)", () => {
  it("l'en-tête déclare le script 97 appliqué et l'état après le 97", () => {
    expect(SCHEMA).toContain("-- Script 97 de RD-SQL-97 appliqué en production le 2026-10-17.")
    expect(SCHEMA).toContain("-- Ce fichier décrit l'état APRÈS le script 97 :")
  })

  it("transactions_mission_id_fkey et purchase_requests_mission_id_fkey sont en RESTRICT", () => {
    expect(lineOf("alter table public.transactions add constraint transactions_mission_id_fkey ")).toBe(
      "alter table public.transactions add constraint transactions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE RESTRICT;"
    )
    expect(lineOf("alter table public.purchase_requests add constraint purchase_requests_mission_id_fkey ")).toBe(
      "alter table public.purchase_requests add constraint purchase_requests_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE RESTRICT;"
    )
  })

  it("aucune clé étrangère de transactions ou de purchase_requests vers missions n'est en CASCADE", () => {
    const bad = lines.filter(
      (l) => /^alter table public\.(transactions|purchase_requests) add constraint /.test(l) && /REFERENCES (public\.)?missions\(/.test(l) && !/ON DELETE RESTRICT;$/.test(l)
    )
    expect(bad).toEqual([])
  })

  it("missions_client_id_profiles_fkey reste documentée (CASCADE, bloquée en pratique par les clés RESTRICT)", () => {
    expect(lineOf("alter table public.missions add constraint missions_client_id_profiles_fkey ")).toBe(
      "alter table public.missions add constraint missions_client_id_profiles_fkey FOREIGN KEY (client_id) REFERENCES profiles(user_id) ON DELETE CASCADE;"
    )
  })

  it("profiles_closed_label_check réserve « Compte clôturé » aux profils pseudonymisés", () => {
    const start = SCHEMA.indexOf("alter table public.profiles add constraint profiles_closed_label_check CHECK (")
    expect(start).toBeGreaterThan(-1)
    const def = SCHEMA.slice(start, SCHEMA.indexOf(";\n", start) + 1)
    expect(def).toContain("pseudonymized_at is not null or full_name is null or")
    expect(def).toContain("normalize(full_name, NFKD)")
    expect(def).toContain("'[\\u0300-\\u036f]'")
    expect(def).toContain("'[\\u200b-\\u200d\\u2060\\ufeff]'")
    expect(def).toContain("'[[:space:]\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]+', ' ', 'g'")
    expect(def).toMatch(/<> 'compte cloture'\);$/)
    expect(SCHEMA.split("profiles_closed_label_check").length - 1).toBeGreaterThanOrEqual(1)
  })
})
