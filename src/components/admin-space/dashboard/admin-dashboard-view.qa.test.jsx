import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), unstable_rethrow: () => {} }))

const { AdminDashboardView, buildDashboardModel } = await import("./admin-dashboard-view")

const NOW = "2026-10-15T10:00:00.000Z"
const ok = (extra = {}) => ({ ok: true, ...extra })
const base = (over = {}) => ({
  now: NOW,
  today: "2026-10-15",
  alerts: ok({ items: [], total: 0 }),
  withdrawals: ok({ total: 0, items: [] }),
  dossiers: ok({ dossiers: [], total: 0 }),
  escrow: ok({ total: 125000, fundedMissions: 3 }),
  commissions: ok({ month: "2026-10", total: 4800 }),
  missions: ok({ published: 12, filled: 5 }),
  recent: ok({ users: [] }),
  ...over,
})
const html = (props) => renderToStaticMarkup(<AdminDashboardView {...props} />)
const dossier = (n, name = `Etudiant ${n}`) => ({ userId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, name, submittedAt: `2026-10-0${n}T10:00:00Z` })

describe("QA AdminDashboardView", () => {
  it("file vide et complète : « Tout est à jour », aucun libellé d'alerte d'argent", () => {
    const out = html({ data: base(), firstName: "Awa" })
    expect(out).toContain("Bonjour, Awa")
    expect(out).toContain("Tout est à jour")
    expect(out).not.toContain("Priorité haute")
    expect(out).not.toContain("Ensuite dans la file")
  })
  it("file vide mais un bloc en erreur : jamais « Tout est à jour »", () => {
    const out = html({ data: base({ dossiers: { ok: false } }), firstName: "Awa" })
    expect(out).not.toContain("Tout est à jour")
    expect(out).toContain("n&#x27;a pas pu être calculée en entier")
    expect(out).toContain("Une partie des données n&#x27;a pas pu être chargée")
  })
  it("les six blocs en erreur : la page rend, sans exception, sans chiffre inventé", () => {
    const off = { ok: false }
    const out = html({ data: base({ alerts: off, withdrawals: off, dossiers: off, escrow: off, commissions: off, missions: off, recent: off }) })
    expect(out).toContain("Indisponible")
    expect(out).not.toContain("125")
  })
  it("erreur de chargement global : message, aucune donnée", () => {
    const out = html({ error: "Les données n'ont pas pu être chargées.", firstName: "Awa" })
    expect(out).toContain("n&#x27;a pas pu être chargé")
    expect(html({ data: null })).toContain("Bonjour")
  })
  it("alerte d'argent : citron « Priorité haute · argent » ; dossiers seuls : étiquette Vérification", () => {
    const money = html({ data: base({ alerts: ok({ items: [{ reason: "negative-balance", userId: "u1", name: "Koffi", balance: -500, reserved: 0, gap: 500 }], total: 1 }) }) })
    expect(money).toContain("Priorité haute")
    const verif = html({ data: base({ dossiers: ok({ dossiers: [dossier(1)], total: 1 }) }) })
    expect(verif).not.toContain("Priorité haute")
    expect(verif).toContain("Vérification")
  })
  it("noms hostiles : le HTML est échappé ; nom absent : « Compte sans nom »", () => {
    const out = html({ data: base({ dossiers: ok({ dossiers: [dossier(1, "<img src=x onerror=alert(1)>"), dossier(2, "")], total: 2 }) }), firstName: "<b>x</b>" })
    expect(out).not.toContain("<img src=x")
    expect(out).not.toContain("<b>x</b>")
    expect(out).toContain("Compte sans nom")
  })
  it("total exact fourni par le serveur même si la liste est tronquée (10 affichés sur 37)", () => {
    const dossiers = Array.from({ length: 9 }, (_, i) => dossier(i + 1))
    const model = buildDashboardModel(base({ dossiers: ok({ dossiers, total: 37 }) }))
    expect(model.dossierCount).toBe(37)
    expect(model.total).toBe(37)
    expect(model.queue).toHaveLength(9)
  })
  it("liste « Ensuite dans la file » bornée à 6 éléments", () => {
    const dossiers = Array.from({ length: 9 }, (_, i) => dossier(i + 1))
    const out = html({ data: base({ dossiers: ok({ dossiers, total: 9 }) }) })
    expect(out.match(/Examiner</g)?.length ?? 0).toBeLessThanOrEqual(6)
    expect(out).toContain("Voir toute la file")
  })
  it("textes : aucun tiret cadratin ni demi-cadratin, pas de tutoiement, prestataire non nommé, une seule carte argent", () => {
    const out = html({
      data: base({
        alerts: ok({ items: [{ reason: "reserved-over-balance", userId: "u1", name: "Koffi", balance: 10, reserved: 90, gap: 80 }], total: 1 }),
        withdrawals: ok({ total: 1, items: [{ id: "w1", userId: "u2", name: "Awa", amount: 5000, createdAt: "2026-10-10T00:00:00Z" }] }),
        dossiers: ok({ dossiers: [dossier(1)], total: 1 }),
      }),
      firstName: "Awa",
    })
    expect(out).not.toMatch(new RegExp(String.fromCharCode(91, 0x2013, 0x2014, 93)))
    expect(out).not.toMatch(/fedapay|kkiapay|stripe|paypal/i)
    expect(out.match(/money2 money2--split/g)).toHaveLength(1)
    expect(out).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
  })
  it("montants en francs CFA : séquestre et commissions affichés depuis les données, jamais en dur", () => {
    const a = html({ data: base({ escrow: ok({ total: 987654, fundedMissions: 1 }), commissions: ok({ month: "2026-11", total: 1234 }) }) })
    expect(a).toMatch(/987\s?654/)
    expect(a).toContain("de novembre")
    expect(a).toContain("1 mission financée")
    const b = html({ data: base({ commissions: ok({ month: "2026-10", total: 0 }) }) })
    expect(b).toContain("d&#x27;octobre")
  })
  it("pas d'URL de style local ni de couleur en dur dans le rendu", () => {
    const out = html({ data: base() })
    expect(out).not.toMatch(/style=|#[0-9a-f]{6}\b/i)
  })
})
