import { describe, it, expect, vi } from "vitest"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { StudentApplicationsView } = await import("./applications-view")
const { netAmount } = await import("@/lib/constants/missions")

const COUNTS = { "en-attente": 0, "en-cours": 0, terminees: 0, "non-retenues": 0 }
const row = (over) => ({
  id: "a1", missionId: "m1", title: "Cours de maths", type: "Cours particuliers", city: "Cotonou", budget: 25000, net: 22000,
  deadline: "2026-10-30", missionStatus: "open", status: "pending", appliedAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z", clientName: "Rosine H.", clientFirst: "Rosine", review: null, ...over,
})
const highlight = (over) => ({
  missionId: "m9", title: "Livraison", city: "Ganhi", deadline: "2026-10-09", net: 5280,
  clientName: "Nadège K.", clientFirst: "Nadège", acceptedAt: "2026-10-07T17:40:00+01:00", ...over,
})
const data = (over) => ({ tab: "en-attente", counts: COUNTS, total: 1, rows: [row()], escrow: { total: 0, count: 0 }, highlight: null, ...over })
const NOW = new Date("2026-10-08T14:32:00+01:00")
const render = (d, props = {}) =>
  renderToStaticMarkup(<StudentApplicationsView result={{ data: d }} now={NOW} paymentsEnabled {...props} />).replace(/[  ]/g, " ")
const BAD = /NaN|Invalid Date|undefined|\[object/
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'")

describe("Répondre à <prénom>", () => {
  const unread = { m1: { at: "2026-10-08T09:12:00+01:00", state: "candidate" } }

  it("présent seulement si la mission est dans unreadByMission", () => {
    expect(render(data(), { unreadByMission: unread })).toContain("Répondre à Rosine")
    expect(render(data(), { unreadByMission: {} })).not.toContain("Répondre")
    expect(render(data(), { unreadByMission: { autre: { at: "2026-10-08T09:12:00+01:00", state: "candidate" } } })).not.toContain("Répondre")
    expect(render(data())).not.toContain("Répondre")
    expect(render(data(), { unreadByMission: null })).not.toContain("Répondre")
  })

  it("prénom absent, vide ou espaces : pas de « Répondre » ni d'undefined", () => {
    for (const clientFirst of [undefined, null, ""]) {
      const html = render(data({ rows: [row({ clientFirst })] }), { unreadByMission: unread })
      expect(html).not.toContain("Répondre")
      expect(html).not.toMatch(BAD)
    }
  })

  it("prénom de 200 caractères : libellé neutre, pas de débordement", () => {
    const long = "A".repeat(200)
    const html = render(data({ rows: [row({ clientFirst: long })] }), { unreadByMission: unread })
    expect(html).toContain("Répondre au client")
    expect(html).not.toContain("Répondre à AAAA")
  })

  it("balises HTML, guillemets et % : échappés, jamais injectés", () => {
    for (const clientFirst of ["<script>x</script>", '"><img src=x onerror=1>', "100%", "O'Neil"]) {
      const html = render(data({ rows: [row({ clientFirst, clientName: clientFirst })] }), { unreadByMission: unread })
      expect(html).not.toContain("<script>")
      expect(html).not.toContain("<img src=x")
      expect(html).not.toMatch(/aria-label="[^"]*"[^>]*onerror/)
      expect(html).not.toMatch(BAD)
    }
    const html = render(data({ rows: [row({ clientFirst: "<b>Z</b>" })] }), { unreadByMission: unread })
    expect(html).toContain("&lt;b&gt;")
    // Prénom injecté dans la carte retenue
    const hl = render(data({ highlight: highlight({ clientFirst: "<script>", clientName: "<script>a</script>", title: "<script>t</script>" }) }))
    expect(hl).not.toContain("<script>")
  })
})

describe("heures", () => {
  const unreadAt = (at) => ({ m1: { at, state: "candidate" } })

  it("date du non lu invalide, absente ou nulle : « Message non lu de <prénom> », jamais de jour ni d'heure inventés", () => {
    for (const at of ["pas une date", "", undefined, null, "2026-13-45T99:99:00Z"]) {
      const html = render(data(), { unreadByMission: unreadAt(at) })
      expect(html).not.toMatch(BAD)
      expect(html).toContain("Message non lu de Rosine")
      expect(html).not.toContain("vous a écrit")
      expect(html).toContain("Répondre à Rosine")
    }
  })

  it("heure dans le futur, de la veille ou vieille de plus d'un an : texte propre", () => {
    for (const at of ["2027-01-01T10:00:00+01:00", "2026-10-07T23:59:00+01:00", "2025-01-01T10:00:00+01:00"]) {
      const html = render(data(), { unreadByMission: unreadAt(at) })
      expect(html).not.toMatch(BAD)
      expect(text(html)).toMatch(/Rosine vous a écrit (aujourd'hui|hier|le .+) à \d{1,2}:\d{2}/)
    }
  })

  it("carte retenue : acceptedAt invalide, absent, futur, veille, ancien", () => {
    const cases = {
      "n'importe quoi": /Retenue(?! )/,
      "": /Retenue(?! )/,
      "2026-10-07T17:40:00+01:00": /Retenue hier 17:40/,
      "2026-10-08T09:12:00+01:00": /Retenue aujourd'hui 9:12/,
      "2027-03-01T10:00:00+01:00": /Retenue le .+ 10:00/,
      "2024-01-01T10:00:00+01:00": /Retenue le .+ 10:00/,
    }
    for (const [acceptedAt, expected] of Object.entries(cases)) {
      const html = render(data({ highlight: highlight({ acceptedAt }) }))
      expect(html).not.toMatch(BAD)
      expect(text(html)).toMatch(expected)
    }
    expect(render(data({ highlight: highlight({ acceptedAt: undefined }) }))).not.toMatch(BAD)
    expect(render(data({ highlight: highlight({ acceptedAt: null }) }))).not.toMatch(BAD)
  })

  it("fuseau Bénin (UTC+1) : 23:30 UTC s'affiche à 00:30 le lendemain", () => {
    const now = new Date("2026-10-09T10:00:00+01:00")
    const html = render(data({ highlight: highlight({ acceptedAt: "2026-10-08T23:30:00Z" }) }), { now })
    expect(text(html)).toMatch(/Retenue aujourd'hui 0:30/)
    // Vue de la veille : à 22:30 UTC la veille, l'heure béninoise est 23:30, jour d'avant
    const veille = render(data({ highlight: highlight({ acceptedAt: "2026-10-08T22:30:00Z" }) }), { now })
    expect(text(veille)).toMatch(/Retenue hier 23:30/)
    const note = render(data(), { now, unreadByMission: { m1: { at: "2026-10-08T23:30:00Z", state: "candidate" } } })
    expect(text(note)).toContain("Rosine vous a écrit aujourd'hui à 0:30")
  })
})

describe("montants", () => {
  it("budget absent, 0, négatif, NaN, chaîne : pas de montant ni de budget", () => {
    for (const bad of [undefined, null, 0, -5, Number.NaN, "25000", "abc", Infinity]) {
      const html = render(data({ rows: [row({ budget: bad, net: bad })] }))
      expect(html).not.toMatch(BAD)
      expect(html).not.toContain("e2-04-gain")
      expect(html).not.toContain("votre part")
    }
  })

  it("net valide mais budget invalide : montant sans « budget »", () => {
    const html = render(data({ rows: [row({ budget: Number.NaN })] }))
    expect(html).toContain("22 000")
    expect(html).not.toContain("budget")
    expect(html).not.toMatch(BAD)
  })

  it("« séquestre » absent quand paymentsEnabled est faux (toutes les vues)", () => {
    const rows = [row({ status: "accepted", missionStatus: "in_progress" })]
    const d = data({
      tab: "en-cours", counts: { ...COUNTS, "en-cours": 1 }, rows, escrow: { total: 22000, count: 1 }, highlight: highlight(),
    })
    expect(render(d, { paymentsEnabled: false })).not.toMatch(/séquestre/i)
    expect(render({ ...d, tab: "en-attente" }, { paymentsEnabled: false })).not.toMatch(/séquestre/i)
    expect(render(d, { paymentsEnabled: true })).toMatch(/séquestre/)
    expect(render({ ...d, tab: "en-attente" }, { paymentsEnabled: true })).toMatch(/séquestre/)
  })

  it("part 88 % : affichée depuis netAmount(), jamais un 0.12 en dur", () => {
    expect(netAmount(25000)).toBe(22000)
    const html = render(data({ rows: [row({ net: netAmount(25000) })], highlight: highlight() }))
    expect(html).toContain("22 000")
    expect(html).toContain("88 %")
    const src = readFileSync(new URL("./applications-view.jsx", import.meta.url), "utf8")
    expect(src).not.toMatch(/0\.12|0\.88|\b12\s*%|\b88\s*%/)
    const hl = render(data({ highlight: highlight({ net: 0 }) }))
    expect(hl).not.toMatch(BAD)
    expect(hl).not.toContain("sont bloqués")
  })
})

describe("onglets", () => {
  const withCounts = (n) => ({ "en-attente": n, "en-cours": n, terminees: n, "non-retenues": n })

  it("compteurs pour 0, 1 et 100 candidatures", () => {
    const zero = render(data({ counts: COUNTS, total: 0, rows: [] }))
    expect(zero).not.toMatch(/<b>\d+<\/b>/)
    const one = render(data({ counts: withCounts(1), total: 4 }))
    expect(one.match(/<b>1<\/b>/g)).toHaveLength(4)
    const hundred = render(data({ counts: withCounts(100), total: 400 }))
    expect(hundred.match(/<b>100<\/b>/g)).toHaveLength(4)
    expect(hundred).not.toMatch(BAD)
  })

  it("onglet actif : exactement un aria-current, liens ?onglet=", () => {
    for (const tab of ["en-attente", "en-cours", "terminees", "non-retenues"]) {
      const html = render(data({ tab, rows: [] }))
      expect(html.match(/aria-current="page"/g)).toHaveLength(1)
      expect(html).toMatch(new RegExp(`href="/applications\\?onglet=${tab}"[^>]*aria-current|aria-current="page"[^>]*>`))
    }
  })
})

describe("confidentialité et libellés", () => {
  const leaky = {
    email: "client@secret.test", phone: "+22997000000", client_id: "c-uuid-123", clientId: "c-uuid-123", clientEmail: "client@secret.test",
    clientPhone: "+22997000000",
  }
  it("jamais l'e-mail, le téléphone ni l'identifiant du client (rendu et liens)", () => {
    const d = data({
      tab: "en-cours", counts: { ...COUNTS, "en-cours": 1 }, rows: [row({ ...leaky, status: "accepted", missionStatus: "in_progress" })],
      highlight: highlight(leaky),
    })
    const html = render(d, { unreadByMission: { m1: { at: "2026-10-08T09:12:00+01:00", state: "candidate" } } })
    expect(html).not.toMatch(/client@secret|secret\.test|22997000000|c-uuid-123|mailto:|tel:/)
    for (const href of html.match(/href="[^"]*"/g)) expect(href).not.toMatch(/c-uuid|@|\+229/)
  })

  it("aucun « Retirer » ni « retirées », un seul h1, sur tous les onglets", () => {
    for (const tab of ["en-attente", "en-cours", "terminees", "non-retenues"]) {
      for (const rows of [[], [row({ status: "accepted", missionStatus: "done" }), row({ id: "a2", missionId: null })]]) {
        const html = render(data({ tab, rows, highlight: highlight() }), { unreadByMission: { m1: { at: "2026-10-08T09:12:00+01:00", state: "candidate" } } })
        expect(html).not.toMatch(/Retirer|retirées/)
        expect(html.match(/<h1\b/g)).toHaveLength(1)
      }
    }
  })

  it("mission supprimée : jamais « retirées » au pluriel", () => {
    const html = render(data({ tab: "non-retenues", rows: [row({ missionId: null })] }))
    expect(html).not.toMatch(/retirées/)
  })

  it("état d'erreur : un seul h1, aucune exception", () => {
    const html = renderToStaticMarkup(<StudentApplicationsView result={{ error: "x" }} now={NOW} />)
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(renderToStaticMarkup(<StudentApplicationsView />)).toContain("Impossible de charger")
  })
})
