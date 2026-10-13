import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/wallet.actions", () => ({ initiateDeposit: vi.fn(), initiateWithdrawal: vi.fn() }))
vi.mock("@/lib/actions/client-wallet.actions", () => ({ getClientWalletMoreTransactions: vi.fn() }))

const { WalletView } = await import("./wallet-view")
const { HistoryView, txDate } = await import("./history")
const { DepositDialogView, submitDeposit } = await import("./deposit-dialog")
const { WithdrawDialogView, submitWithdrawal } = await import("./withdraw-dialog")
const { DepositReturnBannerView } = await import("./deposit-return-banner")
const { ResumePublishBannerView, ResumePublishBanner } = await import("./resume-publish-banner")
const { FundedMissions } = await import("./funded-missions")
const { formatAmount } = await import("@/lib/app/format")
const { PAYMENTS_PENDING_COPY } = await import("@/lib/constants/payments")

const noop = () => {}
const f = (n) => formatAmount(n)
const nb = (s) => s.replace(/ /g, "\u202f")

const tx = (over) => ({ id: "t1", type: "deposit", amount: 20000, createdAt: "2026-10-05T10:00:00Z", missionId: null, missionTitle: null, ...over })
const mission = (over) => ({ id: "m1", title: "Cours de maths niveau 3e", status: "in_progress", budget: 25000, deadline: null, studentName: "Sèna", pendingCount: 0, ...over })

const baseData = {
  wallet: { available: 12500, escrow: 54000, total: 66500 },
  funded: [
    mission(),
    mission({ id: "m2", title: "Traduire un flyer", status: "open", budget: 8000, studentName: null, pendingCount: 3 }),
    mission({ id: "m3", title: "Garde samedi", status: "open", budget: 6000, studentName: null, deadline: "2026-01-01" }),
  ],
  transactions: [
    tx({ id: "a", type: "reserve", amount: 8000, missionId: "m2", missionTitle: "Traduire un flyer" }),
    tx({ id: "b", type: "deposit", amount: 20000 }),
    tx({ id: "c", type: "refund", amount: 6000, missionId: "m9", missionTitle: "Livrer 12 colis" }),
    tx({ id: "d", type: "withdrawal", amount: 5000 }),
    tx({ id: "e", type: "release", amount: 10000, missionId: "m4", missionTitle: "Garde mercredi" }),
    tx({ id: "g", type: "commission", amount: 1200, missionId: "m4", missionTitle: "Garde mercredi" }),
  ],
  hasMore: false,
  filter: "tout",
  phone: "01 97 45 21 08",
}

const view = (props = {}) =>
  renderToStaticMarkup(<WalletView data={baseData} today="2026-10-13" paymentsEnabled={false} {...props} />)

describe("paiements coupés (défaut)", () => {
  const html = view()

  it("ne rend ni bouton de recharge ou de retrait ni modale", () => {
    expect(html).not.toMatch(/>\s*(Recharger|Retirer)\s*</)
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain("Recharger mon portefeuille")
    expect(html).not.toContain("Retirer sur Mobile Money")
  })

  it("affiche le texte d'activation du portefeuille client", () => {
    expect(html).toContain(PAYMENTS_PENDING_COPY.wallet.title.replace("'", "&#x27;"))
    expect(html).toContain(PAYMENTS_PENDING_COPY.wallet.client.replace(/'/g, "&#x27;"))
    expect(html).not.toContain(PAYMENTS_PENDING_COPY.wallet.student.replace(/'/g, "&#x27;"))
  })

  it("garde le solde, les missions financées et l'historique", () => {
    expect(html).toContain("Portefeuille")
    expect(html).toContain(nb("12 500"))
    expect(html).toContain("Missions financées")
    expect(html).toContain("Historique")
  })

  it("ne propose ni reprise de publication ni modale même avec ?recharger=1", () => {
    const open = view({ recharge: { open: true, suggestion: 7500 } })
    expect(open).not.toContain('role="dialog"')
    expect(open).not.toContain("Reprendre la publication")
  })

  it("ne rend pas le lien « Réessayer » d'un retour annulé", () => {
    const h = view({ depositReturn: { kind: "cancelled" } })
    expect(h).toContain("Paiement annulé")
    expect(h).not.toContain("Réessayer")
  })
})

describe("paiements ouverts", () => {
  const html = view({ paymentsEnabled: true })

  it("rend Recharger et Retirer dans la carte argent, sans texte d'activation", () => {
    expect(html).toMatch(/>Recharger</)
    expect(html).toMatch(/>Retirer</)
    expect(html).not.toContain("en cours d&#x27;activation")
    expect(html).toContain("btn btn--blanc btn--sm")
    expect(html).toContain("btn btn--ghost-blanc btn--sm")
  })

  it("laisse les modales fermées tant qu'on ne les ouvre pas", () => {
    expect(html).not.toContain('role="dialog"')
  })

  it("ouvre la recharge avec ?recharger=1", () => {
    const open = view({ paymentsEnabled: true, recharge: { open: true, suggestion: null } })
    expect(open).toContain('role="dialog"')
    expect(open).toContain("Recharger mon portefeuille")
    expect(open).toContain("Continuer vers le paiement")
  })

  it("propose le montant suggéré, prérempli, sans le créditer", () => {
    const open = view({ paymentsEnabled: true, recharge: { open: true, suggestion: 7500 } })
    expect(open).toContain("7\u202f500 · montant suggéré")
    expect(open).toContain(`value="${nb("7 500")}"`)
    expect(open).toContain(f(20000))
  })

  it("propose la reprise de publication seulement via le composant dédié (rien sans lien stocké)", () => {
    expect(html).not.toContain("Reprendre la publication")
  })
})

describe("carte argent", () => {
  it("affiche total, disponible et séquestre", () => {
    const html = view()
    expect(html).toContain(`Votre argent · ${f(66500)} au total`)
    expect(html).toContain(nb("12 500"))
    expect(html).toContain(nb("54 000"))
    expect(html).toContain("bloqués pour 3 missions")
  })

  it("solde zéro : zéros affichés et aucun séquestre", () => {
    const html = view({
      paymentsEnabled: true,
      data: { ...baseData, wallet: { available: 0, escrow: 0, total: 0 }, funded: [], transactions: [], phone: "" },
    })
    expect(html).toContain(`Votre argent · ${f(0)} au total`)
    expect(html).toContain("aucune mission financée")
    expect(html).toContain("Aucune mission financée")
    expect(html).toContain("Aucun mouvement pour le moment")
  })

  it("disponible faible : Retirer inactif avec le minimum indiqué", () => {
    const html = view({ paymentsEnabled: true, data: { ...baseData, wallet: { available: 1500, escrow: 54000, total: 55500 } } })
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*?Retirer<\/button>/)
    expect(html).toContain(`Retrait possible dès ${f(2000)} disponibles`)
    expect(html).toMatch(/>Recharger</)
  })

  it("disponible suffisant : Retirer actif et aucune mention du minimum", () => {
    const html = view({ paymentsEnabled: true })
    expect(html).not.toContain("Retrait possible dès")
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Retirer<\/button>/)
  })

  it("tient les montants de 10 chiffres", () => {
    const big = 9999999999
    const html = view({ data: { ...baseData, wallet: { available: big, escrow: big, total: big * 2 }, transactions: [tx({ amount: big })] } })
    expect(html).toContain(nb("9 999 999 999"))
    expect(html).not.toContain("NaN")
  })
})

describe("missions financées (séquestre)", () => {
  const html = view()

  it("liste chaque mission avec son budget, son statut et un lien vers le détail", () => {
    expect(html).toContain('href="/client/missions/m1"')
    expect(html).toContain("Cours de maths niveau 3e")
    expect(html).toContain(nb("25 000"))
    expect(html).toContain("En cours")
    expect(html).toContain("Ouverte")
    expect(html).toContain("Échéance dépassée")
  })

  it("dit qui est retenu ou combien de candidatures attendent", () => {
    expect(html).toContain("Sèna")
    expect(html).toContain("3 candidatures en attente")
    expect(html).toContain("Aucune candidature pour l&#x27;instant")
  })

  it("affiche le total en séquestre du portefeuille", () => {
    expect(html).toContain("Total en séquestre")
    expect(html).toContain(f(54000))
  })

  it("explique le séquestre avec la commission calculée et sans libération automatique", () => {
    expect(html).toContain("Comment fonctionne le séquestre")
    expect(html).toContain("commission EduCash de 12 %")
    expect(html).toContain("Rien n&#x27;est libéré sans votre validation")
    expect(html).not.toMatch(/automatique|72 ?h/i)
  })

  it("lecture des missions en échec : seule la liste est en erreur", () => {
    const h = view({ data: { ...baseData, funded: null } })
    expect(h).toContain("Impossible de charger vos missions financées")
    expect(h).toContain(nb("12 500"))
  })

  it("invite à publier seulement si les paiements sont ouverts", () => {
    const props = { missions: [], escrow: 0, today: "2026-10-13" }
    expect(renderToStaticMarkup(<FundedMissions {...props} paymentsEnabled />)).toContain("/client/missions/new")
    expect(renderToStaticMarkup(<FundedMissions {...props} paymentsEnabled={false} />)).not.toContain("/client/missions/new")
  })
})

describe("historique", () => {
  const html = view()

  it("signe les débits d'un vrai moins et les crédits d'un plus, sans signe pour les mouvements internes", () => {
    const rows = html.split('class="tx2"').slice(1)
    const byLabel = (label) => rows.find((r) => r.includes(`>${label}`))
    expect(byLabel("Réservation")).toContain("−8\u202f000")
    expect(byLabel("Retrait")).toContain("−5\u202f000")
    expect(byLabel("Recharge")).toContain("+20\u202f000")
    expect(byLabel("Remboursement")).toContain("+6\u202f000")
    expect(byLabel("Libération")).not.toMatch(/[+−]10\u202f/)
    expect(byLabel("Commission")).not.toMatch(/[+−]1\u202f/)
    expect(html).not.toMatch(/>-\d/)
  })

  it("la liste porte la classe txs2 (conteneur de requête de la carte)", () => {
    expect(html).toContain('role="list" class="txs2"')
  })

  it("la libération se lit comme un prélèvement du séquestre, jamais comme un versé à l'étudiant", () => {
    expect(html).toContain("prélevé du séquestre (commission incluse)")
    expect(html).not.toMatch(/versé à l(?:'|&#x27;)étudiant/)
  })

  it("lie la mission et marque seulement la réservation « En séquestre »", () => {
    expect(html).toContain('href="/client/missions/m4"')
    expect(html.match(/badge badge--neutre badge--sm/g)).toHaveLength(2)
    expect(html).toContain("Aucune mission")
  })

  it("rend les 7 filtres en liens, le courant sélectionné, et jamais de montant dans l'URL", () => {
    expect(html).toContain('aria-label="Filtrer l&#x27;historique"')
    for (const label of ["Tout", "Recharges", "Réservations", "Libérations", "Commissions", "Remboursements", "Retraits"]) {
      expect(html).toContain(`>${label}</a>`)
    }
    expect(html.match(/role="radio"/g)).toHaveLength(7)
    expect(html).toContain('href="/client/wallet?filtre=recharges"')
    expect(html).toContain('href="/client/wallet"')
    expect(html).toMatch(/aria-checked="true"[^>]*>Tout</)
    const retraits = view({ data: { ...baseData, filter: "retraits", transactions: [tx({ type: "withdrawal" })] } })
    expect(retraits).toMatch(/aria-checked="true"[^>]*>Retraits</)
    expect(retraits).not.toMatch(/aria-checked="true"[^>]*>Tout</)
  })

  it("historique vide : message général puis message propre à un filtre", () => {
    expect(view({ data: { ...baseData, transactions: [] } })).toContain("Aucun mouvement pour le moment")
    const filtered = view({ data: { ...baseData, filter: "commissions", transactions: [] } })
    expect(filtered).toContain("Aucun mouvement pour ce filtre")
  })

  it("« Voir plus » n'apparaît que s'il reste des mouvements", () => {
    expect(html).not.toContain("Voir plus")
    const more = renderToStaticMarkup(<HistoryView filter="tout" rows={baseData.transactions} hasMore loading={false} error={null} onMore={noop} />)
    expect(more).toContain("Voir plus")
    expect(more).toContain("6 mouvements affichés")
    const loading = renderToStaticMarkup(<HistoryView filter="tout" rows={baseData.transactions} hasMore loading error={null} onMore={noop} />)
    expect(loading).toContain("disabled")
    expect(loading).toContain('aria-busy="true"')
    const failed = renderToStaticMarkup(<HistoryView filter="tout" rows={baseData.transactions} hasMore loading={false} error="Impossible de charger les mouvements suivants." onMore={noop} />)
    expect(failed).toContain('role="alert"')
  })

  it("formate la date au Bénin", () => {
    expect(txDate("2026-10-05T23:30:00Z")).toBe("06 oct.")
    expect(txDate("n'importe quoi")).toBe("")
    expect(txDate(null)).toBe("")
  })

  it("un type inconnu reste lisible sans montrer la valeur brute", () => {
    const h = renderToStaticMarkup(<HistoryView filter="tout" rows={[tx({ type: "mystere" })]} hasMore={false} loading={false} error={null} onMore={noop} />)
    expect(h).toContain("Mouvement")
    expect(h).not.toContain("mystere")
  })
})

describe("retours du prestataire de paiement", () => {
  const render = (kind, canRetry = true) =>
    renderToStaticMarkup(<DepositReturnBannerView kind={kind} canRetry={canRetry} onRefresh={noop} onDismiss={noop} />)

  it("annulé : « Paiement annulé, votre portefeuille n'a pas été modifié »", () => {
    const h = render("cancelled")
    expect(h).toContain("Paiement annulé, votre portefeuille n&#x27;a pas été modifié")
    expect(h).toContain('href="/client/wallet?recharger=1"')
  })

  it("en attente : jamais présenté comme confirmé, avec Actualiser", () => {
    const h = render("pending")
    expect(h).toContain("Paiement en attente de confirmation")
    expect(h).toContain("Actualiser")
    expect(h).toContain("Ne payez pas une seconde fois")
    expect(h).not.toMatch(/Recharge confirmée|a été crédité/)
    expect(h).not.toContain("Réessayer")
  })

  it("échec : Réessayer et Contacter l'aide, portefeuille inchangé", () => {
    const h = render("failed")
    expect(h).toContain("Le paiement a échoué")
    expect(h).toContain("Réessayer")
    expect(h).toContain("/contact?sujet=question")
    expect(h).toContain("Votre portefeuille n&#x27;a pas été modifié")
  })

  it("une valeur inconnue n'affiche rien", () => {
    expect(render("inconnue")).toBe("")
    expect(render(undefined)).toBe("")
    expect(view({ depositReturn: null })).not.toContain("Paiement annulé")
  })

  it("la page affiche la bannière et un bouton pour la fermer", () => {
    const h = view({ depositReturn: { kind: "failed" } })
    expect(h).toContain("Le paiement a échoué")
    expect(h).toContain('aria-label="Fermer ce message"')
  })
})

describe("reprise de publication", () => {
  it("ne rend rien sans lien, un lien de reprise sinon", () => {
    expect(renderToStaticMarkup(<ResumePublishBannerView href={null} onForget={noop} />)).toBe("")
    const h = renderToStaticMarkup(<ResumePublishBannerView href="/client/missions/new?besoin=Flyer" onForget={noop} />)
    expect(h).toContain('href="/client/missions/new?besoin=Flyer"')
    expect(h).toContain("Reprendre la publication de votre mission")
    expect(h).toContain('aria-label="Oublier la publication en cours"')
  })

  it("en mode stockage, ne rend rien", () => {
    expect(renderToStaticMarkup(<ResumePublishBanner mode="store" href="/client/missions/new" />)).toBe("")
    expect(renderToStaticMarkup(<ResumePublishBanner mode="show" />)).toBe("")
  })
})

describe("modale de recharge (C15)", () => {
  const render = (props = {}) =>
    renderToStaticMarkup(
      <DepositDialogView formId="f" amount={10000} available={12500} suggestion={null} pending={false} error={null} amountError={null} onAmount={noop} onSubmit={noop} onClose={noop} {...props} />,
    )

  it("le focus initial va sur le champ montant et non sur Fermer", () => {
    const ref = { current: null }
    const tree = DepositDialogView({ formId: "f", amount: 10000, available: 12500, suggestion: null, pending: false, error: null, amountError: null, onAmount: noop, onSubmit: noop, onClose: noop, amountRef: ref })
    expect(tree.props.initialFocusRef).toBe(ref)
    const findAmount = (node) => {
      if (!node || typeof node !== "object") return null
      if (Array.isArray(node)) return node.map(findAmount).find(Boolean) ?? null
      if (node.props?.label === "Montant à recharger") return node
      return findAmount(node.props?.children)
    }
    expect(findAmount(tree.props.children).props.ref).toBe(ref)
  })

  it("propose 5 000, 10 000 et 25 000, le montant choisi, un minimum et le récapitulatif", () => {
    const h = render()
    for (const n of ["5\u202f000", "10\u202f000", "25\u202f000"]) expect(h).toContain(n)
    expect(h).toMatch(/aria-checked="true"[^>]*>10\u202f000</)
    expect(h).toContain("Montant à recharger")
    expect(h).toContain(`Minimum ${f(2000)}`)
    expect(h).toContain(f(22500))
    expect(h).toContain("Annuler")
    expect(h).toContain("Continuer vers le paiement")
  })

  it("ne nomme aucun prestataire de paiement et ne propose plus de choix d'opérateur", () => {
    const h = render()
    expect(h).toContain("prestataire de paiement agréé")
    expect(h).not.toMatch(/fedapay|kkiapay|stripe/i)
    expect(h).not.toMatch(/MTN|Moov|Celtiis/)
    expect(h).not.toContain("Opérateur")
  })

  it("montant suggéré : puce dédiée, mention neutre", () => {
    const h = render({ amount: 7500, suggestion: 7500 })
    expect(h).toContain("7\u202f500 · montant suggéré")
    expect(h).toContain("Montant suggéré pour publier votre mission")
    expect(h).toContain(f(20000))
  })

  it("une suggestion égale à un montant rapide ne crée pas de doublon", () => {
    expect(render({ amount: 5000, suggestion: 5000 })).not.toContain("montant suggéré</")
  })

  it("montant sous le minimum : erreur reliée au champ", () => {
    const h = render({ amount: 1500, amountError: `Le minimum de recharge est de ${f(2000)}.` })
    expect(h).toContain("field__error")
    expect(h).toContain('aria-invalid="true"')
  })

  it("envoi en cours : boutons inactifs, aucun double envoi", () => {
    const h = render({ pending: true })
    expect(h).toContain("Redirection en cours")
    expect(h.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2)
    expect(h).toContain('aria-busy="true"')
  })

  it("refus du serveur : message affiché, modale ouverte", () => {
    const h = render({ error: "Le dépôt n'a pas pu être initié. Réessayez dans un instant." })
    expect(h).toContain('role="alert"')
    expect(h).toContain("Réessayez dans un instant")
  })

  it("est un dialogue étiqueté", () => {
    const h = render()
    expect(h).toContain('role="dialog"')
    expect(h).toContain('aria-modal="true"')
    expect(h).toContain("aria-labelledby")
  })
})

describe("submitDeposit", () => {
  it("refuse un montant invalide sans appeler le serveur", async () => {
    const initiate = vi.fn()
    expect(await submitDeposit(1500, initiate)).toEqual({ kind: "invalid", amountError: `Le minimum de recharge est de ${f(2000)}.` })
    expect((await submitDeposit(null, initiate)).kind).toBe("invalid")
    expect(initiate).not.toHaveBeenCalled()
  })

  it("envoie le montant saisi (et lui seul) puis redirige vers l'adresse https reçue", async () => {
    const initiate = vi.fn().mockResolvedValue({ paymentUrl: "https://pay.example.com/abc" })
    expect(await submitDeposit(10000, initiate)).toEqual({ kind: "redirect", url: "https://pay.example.com/abc" })
    expect(initiate).toHaveBeenCalledWith({ amount: 10000 })
  })

  it("relaie le refus du serveur", async () => {
    const initiate = vi.fn().mockResolvedValue({ error: "Recharge et retrait en cours d'activation" })
    expect(await submitDeposit(10000, initiate)).toEqual({ kind: "error", error: "Recharge et retrait en cours d'activation" })
  })

  it("ne redirige jamais vers une adresse non https ou absente", async () => {
    for (const paymentUrl of ["http://pay.example.com", "javascript:alert(1)", undefined]) {
      const out = await submitDeposit(10000, vi.fn().mockResolvedValue({ paymentUrl }))
      expect(out.kind).toBe("error")
    }
  })

  it("une exception donne une erreur neutre sans débit annoncé", async () => {
    const out = await submitDeposit(10000, vi.fn().mockRejectedValue(new Error("réseau")))
    expect(out.kind).toBe("error")
    expect(out.error).toContain("Votre portefeuille n'a pas été modifié")
  })
})

describe("modale de retrait (C16)", () => {
  const base = {
    formId: "f", step: "form", available: 12500, escrow: 54000, amount: 10000, phone: "01 97 45 21 08", operator: "mtn",
    prefilled: true, errors: {}, error: null, pending: false, snapshot: null,
    onAmount: noop, onPhone: noop, onOperator: noop, onContinue: noop, onBack: noop, onSubmit: noop, onClose: noop,
  }
  const render = (props = {}) => renderToStaticMarkup(<WithdrawDialogView {...base} {...props} />)

  it("étape 1 : disponible, rappel du séquestre, montants rapides, numéro prérempli, opérateurs", () => {
    const h = render()
    expect(h).toContain("Retirer sur Mobile Money")
    expect(h).toContain('aria-label="Étape 1 sur 2"')
    expect(h).toContain(f(12500))
    expect(h).toContain(`Les ${f(54000)} en séquestre ne peuvent pas être retirés`)
    expect(h).toContain("Tout retirer · 12\u202f500")
    expect(h).toContain('value="01 97 45 21 08"')
    expect(h).toContain("Prérempli depuis votre profil")
    expect(h).toContain("+229")
    expect(h).toContain("MTN MoMo")
    expect(h).toContain("Moov Money")
    expect(h).not.toContain("Celtiis")
    expect(h).toContain(`maximum ${f(12500)}`)
    expect(h).toContain("Continuer")
    expect(h).toContain("Annuler")
  })

  it("sans numéro connu : aucun préremplissage annoncé", () => {
    const h = render({ phone: "", prefilled: false })
    expect(h).not.toContain("Prérempli")
    expect(h).toContain("10 chiffres, commence par 01")
  })

  it("libellés visibles reliés à chaque champ", () => {
    const h = render()
    expect(h).toMatch(/<label class="field__label" for="([^"]+)"[^>]*>Numéro Mobile Money/)
    const id = h.match(/<label class="field__label" for="([^"]+)"[^>]*>Numéro Mobile Money/)[1]
    expect(h).toContain(`id="${id}"`)
    expect(h).toMatch(/<label class="field__label" for="[^"]+"[^>]*>Montant à retirer/)
    expect(h).toContain('aria-label="Opérateur"')
  })

  it("erreurs de champ affichées et annoncées", () => {
    const h = render({
      amount: 20000, operator: null,
      errors: { amount: `Le montant dépasse votre disponible (${f(12500)}).`, phone: "Le numéro béninois commence par 01.", operator: "Choisissez votre opérateur Mobile Money." },
    })
    expect(h.match(/role="alert"/g)?.length).toBeGreaterThanOrEqual(3)
    expect(h).toContain("Le montant dépasse votre disponible")
    expect(h).toContain("Choisissez votre opérateur")
    expect(h).toContain('aria-invalid="true"')
  })

  it("disponible sous le minimum : pas de montants rapides", () => {
    expect(render({ available: 1500 })).not.toContain("Tout retirer")
  })

  it("étape 2 : phrase qui dit qui reçoit quoi, numéro masqué, récapitulatif, rappel du séquestre", () => {
    const h = render({ step: "review" })
    expect(h).toContain("Vérifiez avant d&#x27;envoyer")
    expect(h).toContain('aria-label="Étape 2 sur 2"')
    expect(h).toContain(`<b>${f(10000)}</b>`)
    expect(h).toContain("01 97 •• •• 08")
    expect(h).not.toContain("01 97 45 21 08")
    expect(h).toContain("MTN MoMo")
    expect(h).toContain("Disponible après retrait")
    expect(h).toContain(f(2500))
    expect(h).toContain("En séquestre, inchangé")
    expect(h).toContain("Les fonds en séquestre ne peuvent pas être retirés")
    expect(h).toContain(`Retirer ${f(10000)}`)
    expect(h).toContain("Modifier")
  })

  it("étape 2, envoi : boutons inactifs et occupés", () => {
    const h = render({ step: "review", pending: true })
    expect(h).toContain("Envoi en cours")
    expect(h).toContain('aria-busy="true"')
    expect(h.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("étape 2, échec : message du serveur, disponible actualisé, Réessayer, contact", () => {
    const h = render({ step: "review", error: "Le retrait n'a pas pu être initié. Réessayez dans un instant." })
    expect(h).toContain("Le retrait n&#x27;a pas pu être lancé")
    expect(h).toContain("Réessayez dans un instant")
    expect(h).toContain("Votre disponible a été actualisé")
    expect(h).toContain(">Réessayer<")
    expect(h).toContain("/contact?sujet=question")
    expect(h).not.toMatch(/n&#x27;a pas été débité|aucun débit/i)
  })

  it("étape 2, débit incertain : ni Réessayer ni Modifier, Contacter l'aide et Fermer", () => {
    const h = render({
      step: "review",
      error: "Votre demande a peut-être été débitée. Contactez l'aide avant toute nouvelle demande.",
      errorCode: "debit_uncertain",
    })
    expect(h).toContain("Votre demande a peut-être été débitée")
    expect(h).toContain("/contact?sujet=question")
    expect(h).toContain("Contacter l&#x27;aide")
    expect(h).not.toContain("Réessayer")
    expect(h).not.toContain("Modifier")
    expect(h).not.toContain("Retirer ")
    expect(h).not.toContain("Votre disponible a été actualisé")
    expect(h).toContain("Fermer")
  })

  it("succès : récapitulatif du virement, nouveau disponible, séquestre, sans promesse de délai", () => {
    const h = render({ step: "done", snapshot: { amount: 10000, phone: "0197452108", operator: "moov", availableAfter: 2500, escrow: 54000 } })
    expect(h).toContain("Demande de retrait envoyée")
    expect(h).toContain("Moov Money")
    expect(h).toContain("01 97 •• •• 08")
    expect(h).toContain("Nouveau disponible")
    expect(h).toContain(f(2500))
    expect(h).toContain("notre prestataire de paiement agréé")
    expect(h).toContain("Fermer")
    expect(h).not.toMatch(/\d+ ?(?:min|h)\b|24 ?h|sous /i)
  })
})

describe("submitWithdrawal", () => {
  const input = { amount: 10000, phone: "01 97 45 21 08", operator: "mtn" }

  it("refuse tout ce qui dépasse le disponible sans appeler le serveur", async () => {
    const initiate = vi.fn()
    const out = await submitWithdrawal({ ...input, amount: 12501 }, 12500, initiate)
    expect(out.kind).toBe("invalid")
    expect(out.errors.amount).toContain("dépasse votre disponible")
    expect((await submitWithdrawal(input, 0, initiate)).kind).toBe("invalid")
    expect(initiate).not.toHaveBeenCalled()
  })

  it("envoie le numéro national à 10 chiffres et l'opérateur choisi", async () => {
    const initiate = vi.fn().mockResolvedValue({ success: true })
    const out = await submitWithdrawal(input, 12500, initiate)
    expect(out).toEqual({ kind: "done", value: { amount: 10000, phone: "0197452108", operator: "mtn" } })
    expect(initiate).toHaveBeenCalledWith({ amount: 10000, phone: "0197452108", operator: "mtn" })
  })

  it("transmet le code debit_uncertain du serveur", async () => {
    const out = await submitWithdrawal(input, 12500, vi.fn().mockResolvedValue({ error: "peut-être débitée", code: "debit_uncertain" }))
    expect(out).toEqual({ kind: "error", error: "peut-être débitée", code: "debit_uncertain" })
  })

  it("échec : renvoie l'erreur du serveur, jamais un succès", async () => {
    const out = await submitWithdrawal(input, 12500, vi.fn().mockResolvedValue({ error: "Solde insuffisant" }))
    expect(out).toEqual({ kind: "error", error: "Solde insuffisant" })
    expect((await submitWithdrawal(input, 12500, vi.fn().mockRejectedValue(new Error("x")))).kind).toBe("error")
  })
})

describe("texte et accessibilité de l'ensemble", () => {
  const all = [
    view({ paymentsEnabled: true, recharge: { open: true, suggestion: 7500 }, depositReturn: { kind: "failed" } }),
    view(),
    renderToStaticMarkup(<WithdrawDialogView formId="f" step="review" available={12500} escrow={54000} amount={10000} phone="0197452108" operator="mtn" errors={{}} onClose={noop} onSubmit={noop} onBack={noop} />),
  ].join("\n")

  it("aucun tiret cadratin ni demi-cadratin, aucun mot banni, aucun prestataire nommé", () => {
    expect(all).not.toMatch(/[\u2013\u2014]/)
    expect(all).not.toMatch(/\b(?:livraisons?|courses?|coursiers?|saisie|bientôt|fedapay)\b/i)
  })

  it("le client est vouvoyé", () => {
    expect(all).not.toMatch(/\b(?:tu|toi|ton|tes|ta)\b/i)
    expect(all).not.toMatch(/\bRéessaie\b/)
  })

  it("aucun style en ligne, aucune classe Tailwind de couleur ou de mise en page", () => {
    expect(all).not.toContain("style=")
    expect(all).not.toMatch(/class="[^"]*\b(?:bg-|text-(?:gray|green|red)|flex |grid |p-\d|gap-\d)/)
  })

  it("chaque bouton icône a un nom accessible", () => {
    for (const m of all.matchAll(/<button[^>]*btn-icon[^>]*>/g)) expect(m[0]).toContain("aria-label=")
  })

  it("état d'erreur de chargement", () => {
    const h = renderToStaticMarkup(<WalletView error="x" today="2026-10-13" paymentsEnabled={false} />)
    expect(h).toContain("Impossible de charger votre portefeuille")
    expect(h).toContain('role="alert"')
  })
})
