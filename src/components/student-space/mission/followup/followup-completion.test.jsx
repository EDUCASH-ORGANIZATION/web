// @ds-screen RD-STUDENT-01
// E05 fin de mission (RD-DONE-01 ST-09) : rendu statique de la carte « Vous avez fini ? », de la barre mobile, de la
// modale ouverte par ?terminer=1 et de l'état « À confirmer ». Les interactions sont dans declare-end.dom.test.jsx.
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"

const declareMock = vi.fn()
vi.mock("@/lib/actions/application.actions", () => ({ apply: vi.fn() }))
vi.mock("@/lib/actions/mission-completion.actions", () => ({ declareMissionCompletion: (...a) => declareMock(...a) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/components/app-ui/toast", () => ({ useAppToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const { MissionFollowupView } = await import("../followup-view")
const { escrowSplit } = await import("@/lib/app/money")
const { formatFcfa } = await import("@/lib/app/format")

const DECLARED_AT = "2026-10-12T09:00:00Z"
const closed = { postuler: false, terminer: false, paymentsEnabled: false }
const open = { postuler: false, terminer: false, paymentsEnabled: true }
const client = { name: "Rosine H.", avatarUrl: null, city: "Cotonou", rating: 4.8, missionsPublished: 3, isVerified: true }
const col = (declaredAt = null) => ({ completion: { available: true, declaredAt } })
const detail = (status, over = {}, missionOver = {}) => ({
  state: "selected",
  mission: {
    id: "m1", title: "Cours de maths niveau 3e", description: "Deux soirs.", type: "Cours particuliers", city: "Cotonou",
    budget: 25000, urgency: "low", deadline: "2999-01-01", status, createdAt: "2026-09-30T10:14:00Z", ...missionOver,
  },
  client,
  application: { id: "a1", status: "accepted", message: "Hello", createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-02T18:02:00Z" },
  isSelected: true,
  verification: null,
  ledger: [],
  review: null,
  similar: [],
  ...over,
})
const render = (d, f) => renderToStaticMarkup(<MissionFollowupView detail={d} flags={f} />)
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/[\u202f\u00a0\s]+/g, " ")
const fcfa = (n) => formatFcfa(n).replace(/[\u202f\u00a0]/g, " ")
const release = [{ type: "release", amount: 22000, createdAt: "2026-10-20T10:00:00Z" }]
const BANNED = new RegExp(
  `(?<![\\p{L}])(tu|toi|ton|ta|tes)(?![\\p{L}])|72 ?h|[${String.fromCharCode(0x2013, 0x2014)}]`,
  "iu",
)

describe("E05 fin de mission : non déclarée", () => {
  it("carte « Vous avez fini ? », bouton dans la carte et dans la barre mobile, étape « Travail en cours »", () => {
    const html = render(detail("in_progress", col()), open)
    expect(html).toContain("Vous avez fini ?")
    expect((html.match(/J&#x27;ai terminé/g) ?? []).length).toBe(2)
    expect(html).toContain("e2-mbar")
    expect(html).toContain("Travail en cours")
    expect(html).toContain("Déclarez la fin quand c&#x27;est terminé")
    expect(html).toContain("Signaler un problème")
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain("À confirmer")
    expect(html).not.toContain("flag2")
  })

  it("paiements ouverts : séquestre cité, rien n'est versé automatiquement, part dans la barre", () => {
    const t = text(render(detail("in_progress", col()), open))
    expect(t).toContain(
      "Déclarez la mission terminée. Rosine confirme ensuite la fin : votre part reste en séquestre jusqu'à sa confirmation, rien n'est versé automatiquement.",
    )
    expect(t).toContain(`${fcfa(escrowSplit(25000).student)} Votre part (88 %) · en séquestre`)
  })

  it("paiements fermés : aucun séquestre, rien n'est versé avant la confirmation", () => {
    const t = text(render(detail("in_progress", col()), closed))
    expect(t).toContain("Déclarez la mission terminée. Rosine confirme ensuite la fin : rien n'est versé avant sa confirmation.")
    expect(t).not.toMatch(/séquestre|automatique/)
  })

  it("client anonyme : repli « Le client »", () => {
    const anonymous = { ...detail("in_progress", col()), client: { ...client, name: "Client EduCash" } }
    expect(text(render(anonymous, closed))).toContain("Déclarez la mission terminée. Le client confirme ensuite la fin")
  })

  it("budget invalide : la barre n'affiche aucun montant mais garde le bouton", () => {
    const html = render(detail("in_progress", col(), { budget: 0 }), open)
    expect(html).toContain("e2-mbar")
    expect(html).not.toContain("Votre part (88 %)")
    expect(html).not.toMatch(/NaN|undefined/)
  })
})

describe("E05 ?terminer=1", () => {
  it("ouvre la modale au rendu sans appeler l'action", () => {
    declareMock.mockClear()
    const html = render(detail("in_progress", col()), { ...open, terminer: true })
    const t = text(html)
    expect(html).toContain('role="dialog"')
    expect(t).toContain("Vous confirmez avoir terminé ?")
    expect(t).toContain("Cours de maths niveau 3e")
    expect(t).toContain("Oui, j'ai terminé")
    expect(t).toContain("Annuler")
    expect(t).toContain("Nous prévenons Rosine tout de suite.")
    expect(t).toContain("Statut À confirmer")
    expect(t).toContain("Rosine confirme la fin de mission")
    expect(t).toContain(`Votre part (88 %), versée après sa confirmation ${fcfa(escrowSplit(25000).student)}`)
    expect(declareMock).not.toHaveBeenCalled()
  })

  it("paiements fermés : la modale ne cite ni part ni séquestre", () => {
    const t = text(render(detail("in_progress", col()), { ...closed, terminer: true }))
    expect(t).toContain("Vous confirmez avoir terminé ?")
    expect(t).not.toMatch(/séquestre|Votre part \(88 %\), versée/)
  })

  it("drapeau absent ou faux : modale fermée", () => {
    expect(render(detail("in_progress", col()), open)).not.toContain('role="dialog"')
    expect(render(detail("in_progress", col()), undefined)).not.toContain('role="dialog"')
  })

  it("ne s'ouvre jamais si la fin est déclarée, la colonne absente, la mission terminée ou annulée", () => {
    const flags = { ...open, terminer: true }
    const cases = [
      detail("in_progress", col(DECLARED_AT)),
      detail("in_progress"),
      detail("in_progress", { completion: { available: false, declaredAt: null } }),
      detail("done", { ...col(DECLARED_AT), ledger: release }),
      detail("cancelled", col()),
    ]
    for (const d of cases) {
      const html = render(d, flags)
      expect(html).not.toContain('role="dialog"')
      expect(html).not.toContain("e2-mbar")
    }
  })
})

describe("E05 fin de mission : déclarée", () => {
  it("« À confirmer » daté, aucun bouton ni barre ni modale, étape travail faite", () => {
    const html = render(detail("in_progress", col(DECLARED_AT)), { ...open, terminer: true })
    const t = text(html)
    expect(html).not.toContain("<button")
    expect(html).not.toContain("e2-mbar")
    expect(html).not.toContain('role="dialog"')
    expect(t).not.toContain("J'ai terminé")
    expect(t).toContain("À confirmer")
    expect(t).toContain("Vous avez indiqué avoir terminé le 12 octobre 2026.")
    expect(t).toContain("Rosine doit maintenant confirmer la fin.")
    expect(t).toContain("Votre part reste en séquestre jusqu'à sa confirmation.")
    expect(t).toContain("Travail terminé")
    expect(t).toContain("Déclaré le 12 octobre 2026")
    expect(html).toContain('href="/contact?sujet=question"')
    expect(t).toContain("Contactez l'équipe EduCash")
  })

  it("étape paiement : attend la confirmation du prénom, séquestre cité seulement si les paiements sont ouverts", () => {
    const on = text(render(detail("in_progress", col(DECLARED_AT)), open))
    expect(on).toContain("Quand Rosine confirme la fin de la mission ; votre part reste en séquestre d'ici là")
    const off = text(render(detail("in_progress", col(DECLARED_AT)), closed))
    expect(off).toContain("Quand Rosine confirme la fin de la mission")
    expect(off).not.toContain("d'ici là")
  })

  it("paiements fermés : aucun séquestre", () => {
    const t = text(render(detail("in_progress", col(DECLARED_AT)), closed))
    expect(t).toContain("Rien n'est versé avant sa confirmation.")
    expect(t).not.toMatch(/séquestre/)
  })

  it("mission terminée datée : étape « Travail terminé » avant « Votre part est versée »", () => {
    const t = text(render(detail("done", { ...col(DECLARED_AT), ledger: release }), closed))
    expect(t.indexOf("Travail terminé")).toBeGreaterThan(-1)
    expect(t.indexOf("Travail terminé")).toBeLessThan(t.indexOf("Votre part est versée"))
  })
})

describe("E05 fin de mission : règles transversales", () => {
  it("aucune coordonnée du client, aucun tutoiement ni délai ni portefeuille, dans tous les états", () => {
    const withSecrets = (d) => ({ ...d, client: { ...d.client, email: "x@secret.test", phone: "+22997001122" } })
    for (const d of [detail("in_progress", col()), detail("in_progress", col(DECLARED_AT))]) {
      for (const f of [closed, open, { ...open, terminer: true }]) {
        const html = render(withSecrets(d), f)
        expect(html).not.toMatch(/@|\+229|97001122/)
        expect(text(html)).not.toMatch(BANNED)
        expect(text(html)).not.toMatch(/solde|retrait|portefeuille de/i)
        expect(text(html)).not.toMatch(/(?<!n'est versé )automatiquement/)
      }
    }
  })

  it("les sources n'importent ni confirmMission, ni callWalletRpc, ni le client service ; l'îlot est client", () => {
    for (const f of ["followup/declare-end.jsx", "followup/declare-copy.js", "followup-view.jsx"]) {
      const src = readFileSync(`src/components/student-space/mission/${f}`, "utf8")
      expect(src).not.toMatch(/confirmMission|callWalletRpc|createServiceClient|wallet-rpc/)
    }
    expect(readFileSync("src/components/student-space/mission/followup/declare-end.jsx", "utf8")).toMatch(/^"use client"/)
  })
})
