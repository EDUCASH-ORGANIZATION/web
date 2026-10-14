import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { existsSync, readFileSync } from "node:fs"

vi.mock("@/lib/actions/application.actions", () => ({ apply: vi.fn() }))

const { MissionApplyView } = await import("./apply-view")
const { MissionFollowupView } = await import("./followup-view")

const flags = { postuler: false, paymentsEnabled: false }
const mission = (over) => ({
  id: "m1", title: "Cours de maths niveau 3e", description: "Deux soirs par semaine.", type: "Cours particuliers",
  city: "Cotonou", budget: 20000, urgency: "low", deadline: "2999-01-01", status: "open", createdAt: "2026-10-01T08:00:00Z",
  ...over,
})
const client = { name: "Mawuli A.", avatarUrl: null, city: "Cotonou", rating: 4.7, missionsPublished: 5, isVerified: true }
const open = (over) => ({
  state: "open", mission: mission(), client, application: null, isSelected: false,
  verification: { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: null, action: null },
  ledger: [], review: null, similar: [], ...over,
})
const followed = (status, over) =>
  open({
    state: "selected", mission: mission({ status }), isSelected: true, verification: null,
    application: { id: "a1", status: "accepted", message: "Hello", createdAt: "2026-10-02T09:00:00Z", updatedAt: "2026-10-03T09:00:00Z" },
    ...over,
  })

const h1Count = (html) => (html.match(/<h1[\s>]/g) ?? []).length

describe("MissionApplyView (bouchon E03)", () => {
  it("mission ouverte : un seul h1, gain par escrowSplit, ancien formulaire conservé", () => {
    const html = renderToStaticMarkup(<MissionApplyView detail={open()} flags={flags} />)
    expect(h1Count(html)).toBe(1)
    expect(html).toContain("Cours de maths niveau 3e")
    expect(html).toContain("Envoyer ma candidature")
    expect(html).toContain("17")
  })

  it("plus ouverte : aucun titre, aucun montant, un seul h1", () => {
    const html = renderToStaticMarkup(<MissionApplyView detail={{ state: "closed", mission: { id: "m1" } }} flags={flags} />)
    expect(h1Count(html)).toBe(1)
    expect(html).toContain("n&#x27;est plus ouverte")
    expect(html).not.toContain("FCFA")
    expect(html).not.toContain("Envoyer ma candidature")
  })

  it("vérification bloquante : lien vers la vérification, formulaire désactivé", () => {
    const verification = {
      key: "not_submitted", label: "Carte à envoyer", canApply: false, daysLeft: null,
      action: { label: "Envoyer ma carte", href: "/profile/verify" },
    }
    const html = renderToStaticMarkup(<MissionApplyView detail={open({ verification })} flags={flags} />)
    expect(html).toContain('href="/profile/verify"')
    expect(html).toContain("Envoyer ma carte")
  })

  it("déjà candidat : statut de la candidature", () => {
    const application = { id: "a1", status: "pending", message: "Hello", createdAt: "2026-10-02T09:00:00Z", updatedAt: null }
    const html = renderToStaticMarkup(<MissionApplyView detail={open({ application })} flags={flags} />)
    expect(html).toContain("En attente")
    expect(html).toContain("Candidature envoyée")
  })
})

describe("MissionFollowupView (bouchon E05)", () => {
  it("en cours : ta part par escrowSplit, écrire au client, signaler, aucun bouton J'ai terminé", () => {
    const html = renderToStaticMarkup(<MissionFollowupView detail={followed("in_progress")} flags={flags} />)
    expect(h1Count(html)).toBe(1)
    expect(html).toContain("Écrire au client")
    expect(html).toContain("Signaler un problème")
    expect(html).toContain("12 %")
    expect(html).not.toContain("J&#x27;ai terminé")
    expect(html).not.toContain("Noter le client")
  })

  it("terminée non notée : reçu du grand livre et lien pour noter", () => {
    const ledger = [{ type: "release", amount: 17600, createdAt: "2026-10-20T10:00:00Z" }]
    const html = renderToStaticMarkup(<MissionFollowupView detail={followed("done", { ledger })} flags={flags} />)
    expect(html).toContain("Noter le client")
    expect(html).toContain("/review/m1")
  })

  it("terminée sans ligne de grand livre : paiement en cours, aucun montant inventé", () => {
    const html = renderToStaticMarkup(<MissionFollowupView detail={followed("done")} flags={flags} />)
    expect(html).toContain("Paiement en cours de traitement")
  })

  it("terminée notée : avis donné", () => {
    const review = { id: "r1", rating: 5, comment: null, createdAt: "2026-10-21T00:00:00Z" }
    const html = renderToStaticMarkup(<MissionFollowupView detail={followed("done", { review })} flags={flags} />)
    expect(html).toContain("Avis donné")
    expect(html).not.toContain("Noter le client")
  })

  it("annulée : explication sans montant", () => {
    const html = renderToStaticMarkup(<MissionFollowupView detail={followed("cancelled")} flags={flags} />)
    expect(html).toContain("annulée")
    expect(html).not.toContain("FCFA")
  })
})

describe("structure de la route /student/missions/[id]", () => {
  const dir = "src/app/(student)/student/missions"
  it("aucun loading.js sous student/missions ni sous [id] (un id inconnu doit répondre 404)", () => {
    expect(existsSync(`${dir}/loading.js`)).toBe(false)
    expect(existsSync(`${dir}/[id]/loading.js`)).toBe(false)
    expect(existsSync("src/app/(student)/student/loading.js")).toBe(false)
    expect(existsSync("src/app/(student)/loading.js")).toBe(false)
  })

  it("not-found.js est présent dans la coquille", () => {
    expect(existsSync(`${dir}/[id]/not-found.js`)).toBe(true)
  })

  it("la page n'importe plus Supabase, appelle notFound et ne lit que l'action", () => {
    const page = readFileSync(`${dir}/[id]/page.js`, "utf8")
    expect(page).not.toMatch(/lib\/supabase/)
    expect(page).toContain("notFound()")
    expect(page).toContain("getStudentMissionDetail")
    expect(page).toContain("@ds-screen RD-STUDENT-01")
  })

  it("l'action ne lit jamais select(*)", () => {
    expect(readFileSync("src/lib/actions/student-mission-detail.actions.js", "utf8")).not.toMatch(/select\(\s*["'`]\*/)
  })
})
