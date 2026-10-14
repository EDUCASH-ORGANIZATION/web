import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/wallet.actions", () => ({ initiateWithdrawal: vi.fn() }))
vi.mock("@/lib/actions/student-wallet.actions", () => ({ getStudentWalletMore: vi.fn() }))

const { WalletView } = await import("./wallet-view")
const { HistoryView, txDate } = await import("./history")
const { WithdrawDialogView, submitWithdrawal, createSendGuard } = await import("./withdraw-dialog")
const { EarningsChart, barLevel, weekLabel } = await import("./earnings-chart")
const { formatAmount } = await import("@/lib/app/format")
const { validateWithdraw } = await import("@/lib/client-space/withdraw-schema")
const { PAYMENTS_PENDING_COPY } = await import("@/lib/constants/payments")

const noop = () => {}
const f = (n) => formatAmount(n)
const nb = (s) => s.replace(/ /g, " ")
const esc = (s) => s.replace(/'/g, "&#x27;")

const tx = (over) => ({ id: "t1", type: "release", amount: 13200, createdAt: "2026-10-05T10:00:00Z", missionId: null, missionTitle: null, ...over })

const STARTS = ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]
const weeks = [3000, 5200, 1800, 6400, 4000, 7200, 8400, 2600].map((total, i) => ({ start: STARTS[i], total }))

const baseData = {
  wallet: { available: 47600 },
  gains: { weeks, eightWeeks: 38600, total: 318720 },
  toCome: {
    total: 35200,
    missions: [
      { id: "m1", title: "Cours de maths niveau 3e", clientName: "Rosine", budget: 25000, net: 22000 },
      { id: "m2", title: "Flyer", clientName: "Koffi", budget: 15000, net: 13200 },
    ],
  },
  pendingWithdrawal: null,
  transactions: [
    tx({ id: "a", type: "release", amount: 7040, missionId: "m4", missionTitle: "Traduction d'un flyer" }),
    tx({ id: "b", type: "withdrawal", amount: 10000 }),
    tx({ id: "c", type: "refund", amount: 6000, missionId: "m9", missionTitle: "Garde samedi" }),
  ],
  hasMore: false,
  filter: "tout",
}

const view = (props = {}) =>
  renderToStaticMarkup(<WalletView data={baseData} paymentsEnabled={false} {...props} />)

// Cas étudiant portés de wallet-shells.test.jsx (le fichier d'origine reste jusqu'à ST-17).
describe("paiements coupés (défaut)", () => {
  const html = view()

  it("ne rend ni bouton de retrait ni modale", () => {
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toMatch(/>\s*(Retirer|Retirer mes gains|Retirer sur Mobile Money)\s*</)
    expect(html).not.toContain("Retirer sur Mobile Money")
    expect(html).not.toContain("Retirer 1")
    expect(html).not.toContain("<form")
  })

  it("ne rend aucune modale même avec ?retrait=1", () => {
    const open = view({ openWithdraw: true, prefill: { phone: "01 97 45 21 08" } })
    expect(open).not.toContain('role="dialog"')
    expect(open).not.toContain("01 97 45 21 08")
  })

  it("affiche le texte d'activation du portefeuille, variante étudiant", () => {
    expect(html).toContain(esc(PAYMENTS_PENDING_COPY.wallet.title))
    expect(html).toContain(esc(PAYMENTS_PENDING_COPY.wallet.student))
    expect(html).not.toContain(esc(PAYMENTS_PENDING_COPY.wallet.client))
  })

  it("garde le solde, les gains, l'à venir et l'historique", () => {
    expect(html).toContain("Portefeuille")
    expect(html).toContain(nb("47 600"))
    expect(html).toContain('aria-label="Tes gains"')
    expect(html).toContain("À venir, en séquestre")
    expect(html).toContain("Historique")
  })
})

describe("paiements ouverts", () => {
  const html = view({ paymentsEnabled: true })

  it("rend le bouton blanc « Retirer sur Mobile Money », sans texte d'activation", () => {
    expect(html).toMatch(/btn btn--blanc[^>]*>.*Retirer sur Mobile Money<\/button>/)
    expect(html).not.toContain("en cours d&#x27;activation")
    expect(html).toContain(`Retrait possible dès ${f(2000)}`)
  })

  it("laisse la modale fermée tant qu'on ne clique pas", () => {
    expect(html).not.toContain('role="dialog"')
  })

  it("?retrait=1 ouvre la modale (étape 1) avec le numéro prérempli, sans rien envoyer", () => {
    const open = view({ paymentsEnabled: true, openWithdraw: true, prefill: { phone: "01 97 45 21 08" } })
    expect(open).toContain('role="dialog"')
    expect(open).toContain("Retirer sur Mobile Money")
    expect(open).toContain('value="01 97 45 21 08"')
    expect(open).toContain("Continuer")
    expect(open).not.toContain("Demande de retrait envoyée")
  })

  it("?retrait=1 sous le minimum : la modale ne s'ouvre pas", () => {
    const open = view({ paymentsEnabled: true, openWithdraw: true, data: { ...baseData, wallet: { available: 1500 } } })
    expect(open).not.toContain('role="dialog"')
  })
})

describe("carte « Disponible »", () => {
  it("0 FCFA, paiements ouverts : « Il te manque 2 000 FCFA », aucun bouton", () => {
    const h = view({ paymentsEnabled: true, data: { ...baseData, wallet: { available: 0 }, gains: null, toCome: { total: 0, missions: [] }, transactions: [] } })
    expect(h).toContain(`Il te manque ${f(2000)}`)
    expect(h).not.toContain("Retirer sur Mobile Money")
    expect(h).not.toContain('role="dialog"')
    expect(h).toContain("Aucun mouvement pour le moment")
    expect(h).toContain("Rien en séquestre pour le moment")
  })

  it("sous le minimum : le manque exact est indiqué", () => {
    const h = view({ paymentsEnabled: true, data: { ...baseData, wallet: { available: 1500 } } })
    expect(h).toContain(`Il te manque ${f(500)}`)
    expect(h).not.toContain("Retirer sur Mobile Money")
  })

  it("solde positif : montant, bouton, aucune mention du manque", () => {
    const h = view({ paymentsEnabled: true })
    expect(h).toContain(nb("47 600"))
    expect(h).not.toContain("Il te manque")
  })

  it("retrait en cours : rappel sur la carte avec lien d'aide, sans promettre de délai", () => {
    const h = view({ paymentsEnabled: true, data: { ...baseData, pendingWithdrawal: { amount: 10000, createdAt: "2026-10-14T08:20:00Z" } } })
    expect(h).toContain(f(10000))
    expect(h).toContain("en cours de retrait")
    expect(h).toContain('href="/contact?sujet=question"')
    expect(h).not.toMatch(/\d+ ?(à|-) ?\d+ ?min|24 ?h|48 ?h/)
  })

  it("aucun retrait en cours : aucune mention", () => {
    expect(view({ paymentsEnabled: true })).not.toContain("en cours de retrait")
  })

  it("tient les montants de 10 chiffres", () => {
    const big = 9999999999
    const h = view({
      paymentsEnabled: true,
      data: {
        ...baseData,
        wallet: { available: big },
        gains: { weeks, eightWeeks: big, total: big },
        toCome: { total: big, missions: [{ id: "m", title: "Gros contrat", clientName: "Koffi", budget: big, net: big }] },
        transactions: [tx({ amount: big })],
      },
    })
    expect(h).toContain(nb("9 999 999 999"))
    expect(h).not.toContain("NaN")
  })
})

describe("gains et à venir", () => {
  const html = view()

  it("« Tes gains » : 8 semaines en barres neutres, la semaine en cours en encre, total depuis l'inscription", () => {
    expect(html.match(/<i data-h=/g)).toHaveLength(8)
    expect(html).toMatch(/<i data-h="\d+" class="is-now">/)
    expect(html).toContain(nb("38 600"))
    expect(html).toContain(nb("318 720"))
    expect(html).toContain("gagnés ces 8 dernières semaines")
    expect(html).toContain("au total depuis ton inscription")
    expect(html).toContain("Cette semaine")
    expect(html).toContain("<span>24 août</span>")
    expect(html).not.toContain("style=")
  })

  it("lecture des gains en échec : la carte est omise, jamais un faux 0", () => {
    const h = view({ data: { ...baseData, gains: null } })
    expect(h).not.toContain('aria-label="Tes gains"')
    expect(h).toContain("e2-08-top e2-08-top--solo")
    expect(h).toContain(nb("47 600"))
  })

  it("« À venir » : part nette de chaque mission, budget bloqué, lien vers la mission, total pour toi", () => {
    expect(html).toContain(`${nb("35 200")} FCFA pour toi`)
    expect(html).toContain("+22 000")
    expect(html).toContain(`sur ${f(25000)} bloqués`)
    expect(html).toContain('href="/student/missions/m1"')
    expect(html).toContain("Rosine")
    expect(html).toContain("Versé quand le client valide la fin de mission")
    expect(html).not.toMatch(/0[.,]88|0[.,]12|automatiquement/)
  })

  it("« À venir » en échec : bloc omis", () => {
    expect(view({ data: { ...baseData, toCome: null } })).not.toContain("À venir, en séquestre")
  })

  it("barLevel et weekLabel", () => {
    expect(barLevel(0, 100)).toBe(0)
    expect(barLevel(5, 0)).toBe(0)
    expect(barLevel(1, 1000)).toBe(1)
    expect(barLevel(100, 100)).toBe(10)
    expect(weekLabel("2026-08-17")).toBe("17 août")
    expect(weekLabel("pas une date")).toBe("")
    const chart = renderToStaticMarkup(<EarningsChart gains={{ weeks: weeks.map((w) => ({ ...w, total: 0 })), eightWeeks: 0, total: 0 }} />)
    expect(chart).toContain('data-h="0"')
  })
})

describe("historique", () => {
  const html = view()
  const rows = html.split('class="e2-op e2-08-op"').slice(1)

  it("signe les retraits d'un vrai moins et les crédits d'un plus", () => {
    const history = html.slice(html.indexOf('aria-label="Historique"'))
    const byLabel = (label) => history.split('class="e2-op e2-08-op"').slice(1).find((r) => r.includes(`>${label}`))
    expect(byLabel("Paiement reçu")).toContain("+7 040")
    expect(byLabel("Retrait")).toContain("−10 000")
    expect(byLabel("Remboursement")).toContain("+6 000")
    expect(html).not.toMatch(/>-\d/)
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })

  it("lie la mission du paiement et dit « vers Mobile Money » pour un retrait, sans numéro", () => {
    expect(html).toContain('href="/student/missions/m4"')
    expect(html).toContain("Retrait vers Mobile Money")
    expect(html).not.toMatch(/01 97|\+229/)
  })

  it("rend les 4 filtres en liens, le courant sélectionné, sans commission ni montant dans l'URL", () => {
    expect(html).toContain('aria-label="Filtrer l&#x27;historique"')
    for (const label of ["Tout", "Paiements reçus", "Retraits", "Remboursements"]) expect(html).toContain(`>${label}</a>`)
    expect(html.match(/role="radio"/g)).toHaveLength(4)
    expect(html).toContain('href="/wallet?filtre=paiements"')
    expect(html).toContain('href="/wallet"')
    expect(html).not.toContain(">Commissions<")
    expect(html).toMatch(/aria-checked="true"[^>]*>Tout</)
    const retraits = view({ data: { ...baseData, filter: "retraits", transactions: [tx({ type: "withdrawal" })] } })
    expect(retraits).toMatch(/aria-checked="true"[^>]*>Retraits</)
  })

  it("historique vide : message général puis message propre à un filtre (tutoyé)", () => {
    const general = view({ data: { ...baseData, transactions: [] } })
    expect(general).toContain("Aucun mouvement pour le moment")
    expect(general).toContain("Tes paiements reçus et tes retraits apparaîtront ici.")
    const filtered = view({ data: { ...baseData, filter: "remboursements", transactions: [] } })
    expect(filtered).toContain("Aucun mouvement pour ce filtre")
    expect(filtered).toContain("Essaie un autre filtre")
  })

  it("« Voir plus » n'apparaît que s'il reste des mouvements", () => {
    expect(html).not.toContain("Voir plus")
    const more = renderToStaticMarkup(<HistoryView filter="tout" rows={baseData.transactions} hasMore loading={false} error={null} onMore={noop} />)
    expect(more).toContain("Voir plus")
    expect(more).toContain("3 mouvements affichés")
    const loading = renderToStaticMarkup(<HistoryView filter="tout" rows={baseData.transactions} hasMore loading error={null} onMore={noop} />)
    expect(loading).toContain("disabled")
    expect(loading).toContain('aria-busy="true"')
    const failed = renderToStaticMarkup(<HistoryView filter="tout" rows={baseData.transactions} hasMore loading={false} error="Impossible de charger les mouvements suivants." onMore={noop} />)
    expect(failed).toContain('role="alert"')
  })

  it("formate la date au Bénin et reste lisible pour un type inconnu", () => {
    expect(txDate("2026-10-05T23:30:00Z")).toBe("06 oct.")
    expect(txDate("n'importe quoi")).toBe("")
    expect(txDate(null)).toBe("")
    const h = renderToStaticMarkup(<HistoryView filter="tout" rows={[tx({ type: "mystere" })]} hasMore={false} loading={false} error={null} onMore={noop} />)
    expect(h).toContain("Mouvement")
    expect(h).not.toContain("mystere")
  })
})

describe("erreur de chargement", () => {
  it("un seul h1, tutoyé, sans modale", () => {
    const h = renderToStaticMarkup(<WalletView error="x" paymentsEnabled />)
    expect(h.match(/<h1/g)).toHaveLength(1)
    expect(h).toContain("Impossible de charger ton portefeuille")
    expect(h).not.toContain('role="dialog"')
  })

  it("la page entière n'a qu'un h1", () => {
    expect(view({ paymentsEnabled: true }).match(/<h1/g)).toHaveLength(1)
  })
})

describe("modale de retrait (E09)", () => {
  const base = {
    formId: "f", step: "form", available: 47600, amount: 10000, phone: "01 97 45 21 08", operator: "mtn",
    prefilled: true, errors: {}, error: null, pending: false, snapshot: null,
    onAmount: noop, onPhone: noop, onOperator: noop, onContinue: noop, onBack: noop, onSubmit: noop, onClose: noop,
  }
  const render = (props = {}) => renderToStaticMarkup(<WithdrawDialogView {...base} {...props} />)

  it("étape 1 : montants rapides et « Tout retirer », numéro prérempli, MTN et Moov seulement", () => {
    const h = render()
    expect(h).toContain("Retirer sur Mobile Money")
    expect(h).toContain('aria-label="Étape 1 sur 2"')
    expect(h).toContain(`Disponible : ${f(47600)} · minimum ${f(2000)}`)
    for (const n of ["2 000", "5 000", "10 000"]) expect(h).toContain(n)
    expect(h).toContain("Tout retirer · 47 600")
    expect(h).toContain('value="01 97 45 21 08"')
    expect(h).toContain("Prérempli depuis ton profil")
    expect(h).toContain("+229")
    expect(h).toContain("MTN MoMo")
    expect(h).toContain("Moov Money")
    expect(h).not.toContain("Celtiis")
    expect(h).toContain("Continuer")
    expect(h).toContain("Annuler")
  })

  it("est un dialogue étiqueté avec libellés visibles reliés aux champs", () => {
    const h = render()
    expect(h).toContain('role="dialog"')
    expect(h).toContain('aria-modal="true"')
    expect(h).toContain("aria-labelledby")
    const id = h.match(/<label class="field__label" for="([^"]+)"[^>]*>Numéro Mobile Money/)[1]
    expect(h).toContain(`id="${id}"`)
    expect(h).toMatch(/<label class="field__label" for="[^"]+"[^>]*>Montant/)
    expect(h).toContain('aria-label="Opérateur"')
  })

  it("sans numéro connu : aucun préremplissage annoncé", () => {
    const h = render({ phone: "", prefilled: false })
    expect(h).not.toContain("Prérempli")
    expect(h).toContain("10 chiffres, commence par 01")
  })

  it("erreurs de champ affichées et annoncées, issues de la vraie validation, vouvoyées", () => {
    const checked = validateWithdraw({ amount: 60000, phone: "12", operator: null }, 47600)
    expect(checked.ok).toBe(false)
    expect(Object.keys(checked.errors).sort()).toEqual(["amount", "operator", "phone"])
    const h = render({ amount: 60000, operator: null, errors: checked.errors })
    expect(h.match(/role="alert"/g)?.length).toBeGreaterThanOrEqual(3)
    expect(h).toContain('aria-invalid="true"')
    for (const message of Object.values(checked.errors)) {
      expect(message).not.toMatch(/\b(ton|ta|tes|toi|tu)\b|Indique |Choisis /i)
    }
    expect(checked.errors.amount).toBe(`Le montant dépasse votre disponible (${f(47600)}).`)
    expect(checked.errors.operator).toBe("Choisissez votre opérateur Mobile Money.")
    const empty = validateWithdraw({ amount: null, phone: "", operator: "mtn" }, 47600)
    expect(empty.errors.amount).toBe("Indiquez le montant à retirer.")
    expect(empty.errors.phone).toBe("Indiquez votre numéro de téléphone.")
    for (const message of Object.values(empty.errors)) {
      expect(message).not.toMatch(/\b(ton|ta|tes|toi|tu)\b|Indique |Choisis /i)
    }
  })

  it("disponible sous le minimum : pas de montants rapides", () => {
    expect(render({ available: 1500 })).not.toContain("Tout retirer")
  })

  it("étape 2 : récapitulatif en phrase, numéro masqué sauf 2 derniers chiffres, jamais le numéro complet", () => {
    const h = render({ step: "review" })
    expect(h).toContain("Vérifie avant d&#x27;envoyer")
    expect(h).toContain('aria-label="Étape 2 sur 2"')
    expect(h).toContain(`Tu vas recevoir <b>${f(10000)}</b> sur le <b>•• •• •• •• 08</b>, MTN MoMo.`)
    expect(h).not.toContain("01 97 45 21 08")
    expect(h).toContain("Disponible après retrait")
    expect(h).toContain(f(37600))
    expect(h).toContain(`Retirer ${f(10000)}`)
    expect(h).toContain("Modifier")
  })

  it("étape 2, envoi : boutons inactifs et occupés", () => {
    const h = render({ step: "review", pending: true })
    expect(h).toContain("Envoi en cours")
    expect(h).toContain('aria-busy="true"')
    expect(h.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("échec : la modale reste ouverte, message tutoyé, Réessayer et Modifier, saisie conservée", () => {
    const h = render({ step: "review", error: "Le retrait n'a pas pu être initié. Réessaie dans un instant." })
    expect(h).toContain('role="dialog"')
    expect(h).toContain("Le retrait n&#x27;a pas pu être initié. Réessaie dans un instant.")
    expect(h).toContain("Ton disponible a été actualisé")
    expect(h).toContain("Réessayer")
    expect(h).toContain("Modifier")
    expect(h).toContain("•• •• •• •• 08")
    expect(h).toContain(`<b>${f(10000)}</b>`)
    expect(h).toContain('href="/contact?sujet=question"')
  })

  it("debit_uncertain : ni Réessayer ni Modifier, lien d'aide, bouton Fermer", () => {
    const h = render({ step: "review", error: "Ta demande a peut-être été débitée. Contacte l'aide avant toute nouvelle demande.", errorCode: "debit_uncertain" })
    expect(h).toContain("Ta demande a peut-être été débitée")
    expect(h).not.toContain("Réessayer")
    expect(h).not.toContain("Modifier")
    expect(h).not.toContain(`Retirer ${f(10000)}`)
    expect(h).not.toContain("Ton disponible a été actualisé")
    expect(h).toContain('href="/contact?sujet=question"')
    expect(h).toContain("Fermer")
  })

  it("succès : sans numéro complet, sans promesse de délai, prestataire non nommé", () => {
    const h = render({ step: "done", snapshot: { amount: 10000, phone: "0197452108", operator: "mtn", availableAfter: 37600 } })
    expect(h).toContain("Demande de retrait envoyée")
    expect(h).toContain("•• •• •• •• 08")
    expect(h).not.toContain("0197452108")
    expect(h).toContain("notre prestataire de paiement agréé")
    expect(h).toContain(f(37600))
    expect(h).not.toMatch(/fedapay|kkiapay|\d+ ?(à|-) ?\d+ ?min/i)
  })
})

describe("submitWithdrawal", () => {
  const input = { amount: 10000, phone: "01 97 45 21 08", operator: "mtn" }

  it("revalide sans appeler le serveur : montant au-dessus du disponible, opérateur absent, numéro invalide", async () => {
    const initiate = vi.fn()
    expect((await submitWithdrawal({ ...input, amount: 60000 }, 47600, initiate)).kind).toBe("invalid")
    expect((await submitWithdrawal({ ...input, operator: null }, 47600, initiate)).errors.operator).toBeTruthy()
    expect((await submitWithdrawal({ ...input, phone: "12" }, 47600, initiate)).errors.phone).toBeTruthy()
    expect((await submitWithdrawal({ ...input, operator: "celtiis" }, 47600, initiate)).kind).toBe("invalid")
    expect(initiate).not.toHaveBeenCalled()
  })

  it("envoie le numéro national à 10 chiffres, l'opérateur et le montant, et eux seuls", async () => {
    const initiate = vi.fn().mockResolvedValue({ success: true })
    const out = await submitWithdrawal(input, 47600, initiate)
    expect(initiate).toHaveBeenCalledWith({ amount: 10000, phone: "0197452108", operator: "mtn" })
    expect(out).toEqual({ kind: "done", value: { amount: 10000, phone: "0197452108", operator: "mtn" } })
  })

  it("relaie le refus du serveur et le code debit_uncertain", async () => {
    expect(await submitWithdrawal(input, 47600, vi.fn().mockResolvedValue({ error: "Solde insuffisant" }))).toEqual({ kind: "error", error: "Solde insuffisant", code: undefined })
    const out = await submitWithdrawal(input, 47600, vi.fn().mockResolvedValue({ error: "peut-être débité", code: "debit_uncertain" }))
    expect(out).toEqual({ kind: "error", error: "peut-être débité", code: "debit_uncertain" })
  })

  it("une exception donne une erreur neutre (la modale reste ouverte)", async () => {
    const out = await submitWithdrawal(input, 47600, vi.fn().mockRejectedValue(new Error("réseau")))
    expect(out).toEqual({ kind: "error", error: "Le retrait n'a pas pu être lancé." })
  })

  it("double clic : le verrou n'accepte qu'un envoi à la fois, puis se libère", async () => {
    const guard = createSendGuard()
    const initiate = vi.fn().mockResolvedValue({ success: true })
    let release
    initiate.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ success: true }) }))
    const click = async () => {
      if (!guard.enter()) return "ignoré"
      try {
        await submitWithdrawal(input, 47600, initiate)
        return "envoyé"
      } finally {
        guard.leave()
      }
    }
    const first = click()
    expect(await click()).toBe("ignoré")
    expect(await click()).toBe("ignoré")
    release()
    expect(await first).toBe("envoyé")
    expect(initiate).toHaveBeenCalledTimes(1)
    expect(guard.enter()).toBe(true)
  })
})
