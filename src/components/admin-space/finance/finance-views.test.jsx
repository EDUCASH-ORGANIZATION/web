import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }))

const { TransactionsView, periodLabel } = await import("./transactions-view")
const { TransactionsTable, TransactionDetail, movementAmount } = await import("./transactions-table")
const { WithdrawalsView } = await import("./withdrawals-view")
const { Pager } = await import("./pager")

const U1 = "11111111-1111-4111-8111-111111111111"
const M1 = "22222222-2222-4222-8222-222222222222"
const NOW = "2026-10-15T10:00:00.000Z"
const NBSP = " "
const NNBSP = " "

const row = (over = {}) => ({
  id: "t-000001",
  userId: U1,
  name: "Rosine Kpade",
  type: "deposit",
  amount: 12500,
  balanceAfter: 12500,
  missionId: null,
  reference: "FDP-8K2M44",
  isReversal: false,
  operator: null,
  createdAt: "2026-10-08T12:02:00Z",
  ...over,
})

const txData = (over = {}) => ({
  now: NOW,
  type: "",
  periode: "mois",
  q: "",
  page: 1,
  pageSize: 25,
  total: 1,
  rows: [row()],
  stats: {
    deposits: { ok: true, total: 1240000, count: 212 },
    commissions: { ok: true, total: 48300 },
    released: { ok: true, total: 354200 },
  },
  ...over,
})

const html = (el) => renderToStaticMarkup(el)
const wdRow = (over = {}) => ({
  id: "w-1",
  userId: U1,
  name: "Sèna Agossou",
  amount: 15000,
  operator: "MTN MoMo",
  reference: null,
  createdAt: "2026-10-14T14:00:00Z",
  status: "stuck",
  ...over,
})
const wdData = (over = {}) => ({
  now: NOW,
  page: 1,
  pageSize: 25,
  total: 1,
  rows: [wdRow()],
  stats: { undebitedTransfer: { open: 1, stuck: 1, amount: 15000, oldestAt: "2026-10-14T14:00:00Z" }, reversed: 0, created: 0 },
  ...over,
})

const FORBIDDEN = /fedapay|\u2014|\u2013|\btu\b|\btoi\b|\bton\b|\bta\b|\btes\b|livraison/i

describe("TransactionsView", () => {
  it("titre unique, trois indicateurs, tableau, filtres, note de lecture seule", () => {
    const out = html(<TransactionsView data={txData()} />)
    expect((out.match(/<h1/g) ?? []).length).toBe(1)
    expect(out).toContain("Volume rechargé")
    expect(out).toContain("Commissions")
    expect(out).toContain("Versé aux étudiants")
    expect(out).toContain(`1${NNBSP}240${NNBSP}000`)
    expect(out).toContain("212 opérations")
    expect(out).toContain("Réf. paiement")
    expect(out).toContain("FDP-8K2M44")
    expect(out).toContain("lecture seule")
    expect(out).toContain('role="search"')
    expect(out).toContain('aria-label="Rechercher par référence de paiement"')
    expect(out).not.toMatch(FORBIDDEN)
  })

  it("aucune carte colorée sur cet écran, aucun bouton d'action d'argent", () => {
    const out = html(<TransactionsView data={txData()} />)
    expect(out).not.toContain("money2")
    expect(out).not.toMatch(/Rembourser|Recréditer|Libérer|Annuler/)
  })

  it("montant : vrai signe moins pour un retrait, plus pour une recharge, valeur absolue d'un négatif", () => {
    expect(movementAmount(row({ type: "deposit", amount: 500 }))).toBe(`+500${NBSP}FCFA`)
    expect(movementAmount(row({ type: "withdrawal", amount: -2500 }))).toBe(`−2${NNBSP}500${NBSP}FCFA`)
    expect(movementAmount(row({ type: "commission", amount: 120 }))).toBe(`120${NBSP}FCFA`)
    expect(movementAmount(row({ type: "inconnu", amount: 1500.5 }))).toMatch(/^1[\s ]?50[01]/)
  })

  it("type inattendu : libellé neutre, jamais la valeur brute", () => {
    const out = html(<TransactionsTable rows={[row({ type: "adjustment" })]} />)
    expect(out).toContain("Mouvement")
    expect(out).not.toContain("adjustment")
  })

  it("annulation signalée, titulaire sans nom, référence absente remplacée par un tiret", () => {
    const out = html(<TransactionsTable rows={[row({ isReversal: true, name: "", reference: null })]} />)
    expect(out).toContain("(annulation)")
    expect(out).toContain("Compte sans nom")
  })

  it("accessibilité du tableau : en-têtes de colonne, libellés de cellule, bouton de détail nommé", () => {
    const out = html(<TransactionsTable rows={[row()]} />)
    expect(out).toContain('aria-label="Mouvements du portefeuille"')
    expect((out.match(/scope="col"/g) ?? []).length).toBe(6)
    expect(out).toContain('data-label="Montant"')
    expect(out).toMatch(/<button[^>]*aria-label="Détail du mouvement du 8 oct\. 13:02, Recharge"/)
  })

  it("détail : mission et titulaire en liens, opérateur pour un retrait, aucun téléphone", () => {
    const out = html(
      <TransactionDetail row={row({ missionId: M1, type: "withdrawal", operator: "Celtiis Cash", reference: "FDP-1" })} />,
    )
    expect(out).toContain(`/admin/users/${U1}`)
    expect(out).toContain(`/admin/missions/${M1}`)
    expect(out).toContain("Celtiis Cash")
    expect(out).toContain("FDP-1")
    expect(out).not.toMatch(/phone|\+229/)
  })

  it("vide filtré : lien pour retirer les filtres ; vide simple : paiements en cours d'activation", () => {
    const filtered = html(<TransactionsView data={txData({ rows: [], total: 0, type: "refund" })} />)
    expect(filtered).toContain("Aucun mouvement ne correspond à ces filtres.")
    expect(filtered).toContain("Retirer les filtres")
    const plain = html(<TransactionsView data={txData({ rows: [], total: 0 })} paymentsEnabled={false} />)
    expect(plain).toMatch(/en cours d.{1,8}activation/)
    const live = html(<TransactionsView data={txData({ rows: [], total: 0 })} paymentsEnabled />)
    expect(live).not.toMatch(/en cours d.{1,8}activation/)
  })

  it("indicateur en erreur : message sans montant inventé ; erreur de chargement distincte du vide", () => {
    const partial = html(
      <TransactionsView data={txData({ stats: { ...txData().stats, commissions: { ok: false } } })} />,
    )
    expect(partial).toContain("Lecture impossible pour le moment")
    const failed = html(<TransactionsView data={null} error="Les mouvements n'ont pas pu être chargés. Réessayez dans un instant." />)
    expect(failed).toContain('role="alert"')
    expect(failed).toContain("Réessayer")
    expect(failed).not.toContain("Aucun mouvement")
  })

  it("pagination : filtres conservés dans les liens", () => {
    const out = html(<TransactionsView data={txData({ total: 80, page: 2, type: "deposit", periode: "7j", q: "FDP-1" })} />)
    expect(out).toContain('aria-label="Pagination"')
    expect(out).toContain('aria-current="page"')
    expect(out).toContain("26 à 50 sur 80")
    expect(out).toMatch(/href="\/admin\/transactions\?type=deposit&amp;periode=7j&amp;q=FDP-1&amp;page=3"/)
  })

  it("libellé de période", () => {
    expect(periodLabel("7j")).toBe("7 derniers jours")
    expect(periodLabel("x")).toBe("")
  })
})

describe("Pager", () => {
  it("rien à afficher sur une page unique, précédent désactivé en première page", () => {
    expect(html(<Pager page={1} pageSize={25} total={25} hrefFor={() => "/x"} />)).toBe("")
    const out = html(<Pager page={1} pageSize={25} total={60} hrefFor={(p) => `/x?page=${p}`} />)
    expect(out).toContain('class="page-btn page-btn--nav is-disabled" aria-label="Page précédente"')
    expect(out).toContain('href="/x?page=2"')
  })
})

describe("WithdrawalsView", () => {
  it("retrait débité sans virement en tête : citron unique, ancienneté, aucune action d'argent", () => {
    const out = html(<WithdrawalsView data={wdData()} paymentsEnabled />)
    expect((out.match(/<h1/g) ?? []).length).toBe(1)
    expect((out.match(/class="flag2"/g) ?? []).length).toBe(1)
    expect(out).toContain("Attend depuis 20 h")
    expect(out).toContain("sans qu&#x27;un virement soit créé")
    expect(out).toContain("Débité sans virement créé")
    expect(out).toContain("Pour un retrait bloqué, contactez l&#x27;équipe technique.")
    expect(out).toContain(`/admin/users/${U1}`)
    expect(out).not.toMatch(/Relancer|Recréditer|Marquer traité|Rembourser/)
    expect(out).not.toMatch(FORBIDDEN)
    expect(out).not.toContain("money2")
  })

  it("virement créé, recrédité, en cours : statuts lisibles, opérateur Celtiis affiché comme disponible", () => {
    const rows = [
      wdRow({ id: "a", status: "created", reference: "FDP-9", operator: "Celtiis Cash" }),
      wdRow({ id: "b", status: "reversed" }),
      wdRow({ id: "c", status: "pending" }),
    ]
    const out = html(<WithdrawalsView data={wdData({ rows, total: 3, stats: { ...wdData().stats, created: 1, reversed: 1 } })} />)
    expect(out).toContain("Virement créé")
    expect(out).toContain("Recrédité")
    expect(out).toContain("En cours de traitement")
    expect(out).toContain("Celtiis Cash")
    expect(out).not.toContain("indisponible")
    expect(out).not.toContain("Attend depuis")
  })

  it("statut inconnu : repli neutre", () => {
    const out = html(<WithdrawalsView data={wdData({ rows: [wdRow({ status: "zzz" })] })} />)
    expect(out).toContain("En cours de traitement")
  })

  it("vide, erreur et deuxième page sans carte", () => {
    const empty = html(<WithdrawalsView data={wdData({ rows: [], total: 0 })} />)
    expect(empty).toContain("Aucun retrait pour le moment.")
    expect(empty).toContain("en cours d&#x27;activation")
    const failed = html(<WithdrawalsView data={null} error="Les retraits n'ont pas pu être chargés. Réessayez dans un instant." />)
    expect(failed).toContain('role="alert"')
    const second = html(<WithdrawalsView data={wdData({ page: 2, total: 40 })} />)
    expect(second).not.toContain("Attend depuis")
    expect(second).toContain('href="/admin/withdrawals"')
  })

  it("accessibilité : tableau nommé, en-têtes, libellés de cellule pour la liste mobile", () => {
    const out = html(<WithdrawalsView data={wdData()} />)
    expect(out).toContain('aria-label="Retraits"')
    expect((out.match(/scope="col"/g) ?? []).length).toBe(6)
    expect(out).toContain('data-label="Statut"')
  })
})
