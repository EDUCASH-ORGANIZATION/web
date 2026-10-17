import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { execFileSync } from "node:child_process"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/lib/actions/mission.actions", () => ({ confirmMission: vi.fn() }))

const { MissionFollowupView } = await import("../followup-view")
const { MissionHeader } = await import("../mission-header")
const { buildTimeline, formatDay } = await import("./timeline")
const { EscrowCard } = await import("./escrow-card")
const { missionView } = await import("@/lib/client-space/mission-view")

const student = {
  id: "s1", fullName: "Sèna Agossou", avatarUrl: null, city: "Cotonou", rating: 4.9, missionsDone: 23,
  isVerified: true, verifiedUntil: "2099-01-01", school: "IFRI", level: "Licence 2", skills: [],
}
const RESERVE = { type: "reserve", amount: 8000, createdAt: "2026-10-02T10:14:00Z" }
const DONE_LEDGER = [
  RESERVE,
  { type: "release", amount: 8000, createdAt: "2026-10-08T09:02:00Z" },
  { type: "commission", amount: 960, createdAt: "2026-10-08T09:02:00Z" },
]

function detailOf(status, mission = {}, extra = {}) {
  return {
    mission: {
      id: "m1", title: "Courses au marché", description: "x", type: "Livraison", city: "Cotonou", budget: 8000,
      urgency: "low", deadline: "2099-12-31", status, createdAt: "2026-10-02T10:14:00Z", selectedStudentId: "s1",
      purchasesEstimate: 15000, ...mission,
    },
    applications: [],
    selectedStudent: student,
    ledger: [RESERVE],
    review: null,
    ...extra,
  }
}
const OPEN = { confirmer: false, publiee: false, paymentsEnabled: true }
const CLOSED = { confirmer: false, publiee: false, paymentsEnabled: false }
const text = (html) => html.replaceAll("&#x27;", "'").replaceAll("&amp;", "&")
const render = (d, flags = OPEN) => text(renderToStaticMarkup(<MissionFollowupView detail={d} flags={flags} />))
const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
const section = (html, label) => {
  const m = html.match(new RegExp(`<section[^>]*aria-label="${label}"[\\s\\S]*?</section>`))
  return m ? m[0] : null
}
const num = (n) => new RegExp(String(n).replace(/(\d)(?=(\d{3})$)/, "$1[\\s\\u00a0\\u202f]"))

describe("ST-09 carte Séquestre : le service seulement", () => {
  it("budget 8000, estimation 15000 : 8 000 présent, ni 23 000 ni 15 000 dans la carte Séquestre", () => {
    const card = plain(section(render(detailOf("in_progress")), "Séquestre"))
    expect(card).toMatch(num(8000))
    expect(card).not.toMatch(num(23000))
    expect(card).not.toMatch(num(15000))
  })

  it.each([[0], [-5], [NaN], ["abc"], [Infinity], [null], [undefined], [""], [true]])(
    "estimation %s : pas de carte Achats pour votre compte, pas de NaN/undefined",
    (raw) => {
      const html = render(detailOf("in_progress", { purchasesEstimate: raw }))
      expect(html).not.toContain("Achats pour votre compte")
      expect(html).not.toMatch(/NaN|undefined|Infinity/)
      expect(html).toContain("Étudiant retenu")
    },
  )

  it.each([[null], [undefined], [NaN], ["x"], [-1]])("budget %s : jamais NaN ni undefined", (budget) => {
    for (const status of ["in_progress", "done"]) {
      const html = render(detailOf(status, { budget }, { ledger: status === "done" ? DONE_LEDGER : [RESERVE] }))
      expect(html).not.toMatch(/NaN|undefined/)
    }
  })

  it("estimation chaîne numérique valide '15000' : carte présente", () => {
    expect(render(detailOf("in_progress", { purchasesEstimate: "15000" }))).toContain("Achats pour votre compte")
  })
})

describe("ST-09 paiements fermés ou ouverts", () => {
  it("réserve existante : la carte achats évoque le séquestre, paiements ouverts ou fermés", () => {
    for (const flags of [OPEN, CLOSED]) {
      for (const status of ["in_progress", "done"]) {
        const html = render(detailOf(status, {}, { ledger: status === "done" ? DONE_LEDGER : [RESERVE] }), flags)
        expect(plain(section(html, "Achats pour votre compte"))).toMatch(/séquestre/i)
      }
    }
  })

  it("sans ligne reserve : la carte achats n'écrit pas « séquestre »", () => {
    for (const flags of [OPEN, CLOSED]) {
      const html = render(detailOf("in_progress", {}, { ledger: [] }), flags)
      expect(html).toContain("Achats pour votre compte")
      expect(plain(section(html, "Achats pour votre compte"))).not.toMatch(/séquestre/i)
    }
  })

  it("la note du Séquestre parle du service seul", () => {
    const note = plain(section(render(detailOf("in_progress"), CLOSED), "Séquestre").match(/<p class="note2">[\s\S]*?<\/p>/)[0])
    expect(note).not.toMatch(/séquestre/i)
    expect(note).toContain("pour le service seulement")
  })

  it("chronologie : « Publiée, X en séquestre » seulement avec une ligne reserve, paiements fermés ou ouverts", () => {
    for (const flags of [OPEN, CLOSED]) {
      expect(plain(section(render(detailOf("in_progress"), flags), "Chronologie"))).toMatch(/Publiée, 8\s000\sFCFA en séquestre/)
      const none = plain(section(render(detailOf("in_progress", {}, { ledger: [] }), flags), "Chronologie"))
      expect(none).toContain("Mission publiée")
      expect(none).not.toMatch(/séquestre/i)
    }
  })

  it("jamais « vous touchez » ni le net (88 %) côté client", () => {
    for (const flags of [OPEN, CLOSED]) {
      for (const status of ["in_progress", "done"]) {
        const html = plain(render(detailOf(status, {}, { ledger: status === "done" ? DONE_LEDGER : [RESERVE] }), flags))
        expect(html).not.toMatch(/vous touchez/i)
        expect(html).not.toMatch(/88\s?%/)
      }
    }
  })

  it("« Coût total » absent partout sur C11 (terminée, notée ou non, annulée)", () => {
    const rated = { rating: 5, comment: "Super", createdAt: "2026-10-09T00:00:00Z" }
    for (const d of [
      detailOf("done", {}, { ledger: DONE_LEDGER }),
      detailOf("done", {}, { ledger: DONE_LEDGER, review: rated }),
      detailOf("done", { purchasesEstimate: null }, { ledger: DONE_LEDGER }),
      detailOf("cancelled", {}, { ledger: [] }),
    ]) {
      for (const flags of [OPEN, CLOSED]) expect(render(d, flags)).not.toMatch(/Coût total/i)
    }
  })
})

describe("ST-09 mission annulée et purchasesLine", () => {
  it("annulée : la ligne d'achats de l'en-tête est conservée, aucune carte achats", () => {
    const html = render(detailOf("cancelled", {}, { ledger: [] }))
    expect(html).toMatch(/Achats estimés : environ 15\s000/)
    expect(html).not.toContain("Achats pour votre compte")
  })

  it("en cours et terminée : pas de ligne d'achats provisoire dans l'en-tête", () => {
    for (const status of ["in_progress", "done"]) {
      expect(render(detailOf(status, {}, { ledger: DONE_LEDGER }))).not.toContain("Achats estimés")
    }
  })

  const header = (props) =>
    text(renderToStaticMarkup(
      <MissionHeader mission={detailOf("open").mission} status={{ label: "Ouverte", tone: "neutre" }} {...props} />,
    ))
  it("purchasesLine : défaut vrai (C04 inchangé), faux masque la ligne", () => {
    expect(header({})).toContain("Achats estimés")
    expect(header({ purchasesLine: true })).toContain("Achats estimés")
    expect(header({ purchasesLine: false })).not.toContain("Achats estimés")
  })
})

describe("ST-09 chronologie", () => {
  const timelineOf = (d) => {
    const view = missionView(d)
    return buildTimeline(d, view, "Sèna")
  }
  it("étapes fusionnées « Publiée, X FCFA en séquestre » et plus de « Mission publiée » séparée", () => {
    const items = timelineOf(detailOf("in_progress"))
    expect(items[0].title).toMatch(/^Publiée, 8\s000\sFCFA en séquestre$/)
    expect(items.filter((i) => /Mission publiée|placés en séquestre/.test(i.title))).toHaveLength(0)
  })

  it("sans réservation au grand livre : « Mission publiée »", () => {
    const items = timelineOf(detailOf("in_progress", {}, { ledger: [] }))
    expect(items[0].title).toBe("Mission publiée")
  })

  it("« Avis à laisser » seulement pour une mission terminée non notée", () => {
    const rated = { rating: 4, comment: "ok", createdAt: "2026-10-09T00:00:00Z" }
    const titles = (d) => timelineOf(d).map((i) => i.title)
    expect(titles(detailOf("done", {}, { ledger: DONE_LEDGER }))).toContain("Avis à laisser")
    expect(titles(detailOf("done", {}, { ledger: DONE_LEDGER, review: rated }))).not.toContain("Avis à laisser")
    expect(titles(detailOf("in_progress"))).not.toContain("Avis à laisser")
    expect(titles(detailOf("cancelled", {}, { ledger: [RESERVE] }))).not.toContain("Avis à laisser")
  })
})

describe("ST-09 structure", () => {
  it("un seul h1 dans chaque état, avec ou sans achats", () => {
    for (const status of ["in_progress", "done", "cancelled"]) {
      for (const purchasesEstimate of [15000, null]) {
        const html = render(detailOf(status, { purchasesEstimate }, { ledger: DONE_LEDGER }))
        expect(html.match(/<h1/g)).toHaveLength(1)
      }
    }
  })

  it("terminée avec achats : Reçu du service ; sans achats : Reçu", () => {
    expect(render(detailOf("done", {}, { ledger: DONE_LEDGER }))).toContain('aria-label="Reçu du service"')
    const plainReceipt = render(detailOf("done", { purchasesEstimate: null }, { ledger: DONE_LEDGER }))
    expect(plainReceipt).toContain('aria-label="Reçu"')
    expect(plainReceipt).not.toContain("Reçu du service")
  })
})

describe("ST-09 dates de la note de blocage", () => {
  it("la date vient de la donnée réelle (ledger reserve), pas d'une date en dur", () => {
    const a = plain(render(detailOf("in_progress", {}, { ledger: [{ ...RESERVE, createdAt: "2026-03-05T10:00:00Z" }] })))
    const b = plain(render(detailOf("in_progress", {}, { ledger: [{ ...RESERVE, createdAt: "2026-07-21T10:00:00Z" }] })))
    expect(a).toMatch(/Bloqué le 5 mars pour le service seulement/)
    expect(b).toMatch(/Bloqué le 21 juil\.? pour le service seulement/)
  })

  it.each([[""], ["pas une date"], [null], [undefined], ["2026-13-45"]])("date absente ou invalide %j : pas d'Invalid Date", (createdAt) => {
    const html = plain(render(detailOf("in_progress", {}, { ledger: [{ ...RESERVE, createdAt }] })))
    expect(html).not.toMatch(/Invalid Date|NaN|undefined/)
    expect(html).toContain("Bloqué pour le service seulement")
  })

  it("sans ligne reserve : pas d'Invalid Date non plus", () => {
    const html = plain(render(detailOf("in_progress", {}, { ledger: [] })))
    expect(html).not.toMatch(/Invalid Date|NaN|undefined/)
  })

  it("formatDay renvoie une chaîne vide pour une date invalide", () => {
    expect(formatDay("n'importe quoi")).toBe("")
    expect(formatDay(undefined)).toBe("")
  })

  it("EscrowCard sans achats garde l'ancienne note, avec achats sans since garde « Bloqué pour »", () => {
    const split = { total: 8000, commission: 960, student: 7040 }
    const base = text(renderToStaticMarkup(<EscrowCard split={split} studentName="Sèna" onConfirm={() => {}} />))
    expect(base).toContain("Les fonds ne sont versés qu'après votre validation")
    const w = text(renderToStaticMarkup(<EscrowCard split={split} studentName="Sèna" onConfirm={() => {}} withPurchases />))
    expect(w).toContain("Bloqué pour le service seulement")
  })
})

describe("ST-09 zones intactes", () => {
  it("confirmMission : diff vide ; ConfirmEndDialog : la libération (releaseOnce, confirmMission, libellé) n'est pas modifiée", () => {
    const run = (args) => execFileSync("git", args, { encoding: "utf8", cwd: process.cwd() })
    expect(run(["diff", "--name-only", "origin/main...HEAD", "--", "src/lib/actions/mission.actions.js"]).trim()).toBe("")
    // RD-ACHATS-01 (ST-14) ajoute l'avertissement et la liste des achats à la modale : seules des lignes de
    // libération modifiées ou retirées feraient échouer ce garde.
    const dialogDiff = run(["diff", "-U0", "origin/main...HEAD", "--", "src/components/client-space/mission-detail/followup/confirm-end-dialog.jsx"])
    const touched = dialogDiff.split("\n").filter((l) => /^[-+](?![-+])/.test(l) && /releaseOnce|confirmMission|Libérer le paiement/.test(l))
    const removed = touched.filter((l) => l.startsWith("-"))
    expect(removed).toEqual([])
  })

  it("le libellé « Libérer le paiement » reste dans la modale", async () => {
    const { readFileSync } = await import("node:fs")
    expect(readFileSync("src/components/client-space/mission-detail/followup/confirm-end-dialog.jsx", "utf8")).toContain("Libérer le paiement")
  })
})

describe("ST-13 demandes de paiement : chronologie, bouton et séquestre inchangés", () => {
  const PENDING = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", seq: 1, status: "pending", version: 1, amount: 6200,
    vendorName: "Boutique Sœur Odile", items: null, payeeKind: "merchant", payeeNumber: "123456",
  }
  const withRequests = (requests, extra = {}) => ({
    ...detailOf("in_progress", {}, extra),
    purchases: {
      available: true, requests,
      totals: { count: requests.length, requested: 6200, paid: 0, pending: 6200, reported: 0 },
      exceedsEstimate: false, confirmWarning: { show: true, pending: 1, reported: 0 }, costTotal: null,
    },
  })
  const titles = (d) => buildTimeline(d, missionView(d), "Sèna").map((i) => i.title)

  it("sans demande : la chronologie reste celle de RD-DONE-01", () => {
    expect(titles(detailOf("in_progress"))).toContain("Mission en cours")
    expect(titles({ ...detailOf("in_progress"), purchases: { available: false } })).toContain("Mission en cours")
  })

  it("avec une demande : l'étape en cours devient Achats en cours avec le résumé", () => {
    const d = withRequests([PENDING])
    expect(titles(d)).toContain("Achats en cours")
    expect(titles(d)).not.toContain("Mission en cours")
    const item = buildTimeline(d, missionView(d), "Sèna").find((i) => i.title === "Achats en cours")
    expect(item.meta).toBe("1 en attente")
  })

  it("le séquestre n'affiche aucun montant de demande, avec ou sans paiements ouverts", () => {
    for (const flags of [OPEN, CLOSED]) {
      const html = render(withRequests([PENDING]), flags)
      expect(plain(section(html, "Séquestre"))).not.toMatch(/6\s200/)
      expect(plain(section(html, "Séquestre"))).toMatch(/8\s000/)
    }
  })

  it("l'unique bouton encre est Ouvrir la demande ; la barre du bas garde Confirmer la fin en contour actif", () => {
    const html = render(withRequests([PENDING]))
    expect(html.match(/class="btn btn--dark[^"]*"/g)).toHaveLength(1)
    const bar = html.slice(html.indexOf('class="mbar2"'))
    expect(bar).toMatch(/<button[^>]*btn--soft[^>]*>[^]*Confirmer la fin/)
    expect(bar).not.toMatch(/disabled/)
  })
})

describe("ST-13 EscrowCard : prop confirmTone", () => {
  const split = { total: 8000, commission: 960, student: 7040 }
  const html = (props) => renderToStaticMarkup(<EscrowCard split={split} studentName="Sèna" onConfirm={() => {}} {...props} />)

  it("absente : bouton encre comme avant", () => {
    expect(html({})).toMatch(/<button[^>]*btn btn--dark btn--block[^>]*>/)
  })

  it("soft : bouton en contour, actif", () => {
    const out = html({ confirmTone: "soft" })
    expect(out).toMatch(/<button[^>]*btn btn--soft btn--block[^>]*>/)
    expect(out).not.toMatch(/btn--dark|disabled/)
  })

  it("valeur inconnue : retombe sur l'encre", () => {
    expect(html({ confirmTone: "x" })).toContain("btn--dark")
  })

  it("sans onConfirm : aucun bouton", () => {
    expect(html({ onConfirm: undefined, confirmTone: "soft" })).not.toContain("Confirmer la fin")
  })
})
