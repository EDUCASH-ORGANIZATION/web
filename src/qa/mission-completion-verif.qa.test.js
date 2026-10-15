import { describe, it, expect, vi, beforeEach } from "vitest"

// RD-DONE-01 / vérification indépendante (TESTER) : cas non couverts par les tests du développeur.
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { declareMissionCompletion } from "@/lib/actions/mission-completion.actions"
import { readCompletionDeclared, isMissingCompletionColumn } from "@/lib/actions/mission-completion-core"
import { completionState, canDeclareCompletion, COMPLETION_COPY } from "@/lib/missions/completion"
import { studentMissionHref } from "@/lib/app/student-routes"

const M = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const S = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"
const DATE = "2026-10-14T09:30:00.000Z"
const row = { id: M, title: "t", client_id: "c", selected_student_id: S, status: "in_progress", completion_declared_at: null }

function service({ reads, update }) {
  const tables = []
  const writes = []
  let n = 0
  const from = vi.fn((t) => {
    tables.push(t)
    let op = "select"
    const b = {
      select: () => b,
      update: (v) => { op = "update"; writes.push(v); return b },
      eq: () => b,
      is: () => b,
      maybeSingle: () => Promise.resolve(reads[Math.min(n++, reads.length - 1)]),
      then: (ok, ko) => Promise.resolve(op === "update" ? update : reads[0]).then(ok, ko),
    }
    return b
  })
  return { client: { from }, tables, writes }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  requireRole.mockResolvedValue({ user: { id: S }, role: "student" })
})

describe("declareMissionCompletion : compléments", () => {
  it("ne touche jamais qu'à la table missions (ni wallets, transactions, mission_completions, notifications)", async () => {
    const s = service({ reads: [{ data: row, error: null }], update: { data: [{ id: M, completion_declared_at: DATE }], error: null } })
    createServiceClient.mockReturnValue(s.client)
    await declareMissionCompletion(M)
    expect(new Set(s.tables)).toEqual(new Set(["missions"]))
    expect(Object.keys(s.writes[0])).toEqual(["completion_declared_at"])
  })

  it("PGRST204 à l'écriture : unavailable", async () => {
    const s = service({ reads: [{ data: row, error: null }], update: { data: null, error: { code: "PGRST204" } } })
    createServiceClient.mockReturnValue(s.client)
    expect(await declareMissionCompletion(M)).toEqual({ error: COMPLETION_COPY.unavailable, code: "unavailable" })
  })

  it("erreur de lecture sans code : message générique, aucune écriture", async () => {
    const s = service({ reads: [{ data: null, error: { message: "boom" } }], update: { data: [], error: null } })
    createServiceClient.mockReturnValue(s.client)
    expect(await declareMissionCompletion(M)).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant.", code: "generic" })
    expect(s.writes).toHaveLength(0)
  })

  it("UPDATE sans données (data null, sans erreur) puis relecture encore vide de date : générique, pas de succès", async () => {
    const s = service({ reads: [{ data: row, error: null }], update: { data: null, error: null } })
    createServiceClient.mockReturnValue(s.client)
    const res = await declareMissionCompletion(M)
    expect(res.success).toBeUndefined()
    expect(res.code).toBe("generic")
    expect(s.writes).toHaveLength(1)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([
    ["injection SQL", "11111111-1111-1111-1111-111111111111' or '1'='1"],
    ["or PostgREST", "x,id.neq.0"],
    ["chaîne vide", ""],
    ["null", null],
    ["undefined", undefined],
    ["objet", { id: M }],
    ["tableau", [M]],
    ["nombre", 42],
    ["uuid avec espace", ` ${M}`],
    ["uuid avec retour ligne", `${M}\n`],
  ])("identifiant hostile (%s) : not_found sans appel au client service", async (_n, id) => {
    expect(await declareMissionCompletion(id)).toEqual({ error: "Mission introuvable.", code: "not_found" })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("deux appels simultanés : au plus un 'success: alreadyDeclared:false' si la base répond comme prévu", async () => {
    // 1er : UPDATE 1 ligne ; 2e : UPDATE 0 ligne puis relecture déclarée
    const reads = [{ data: row, error: null }, { data: row, error: null }, { data: { ...row, completion_declared_at: DATE }, error: null }]
    let u = 0
    const updates = [{ data: [{ id: M, completion_declared_at: DATE }], error: null }, { data: [], error: null }]
    const s = service({ reads, update: undefined })
    // update dynamique
    s.client.from = vi.fn(() => {
      let op = "select"
      const b = {
        select: () => b, update: () => { op = "update"; return b }, eq: () => b, is: () => b,
        maybeSingle: () => Promise.resolve(reads.shift() ?? reads[0]),
        then: (ok, ko) => Promise.resolve(op === "update" ? updates[u++] : null).then(ok, ko),
      }
      return b
    })
    createServiceClient.mockReturnValue(s.client)
    const [a, b2] = await Promise.all([declareMissionCompletion(M), declareMissionCompletion(M)])
    const fresh = [a, b2].filter((r) => r.success && r.alreadyDeclared === false)
    expect(fresh.length).toBe(1)
    expect([a, b2].every((r) => r.success === true)).toBe(true)
  })
})

describe("readCompletionDeclared : compléments", () => {
  const client = (res) => ({ from: () => ({ select: () => ({ in: vi.fn(() => Promise.resolve(res)) }) }) })
  it("entrée non tableau ou ids non uuid : aucune requête", async () => {
    const c = { from: vi.fn() }
    expect((await readCompletionDeclared(c, null)).byId.size).toBe(0)
    expect((await readCompletionDeclared(c, ["x", "'; drop", 3])).byId.size).toBe(0)
    expect(c.from).not.toHaveBeenCalled()
  })
  it("erreur autre que colonne absente : levée", async () => {
    await expect(readCompletionDeclared(client({ data: null, error: { code: "XX000" } }), [M])).rejects.toBeTruthy()
  })
  it("isMissingCompletionColumn : null, undefined, autre code", () => {
    expect(isMissingCompletionColumn(null)).toBe(false)
    expect(isMissingCompletionColumn(undefined)).toBe(false)
    expect(isMissingCompletionColumn({ code: "42P01" })).toBe(false)
    expect(isMissingCompletionColumn({ code: "42703" })).toBe(true)
  })
  it("plafonne à 200 identifiants", async () => {
    const ids = Array.from({ length: 300 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`)
    const inFn = vi.fn(() => Promise.resolve({ data: [], error: null }))
    await readCompletionDeclared({ from: () => ({ select: () => ({ in: inFn }) }) }, ids)
    expect(inFn.mock.calls[0][1]).toHaveLength(200)
  })
})

describe("completionState / canDeclareCompletion : tous statuts et valeurs invalides", () => {
  const statuses = ["open", "in_progress", "done", "cancelled", "pending", "", null, undefined, 3, "IN_PROGRESS"]
  const dates = [null, undefined, "", DATE, "pas une date", 0, {}, "0"]
  it("matrice complète : seul in_progress + valeur vraie donne declared ; done/cancelled prioritaires", () => {
    for (const status of statuses) {
      for (const completionDeclaredAt of dates) {
        const st = completionState({ status, completionDeclaredAt })
        if (status === "done") expect(st).toBe("confirmed")
        else if (status === "cancelled") expect(st).toBe("cancelled")
        else if (status === "in_progress" && completionDeclaredAt) expect(st).toBe("declared")
        else expect(st).toBe("none")
      }
    }
  })
  it("ne lève jamais sur entrée absente", () => {
    expect(completionState()).toBe("none")
    expect(completionState(undefined)).toBe("none")
    expect(canDeclareCompletion()).toBe(false)
  })
  it("canDeclareCompletion : strictement booléen, jamais avec valeurs truthy non booléennes", () => {
    const ok = { status: "in_progress", isSelected: true, completionDeclaredAt: null, available: true }
    expect(canDeclareCompletion(ok)).toBe(true)
    for (const k of ["isSelected", "available"]) {
      for (const v of ["true", 1, "yes", {}, null, undefined, false]) expect(canDeclareCompletion({ ...ok, [k]: v })).toBe(false)
    }
    for (const status of statuses.filter((s) => s !== "in_progress")) expect(canDeclareCompletion({ ...ok, status })).toBe(false)
    expect(canDeclareCompletion({ ...ok, completionDeclaredAt: DATE })).toBe(false)
  })
})

describe("studentMissionHref avec terminer : identifiants hostiles", () => {
  it.each(["a/b", "../admin", "x?terminer=0&y=1", "x#frag", "<script>", "a b", "%2e%2e", "é"])("encode %s", (id) => {
    const href = studentMissionHref(id, { terminer: true })
    expect(href.startsWith("/student/missions/")).toBe(true)
    const [path, qs] = href.split("?")
    expect(path.slice("/student/missions/".length)).not.toMatch(/[/?#<> ]/)
    expect(qs).toBe("terminer=1")
  })
  it.each([null, undefined, ""])("id invalide %s : liste", (id) => {
    expect(studentMissionHref(id, { terminer: true })).toBe("/student/missions")
  })
  it("terminer chaîne : reste sur la page de la mission", () => {
    expect(studentMissionHref("a", { terminer: "1" })).toMatch(/^\/student\/missions\/a(\?terminer=1)?$/)
  })
})

describe("COMPLETION_COPY", () => {
  const texts = () => Object.values(COMPLETION_COPY).filter((v) => typeof v === "string").concat([COMPLETION_COPY.declaredOn(DATE), COMPLETION_COPY.declaredOn(null)])
  it("vouvoiement, aucun tutoiement", () => {
    for (const t of texts()) expect(t).not.toMatch(/\b(tu|ton|ta|tes|toi|as terminé|es sûr|ton paiement)\b/i)
    expect(COMPLETION_COPY.confirmTitle).toMatch(/^Vous /)
  })
  it("aucun délai ni paiement automatique ni promesse de fonds", () => {
    for (const t of texts()) {
      expect(t).not.toMatch(/automatique|automatiquement|\d+\s*(h|heures?|jours?|minutes?)|sous\s+\d|délai|dans les|libér|payé|paiement|FCFA|argent/i)
    }
  })
  it("pas de tiret cadratin ni demi-cadratin", () => {
    for (const t of texts()) expect(t).not.toMatch(/[\u2013\u2014]/)
  })
  it("declaredOn : dates invalides sans exception", () => {
    for (const v of [null, undefined, "", "n'importe quoi", "2026-13-45", 0, {}]) {
      let r
      expect(() => { r = COMPLETION_COPY.declaredOn(v) }).not.toThrow()
      expect(r).toBe("Fin déclarée")
    }
    expect(COMPLETION_COPY.declaredOn(DATE)).toMatch(/^Fin déclarée le /)
  })
  it("objet gelé", () => {
    expect(Object.isFrozen(COMPLETION_COPY)).toBe(true)
  })
})
