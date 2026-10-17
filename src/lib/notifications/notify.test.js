import { describe, it, expect, vi, beforeEach } from "vitest"

let upsertResult = { error: null }
let adminsResult = { data: [], error: null }
let throwOnCreate = false
const upsert = vi.fn(async () => upsertResult)
const profilesFilters = []
const service = {
  from: vi.fn((table) => {
    if (table === "notifications") return { upsert }
    const chain = {
      select: () => chain,
      eq: (c, v) => { profilesFilters.push([c, v]); return chain },
      in: (c, v) => { profilesFilters.push([c, v]); return chain },
      not: (c, op, v) => { profilesFilters.push([c, op, v]); return chain },
      then: (resolve, reject) => Promise.resolve(adminsResult).then(resolve, reject),
    }
    return chain
  }),
}
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    if (throwOnCreate) throw new Error("config manquante contact@example.com 0197000000")
    return service
  },
}))

import { notify, notifyAdmins, notifyMany } from "./notify"
import { applicationReceived, cardSubmitted } from "./catalog"

const M = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const S = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"
const input = () => ({
  recipientId: "cli-1",
  ...applicationReceived({ missionId: M, missionTitle: "Flyer", studentId: S, studentName: "Afiavi Dossou" }),
})

let logs
beforeEach(() => {
  upsertResult = { error: null }
  adminsResult = { data: [], error: null }
  throwOnCreate = false
  upsert.mockClear()
  service.from.mockClear()
  profilesFilters.length = 0
  logs = []
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation((...args) => logs.push(args.map(String).join(" ")))
  }
})

describe("notify", () => {
  it("écrit une ligne avec upsert ignorant les doublons", async () => {
    expect(await notify(input())).toEqual({ ok: true })
    expect(service.from).toHaveBeenCalledWith("notifications")
    const [rows, options] = upsert.mock.calls[0]
    expect(options).toEqual({ onConflict: "recipient_id,dedupe_key", ignoreDuplicates: true })
    expect(rows).toEqual([
      {
        recipient_id: "cli-1",
        type: "application_received",
        title: "Nouvelle candidature",
        body: "Afiavi D. a postulé à « Flyer ».",
        mission_id: M,
        actor_id: S,
        dedupe_key: `application_received:${M}:${S}`,
      },
    ])
  })

  it("rejouer le même événement envoie la même clé (le doublon est ignoré par la base)", async () => {
    await notify(input())
    await notify(input())
    expect(upsert.mock.calls[0][0][0].dedupe_key).toBe(upsert.mock.calls[1][0][0].dedupe_key)
  })

  it("erreur Supabase : { ok: false } sans exception, journal sans donnée personnelle", async () => {
    upsertResult = { error: { code: "23514", message: "violates check for afiavi@example.com", details: "0197000000" } }
    await expect(notify(input())).resolves.toEqual({ ok: false })
    const text = logs.join("\n")
    expect(text).not.toMatch(/@|0197|Afiavi/)
  })

  it("exception du client : { ok: false }, aucun journal avec adresse ni téléphone", async () => {
    throwOnCreate = true
    await expect(notify(input())).resolves.toEqual({ ok: false })
    expect(logs.join("\n")).not.toMatch(/@|0197|contact/)
  })

  it("table absente : un avertissement court", async () => {
    upsertResult = { error: { code: "42P01", message: 'relation "public.notifications" does not exist' } }
    await expect(notify(input())).resolves.toEqual({ ok: false })
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.error).not.toHaveBeenCalled()
  })

  it("entrée invalide ou sans destinataire : aucune écriture", async () => {
    expect(await notify({ ...input(), type: "autre" })).toEqual({ ok: false })
    expect(await notify({ ...input(), recipientId: "" })).toEqual({ ok: false })
    expect(await notify(undefined)).toEqual({ ok: false })
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe("notifyMany", () => {
  it("une ligne par destinataire distinct", async () => {
    const n = input()
    expect(await notifyMany(["a", "b", "a", ""], n)).toEqual({ ok: true })
    expect(upsert.mock.calls[0][0].map((r) => r.recipient_id)).toEqual(["a", "b"])
  })

  it("liste vide : rien à écrire", async () => {
    expect(await notifyMany([], input())).toEqual({ ok: true })
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe("comptes fermés", () => {
  it("notify : aucune écriture vers un destinataire fermé (filtre closed_at non nul)", async () => {
    adminsResult = { data: [{ user_id: "cli-1" }], error: null }
    expect(await notify(input())).toEqual({ ok: true })
    expect(upsert).not.toHaveBeenCalled()
    expect(profilesFilters).toContainEqual(["closed_at", "is", null])
  })

  it("notify : lecture de l'état en erreur, rien n'est écrit", async () => {
    adminsResult = { data: null, error: { code: "42703", message: "column closed_at does not exist" } }
    await expect(notify(input())).resolves.toEqual({ ok: false })
    expect(upsert).not.toHaveBeenCalled()
  })

  it("notifyMany : écrit seulement pour les destinataires ouverts", async () => {
    adminsResult = { data: [{ user_id: "cli-2" }], error: null }
    const { recipientId, ...notification } = input()
    expect(await notifyMany(["cli-1", "cli-2"], notification)).toEqual({ ok: true })
    expect(upsert.mock.calls[0][0].map((r) => r.recipient_id)).toEqual(["cli-1"])
  })

  it("notifyMany : tous fermés, aucune écriture", async () => {
    adminsResult = { data: [{ user_id: "cli-1" }], error: null }
    const { recipientId, ...notification } = input()
    expect(await notifyMany(["cli-1"], notification)).toEqual({ ok: true })
    expect(upsert).not.toHaveBeenCalled()
  })

  it("notifyAdmins reste inchangé : aucune lecture de closed_at", async () => {
    adminsResult = { data: [{ user_id: "adm-1" }], error: null }
    await notifyAdmins(cardSubmitted({ studentId: S, studentName: "Codjo Agbo", at: new Date("2026-10-15T10:00:00Z") }))
    expect(profilesFilters.flat()).not.toContain("closed_at")
    expect(upsert).toHaveBeenCalledTimes(1)
  })
})

describe("notifyAdmins", () => {
  const card = () => cardSubmitted({ studentId: S, studentName: "Codjo Agbo", at: new Date("2026-10-15T10:00:00Z") })

  it("écrit pour les admins non suspendus (filtre role et is_suspended), lit user_id seulement", async () => {
    adminsResult = { data: [{ user_id: "adm-1" }, { user_id: "adm-2" }], error: null }
    expect(await notifyAdmins(card())).toEqual({ ok: true })
    expect(profilesFilters).toEqual([["role", "admin"], ["is_suspended", false]])
    expect(upsert.mock.calls[0][0].map((r) => r.recipient_id)).toEqual(["adm-1", "adm-2"])
  })

  it("aucun admin : aucune écriture", async () => {
    expect(await notifyAdmins(card())).toEqual({ ok: true })
    expect(upsert).not.toHaveBeenCalled()
  })

  it("lecture des admins en erreur : { ok: false } sans exception", async () => {
    adminsResult = { data: null, error: { code: "XX000", message: "boom" } }
    await expect(notifyAdmins(card())).resolves.toEqual({ ok: false })
    expect(upsert).not.toHaveBeenCalled()
  })

  it("exception : { ok: false }", async () => {
    throwOnCreate = true
    await expect(notifyAdmins(card())).resolves.toEqual({ ok: false })
  })
})
