import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

import { payeeIsProfilePhone } from "./payee-phone"
import { IDS, createFakeDb } from "@/lib/actions/purchase-fake-db.test-support"

const { student: STUDENT, client: CLIENT } = IDS
let db

beforeEach(() => {
  db = createFakeDb({
    profiles: [
      { user_id: STUDENT, phone: "+2290197000001" },
      { user_id: CLIENT, phone: "+2290197000002" },
    ],
  })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("payeeIsProfilePhone", () => {
  it("reconnaît le téléphone de l'étudiant, perso comme code marchand de 8 chiffres", async () => {
    expect(await payeeIsProfilePhone(db.service(), STUDENT, "+2290197000001")).toEqual({ same: true })
    expect(await payeeIsProfilePhone(db.service(), STUDENT, "97000001")).toEqual({ same: true })
    expect(await payeeIsProfilePhone(db.service(), STUDENT, "123456")).toEqual({ same: false })
  })

  it("ne lit que le profil de l'étudiant de la session : le téléphone du client n'est jamais comparé", async () => {
    expect(await payeeIsProfilePhone(db.service(), STUDENT, "+2290197000002")).toEqual({ same: false })
  })

  it("profil sans téléphone ou introuvable : pas de correspondance", async () => {
    db.tables.profiles[0].phone = null
    expect(await payeeIsProfilePhone(db.service(), STUDENT, "+2290197000001")).toEqual({ same: false })
    expect(await payeeIsProfilePhone(db.service(), IDS.otherStudent, "+2290197000001")).toEqual({ same: false })
  })

  it("erreur de base : échec neutre, seul le code est journalisé, le téléphone ne ressort jamais", async () => {
    db.faults["profiles.select"] = { code: "XX000", message: "secret +2290197000001" }
    const res = await payeeIsProfilePhone(db.service(), STUDENT, "+2290197000001")
    expect(res).toEqual({ error: true })
    expect(JSON.stringify(console.error.mock.calls)).toContain("XX000")
    expect(JSON.stringify(console.error.mock.calls)).not.toMatch(/secret|0197000001/)
  })
})
