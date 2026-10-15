import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

import { PURCHASES_ESTIMATE_MAX } from "@/lib/app/purchases"

// RD-MISSION-02 : la colonne missions.purchases_estimate est un numeric sans précision, et le
// propriétaire d'une mission open peut la modifier directement par PostgREST. La contrainte de la
// base doit donc refuser seule les décimaux (0.5, 1234.567), le zéro, le négatif et le dépassement
// du plafond, comme le fait createMission. Ce test lit le schéma de référence (supabase/schema.sql).
const SCHEMA = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8")

function constraintLine() {
  const lines = SCHEMA.split("\n").filter((l) => l.includes("missions_purchases_estimate_check"))
  expect(lines).toHaveLength(1)
  return lines[0]
}

describe("schéma de référence : contrainte missions_purchases_estimate_check", () => {
  it("exige un entier strictement positif, plafonné comme le code", () => {
    expect(constraintLine()).toBe(
      "alter table public.missions add constraint missions_purchases_estimate_check CHECK (((purchases_estimate IS NULL) OR ((purchases_estimate > (0)::numeric) AND (purchases_estimate <= (999999999)::numeric) AND (purchases_estimate = trunc(purchases_estimate)))));"
    )
    expect(PURCHASES_ESTIMATE_MAX).toBe(999999999)
  })

  it("refuse les décimaux : le contrôle d'entier (trunc) est présent", () => {
    expect(constraintLine()).toContain("(purchases_estimate = trunc(purchases_estimate))")
  })

  it("la colonne reste optionnelle, sans valeur par défaut", () => {
    expect(SCHEMA).toMatch(/\n {2}purchases_estimate numeric\n\);/)
  })

  it("guard_missions fige l'estimation dès que la mission n'est plus open", () => {
    expect(SCHEMA).toContain(
      "  if new.purchases_estimate is distinct from old.purchases_estimate\n     and (old.status <> 'open' or new.status <> 'open') then\n"
    )
  })
})
