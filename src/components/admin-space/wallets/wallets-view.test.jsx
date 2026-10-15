import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }))

const { WalletsView } = await import("./wallets-view")

const U1 = "11111111-1111-4111-8111-111111111111"
const U2 = "22222222-2222-4222-8222-222222222222"
const NNBSP = " "

const wallet = (over = {}) => ({
  userId: U1,
  name: "Rosine Kpade",
  role: "student",
  balance: 66500,
  reserved: 54000,
  available: 12500,
  anomaly: null,
  ...over,
})

const data = (over = {}) => ({
  now: "2026-10-15T13:30:00.000Z",
  q: "",
  page: 1,
  pageSize: 25,
  total: 1,
  walletCount: 312,
  totals: { ok: true, circulation: 2418600, reserved: 185000, available: 2233600 },
  anomalies: { ok: true, total: 0, items: [] },
  rows: [wallet()],
  ...over,
})

const html = (el) => renderToStaticMarkup(el)

describe("WalletsView", () => {
  it("carte argent à trois montants, seule carte colorée, heure du calcul au Bénin", () => {
    const out = html(<WalletsView data={data()} />)
    expect((out.match(/<h1/g) ?? []).length).toBe(1)
    expect((out.match(/class="money2 /g) ?? []).length).toBe(1)
    expect(out).toContain("En circulation")
    expect(out).toContain("En séquestre")
    expect(out).toContain("Disponible")
    expect(out).toContain(`2${NNBSP}418${NNBSP}600`)
    expect(out).toContain("les 312 portefeuilles")
    expect(out).toContain("à 14:30")
    expect(out).toContain("Journal des transactions")
    expect(out).not.toContain("flag2")
  })

  it("anomalie : citron unique, solde négatif en tête, lien vers la fiche, autres comptés", () => {
    const anomalies = {
      ok: true,
      total: 3,
      items: [{ userId: U2, name: "Boutique Dossa", reason: "negative-balance", balance: -1500, reserved: 0 }],
    }
    const rows = [wallet({ userId: U2, name: "Boutique Dossa", balance: -1500, reserved: 0, available: -1500, anomaly: "negative-balance" })]
    const out = html(<WalletsView data={data({ anomalies, rows })} />)
    expect((out.match(/class="flag2"/g) ?? []).length).toBe(1)
    expect(out).toContain("Anomalies · 3 portefeuilles")
    expect(out).toContain("Boutique Dossa")
    expect(out).toContain("Solde négatif")
    expect(out).toContain(`−1${NNBSP}500`)
    expect(out).toContain(`/admin/users/${U2}`)
    expect(out).toContain("2 autres portefeuilles sont aussi à vérifier.")
    expect(out).not.toMatch(/Rembourser|Recréditer|Débloquer|Corriger/)
  })

  it("anomalie réservé supérieur au solde : texte dédié", () => {
    const anomalies = {
      ok: true,
      total: 1,
      items: [{ userId: U2, name: "Cabinet Agossou", reason: "reserved-over-balance", balance: 100, reserved: 900 }],
    }
    const out = html(<WalletsView data={data({ anomalies })} />)
    expect(out).toContain("Anomalie · 1 portefeuille")
    expect(out).toContain("réservés pour un solde de")
  })

  it("aucune anomalie : aucune carte d'anomalie", () => {
    expect(html(<WalletsView data={data()} />)).not.toContain('aria-label="Anomalie"')
  })

  it("rôles en français, portefeuille sans nom, solde négatif avec vrai signe moins", () => {
    const rows = [
      wallet({ role: "client" }),
      wallet({ userId: U2, name: "", role: "inconnu", balance: -1500, available: -1500, reserved: 0 }),
    ]
    const out = html(<WalletsView data={data({ rows, total: 2 })} />)
    expect(out).toContain("Client")
    expect(out).toContain("Compte sans nom")
    expect(out).toContain(`−1${NNBSP}500`)
    expect(out).not.toMatch(/>student<|>client<|>admin</)
  })

  it("accessibilité : recherche nommée, tableau nommé, lien de fiche nommé", () => {
    const out = html(<WalletsView data={data()} />)
    expect(out).toContain('role="search"')
    expect(out).toContain('aria-label="Rechercher un portefeuille"')
    expect(out).toContain('aria-label="Portefeuilles"')
    expect(out).toContain('aria-label="Fiche de Rosine Kpade"')
    expect((out.match(/scope="col"/g) ?? []).length).toBe(6)
  })

  it("recherche sans résultat, aucun portefeuille, totaux indisponibles, erreur de chargement", () => {
    const none = html(<WalletsView data={data({ rows: [], total: 0, q: "zzz" })} />)
    expect(none).toContain("Aucun portefeuille ne correspond à cette recherche.")
    expect(html(<WalletsView data={data({ rows: [], total: 0 })} />)).toContain("Aucun portefeuille pour le moment.")
    const partial = html(<WalletsView data={data({ totals: { ok: false }, anomalies: { ok: false } })} />)
    expect(partial).toContain("Lecture impossible pour le moment")
    expect(partial).toContain("Les anomalies n&#x27;ont pas pu être calculées")
    const failed = html(<WalletsView data={null} error="Les portefeuilles n'ont pas pu être chargés. Réessayez dans un instant." />)
    expect(failed).toContain('role="alert"')
    expect(failed).not.toContain("Aucun portefeuille")
  })

  it("pagination : recherche conservée", () => {
    const out = html(<WalletsView data={data({ total: 60, q: "Rosine", rows: [wallet()] })} />)
    expect(out).toMatch(/href="\/admin\/wallets\?q=Rosine&amp;page=2"/)
  })

  it("aucun texte interdit : prestataire, tiret cadratin, tutoiement", () => {
    const out = html(<WalletsView data={data()} />)
    expect(out).not.toMatch(/fedapay|\u2014|\u2013|\btu\b|\btoi\b/i)
  })
})
