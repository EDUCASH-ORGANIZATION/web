import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }))
vi.mock("@/lib/actions/mission.actions", () => ({ confirmMission: vi.fn() }))

const { MissionFollowupView } = await import("../followup-view")
const { buildTimeline } = await import("./timeline")
const { missionView } = await import("@/lib/client-space/mission-view")

const student = {
  id: "s1", fullName: "Sèna Agossou", avatarUrl: null, city: "Cotonou", rating: 4.9, missionsDone: 23,
  isVerified: true, verifiedUntil: "2099-01-01", school: "IFRI", level: "Licence 2", skills: [],
}
const RESERVE = { type: "reserve", amount: 25000, createdAt: "2026-10-02T10:14:00Z" }
const DECLARED = { available: true, declaredAt: "2026-10-07T09:00:00Z" }
const DONE_LEDGER = [
  RESERVE,
  { type: "release", amount: 25000, createdAt: "2026-10-08T09:02:00Z" },
  { type: "commission", amount: 3000, createdAt: "2026-10-08T09:02:00Z" },
]

function detailOf(status, extra = {}) {
  return {
    mission: {
      id: "m1", title: "Cours de maths niveau 3e", description: "x", type: "Cours particuliers", city: "Cotonou", budget: 25000,
      urgency: "low", deadline: "2099-12-31", status, createdAt: "2026-10-02T10:14:00Z", selectedStudentId: "s1",
    },
    applications: [],
    selectedStudent: student,
    ledger: [RESERVE],
    review: null,
    ...extra,
  }
}
const FLAGS = { confirmer: false, publiee: false, paymentsEnabled: true }
const render = (d, flags = FLAGS) => renderToStaticMarkup(<MissionFollowupView detail={d} flags={flags} />).replaceAll("&#x27;", "'")
const section = (html, label) => html.match(new RegExp(`<section[^>]*aria-label="${label}"[\\s\\S]*?</section>`))?.[0] ?? null
const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
const darkButtons = (html) => html.match(/<button[^>]*btn--dark[^>]*>/g) ?? []

describe("C08 fin déclarée : carte « À confirmer »", () => {
  const html = render(detailOf("in_progress", { completion: DECLARED }))
  const card = section(html, "À confirmer")

  it("carte citron avec drapeau, titre, date et consigne de vérification", () => {
    expect(card).toContain("fup2__status--todo")
    expect(card).toMatch(/<span class="flag2">[\s\S]*À confirmer/)
    expect(card).not.toContain("flag2--neutre")
    expect(plain(card)).toContain("Sèna a terminé la mission")
    expect(plain(card)).toMatch(/Sèna indique avoir terminé le mer\. 7 oct\. Vérifiez/)
    expect(plain(card)).not.toContain("..")
    expect(plain(card)).toContain("Vérifiez le travail, puis confirmez la fin pour verser le paiement à Sèna.")
  })
  it("prénom absent : repli « L'étudiant » avec majuscule en tête de phrase", () => {
    const anon = section(render(detailOf("in_progress", { completion: DECLARED, selectedStudent: { ...student, fullName: "" } })), "À confirmer")
    expect(plain(anon)).toContain("L'étudiant a terminé la mission")
    expect(plain(anon)).toContain("L'étudiant indique avoir terminé le mer. 7 oct. Vérifiez")
    expect(plain(anon)).toContain("verser le paiement à l'étudiant.")
  })
  it("séquestre : texte selon la réserve, aucun versement ni délai automatique promis", () => {
    expect(plain(card)).toContain("Les fonds restent en séquestre jusqu'à votre validation : rien n'est versé automatiquement.")
    const noReserve = section(render(detailOf("in_progress", { completion: DECLARED, ledger: [] })), "À confirmer")
    expect(plain(noReserve)).toContain("Le paiement n'est versé qu'après votre validation.")
    expect(plain(noReserve)).not.toContain("séquestre")
    expect(plain(html)).not.toMatch(/\d\s?h\b|72|délai/i)
  })
  it("un seul bouton encre « Confirmer la fin » sur le bureau, dans la carte, pas dans le séquestre", () => {
    expect(card).toMatch(/<button[^>]*btn--dark[^>]*>[\s\S]*Confirmer la fin/)
    expect(section(html, "Séquestre")).not.toContain("<button")
    expect(section(html, "Séquestre")).toContain("Versé à Sèna")
    expect(darkButtons(html.replace(/<div class="mbar2">[\s\S]*$/, ""))).toHaveLength(1)
  })
  it("barre mobile inchangée, Signaler un problème et désaccord vers la messagerie", () => {
    expect(html).toMatch(/class="mbar2"[\s\S]*Discuter[\s\S]*Confirmer la fin/)
    expect(card).toContain('href="/contact?sujet=question"')
    expect(plain(card)).toContain("Un désaccord ? Écrivez à Sèna")
    expect(card).toContain('href="/client/messages/m1?studentId=s1"')
  })
  it("badge d'en-tête « À confirmer » en ton alerte, plus de carte « Mission en cours »", () => {
    const header = html.match(/<header>[\s\S]*?<\/header>/)[0]
    expect(header).toMatch(/badge--alerte[^>]*>[\s\S]*À confirmer/)
    expect(header).not.toContain("badge--bleu")
    expect(section(html, "Mission en cours")).toBeNull()
  })
  it("jamais « vous touchez », ni tiret cadratin", () => {
    expect(html).not.toMatch(/vous touchez/i)
    expect(html).not.toMatch(/[\u2013\u2014]/)
  })
  it("la modale C09 s'ouvre toujours avec confirmer=1, Libérer le paiement inchangé", () => {
    const open = render(detailOf("in_progress", { completion: DECLARED }), { ...FLAGS, confirmer: true })
    expect(open).toContain('role="dialog"')
    expect(open).toContain("Libérer le paiement")
  })
})

describe("C08 sans déclaration ou sans colonne : rendu actuel", () => {
  it.each([[{ available: true, declaredAt: null }], [{ available: false, declaredAt: null }], [undefined]])(
    "completion %j : carte « Mission en cours », bouton dans le séquestre, pas de carte « À confirmer »",
    (completion) => {
      const html = render(detailOf("in_progress", completion ? { completion } : {}))
      expect(section(html, "À confirmer")).toBeNull()
      expect(section(html, "Mission en cours")).toContain("flag2--neutre")
      expect(section(html, "Séquestre")).toMatch(/<button[^>]*btn--dark[^>]*>/)
      expect(html).toMatch(/badge--bleu[^>]*>[\s\S]*En cours/)
    },
  )
  it("colonne absente avec une date parasite : aucun état", () => {
    const html = render(detailOf("in_progress", { completion: { available: false, declaredAt: "2026-10-07T09:00:00Z" } }))
    expect(section(html, "À confirmer")).toBeNull()
    expect(section(html, "Séquestre")).toMatch(/<button/)
  })
})

describe("C08 chronologie datée", () => {
  const titles = (d) => buildTimeline(d, missionView(d), "Sèna").map((i) => [i.state, i.title])

  it("déclarée : en cours terminé, fin déclarée datée, validation en cours, fonds à venir", () => {
    const d = detailOf("in_progress", { completion: DECLARED })
    const items = buildTimeline(d, missionView(d), "Sèna")
    expect(items.map((i) => [i.state, i.title]).slice(2)).toEqual([
      ["done", "Mission en cours"],
      ["done", "Fin déclarée par Sèna"],
      ["current", "Votre validation de la fin"],
      ["todo", "Fonds versés à Sèna"],
    ])
    expect(items.find((i) => i.title === "Fin déclarée par Sèna").meta).toBe("7 oct. · 10:00")
  })
  it("non déclarée et colonne absente : étapes d'origine", () => {
    for (const extra of [{ completion: { available: true, declaredAt: null } }, {}]) {
      expect(titles(detailOf("in_progress", extra)).slice(2)).toEqual([
        ["current", "Mission en cours"],
        ["todo", "Votre validation de la fin"],
        ["todo", "Fonds versés à Sèna"],
      ])
    }
  })
  it("terminée avec date : « Fin déclarée par » avant la confirmation ; sans date : inchangé", () => {
    const withDate = titles(detailOf("done", { ledger: DONE_LEDGER, completion: DECLARED })).map((t) => t[1])
    expect(withDate.indexOf("Fin déclarée par Sèna")).toBeGreaterThan(-1)
    expect(withDate.indexOf("Fin déclarée par Sèna")).toBeLessThan(withDate.indexOf("Fin de mission confirmée par vous"))
    const without = titles(detailOf("done", { ledger: DONE_LEDGER, completion: { available: true, declaredAt: null } })).map((t) => t[1])
    expect(without.some((t) => t.startsWith("Fin déclarée"))).toBe(false)
  })
})

describe("C08 aucune écriture de déclaration", () => {
  it("la vue, la carte séquestre et la chronologie n'appellent pas l'action de déclaration", () => {
    const sources = ["../followup-view.jsx", "./escrow-card.jsx", "./timeline.jsx"]
      .map((f) => readFileSync(new URL(f, import.meta.url), "utf8"))
      .join("")
    expect(sources).not.toMatch(/declareMissionCompletion|completion_declared_at/)
  })
})
