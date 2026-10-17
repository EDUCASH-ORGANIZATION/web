import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), unstable_rethrow: () => {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn() }))

const state = { user: null, sessionProfile: null, tables: {} }
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => makeService() }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.sessionProfile }) }
      return chain
    },
  }),
}))

// Faux client service en mémoire (filtres, tri, plages, comptage) pour le test croisé des compteurs.
function makeService() {
  return {
    auth: { admin: { getUserById: async () => ({ data: { user: null } }) } },
    from(table) {
      const rows = state.tables[table] ?? []
      const q = { filters: [], order: null, range: null, limit: null, head: false }
      const cmp = (c, v, test) => q.filters.push((r) => r[c] != null && test(new Date(r[c]), new Date(v)))
      const b = {
        select: (_cols, opts) => {
          q.head = Boolean(opts?.head)
          return b
        },
        eq: (c, v) => (q.filters.push((r) => r[c] === v), b),
        is: (c, v) => (q.filters.push((r) => (v === null ? r[c] == null : r[c] === v)), b),
        not: (c, _op, v) => (q.filters.push((r) => !(v === null ? r[c] == null : r[c] === v)), b),
        in: (c, list) => (q.filters.push((r) => list.includes(r[c])), b),
        gte: (c, v) => (cmp(c, v, (a, x) => a >= x), b),
        lt: (c, v) => (cmp(c, v, (a, x) => a < x), b),
        order: (c, o) => ((q.order = [c, o?.ascending !== false]), b),
        range: (from, to) => ((q.range = [from, to]), b),
        limit: (n) => ((q.limit = n), b),
        ilike: () => b,
        maybeSingle: async () => ({ data: rows.find((r) => q.filters.every((f) => f(r))) ?? null, error: null }),
        then: (res, rej) => Promise.resolve(run()).then(res, rej),
      }
      function run() {
        let hit = rows.filter((r) => q.filters.every((f) => f(r)))
        if (q.head) return { data: null, count: hit.length, error: null }
        if (q.order) {
          const [c, asc] = q.order
          hit = [...hit].sort((x, y) => (x[c] < y[c] ? -1 : x[c] > y[c] ? 1 : 0) * (asc ? 1 : -1))
        }
        if (q.range) hit = hit.slice(q.range[0], q.range[1] + 1)
        if (q.limit != null) hit = hit.slice(0, q.limit)
        return { data: hit, count: null, error: null }
      }
      return b
    },
  }
}

const { AdminDashboardView, monthPhrase, waitText, itemHref, describeItem, buildDashboardModel } = await import("./admin-dashboard-view")
const { getAdminDashboard } = await import("@/lib/actions/admin-dashboard.actions")
const { getAdminShellData } = await import("@/lib/actions/admin-shell.actions")
const { getVerificationQueue } = await import("@/lib/actions/admin-verifications.actions")

const NOW = "2026-10-15T10:00:00.000Z"
const ID1 = "11111111-1111-4111-8111-111111111111"
const ID2 = "22222222-2222-4222-8222-222222222222"
const ID3 = "33333333-3333-4333-8333-333333333333"

const baseData = (over = {}) => ({
  now: NOW,
  today: "2026-10-15",
  alerts: { ok: true, total: 0, items: [] },
  withdrawals: { ok: true, total: 0, items: [] },
  dossiers: { ok: true, total: 0, dossiers: [] },
  escrow: { ok: true, total: 185000, fundedMissions: 14 },
  commissions: { ok: true, month: "2026-10", total: 48300 },
  missions: { ok: true, published: 42, filled: 31 },
  recent: null,
  ...over,
})

const dossier = (userId, name, submittedAt = "2026-10-12T09:00:00Z") => ({ userId, name, submittedAt, createdAt: "2026-10-01T08:00:00Z" })

const withDossiers = (list, total = list.length) =>
  baseData({ dossiers: { ok: true, total, dossiers: list } })

const render = (props) => renderToStaticMarkup(<AdminDashboardView firstName="Mawuli" {...props} />)
const flags = (html) => html.match(/class="flag2"/g) ?? []
const colored = (html) => html.match(/class="money2[ "]/g) ?? []

describe("AdminDashboardView : avec alerte d'argent", () => {
  const data = baseData({
    alerts: {
      ok: true,
      total: 2,
      items: [
        { reason: "negative-balance", userId: ID1, name: "Edwige Sossa", balance: -4500, reserved: 0, gap: 4500 },
        { reason: "reserved-over-balance", userId: ID2, name: "Sèna Agossou", balance: 1000, reserved: 8000, gap: 7000 },
      ],
    },
    withdrawals: { ok: true, total: 1, items: [{ id: "w1", userId: ID3, name: "Koffi Dossou", amount: 15000, createdAt: "2026-10-14T08:00:00Z" }] },
    dossiers: { ok: true, total: 4, dossiers: [dossier(ID1, "Codjo Ahouansou"), dossier(ID2, "Nadège Kpadonou", "2026-10-14T10:00:00Z")] },
  })
  const html = render({ data })

  it("un seul h1, salutation vouvoyée neutre et date du Bénin", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain("Bonjour, Mawuli")
    expect(html).toContain("Jeudi 15 octobre")
  })

  it("total à traiter = alertes + retrait + dossiers (total exact du serveur), détail par nature", () => {
    expect(html).toMatch(/hero2__figure">7</)
    expect(html).toContain("<b>3</b> alertes d&#x27;argent")
    expect(html).toContain("<b>4</b> dossiers de vérification")
  })

  it("élément prioritaire : alerte d'argent en tête, étiquette citron, bouton encre vers les portefeuilles", () => {
    expect(html).toContain("Solde négatif : Edwige Sossa")
    expect(html).toContain("Priorité haute · argent")
    expect(flags(html)).toHaveLength(1)
    expect(html).toContain('class="btn btn--dark" href="/admin/wallets"')
    expect(html).toContain("Voir le portefeuille")
    expect(html).toContain("Passer au suivant")
    expect(html).toContain("−4\u202F500\u00A0FCFA")
  })

  it("suite de la file : alertes, retrait, puis dossiers du plus ancien au plus récent", () => {
    const list = html.match(/<section class="list2"[\s\S]*<\/section>/)[0]
    const order = ["Sèna Agossou · réservé", "Koffi Dossou · retrait sans virement", "Codjo Ahouansou · vérification", "Nadège Kpadonou · vérification"]
    const at = order.map((t) => list.indexOf(t))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(html).toContain("Voir toute la file")
    expect(html).toContain('href="/admin/verifications"')
    expect(html).toContain('href="/admin/verifications?id=' + ID1 + '"')
  })

  it("une seule carte colorée : argent de la plateforme, séquestre et commissions du mois, sans montant en dur", () => {
    expect(colored(html)).toHaveLength(1)
    expect(html).toContain("Argent de la plateforme")
    expect(html).toContain("185\u202F000")
    expect(html).toContain("14 missions financées")
    expect(html).toContain("Commissions d&#x27;octobre")
    expect(html).toContain("48 300")
    expect(html).toContain("Portefeuilles")
  })

  it("carte blanche missions publiées sur 7 jours, pourvues", () => {
    expect(html).toContain("Missions publiées")
    expect(html).toContain("7 derniers jours · 31 pourvues")
  })

  it("aucun histogramme, bento ni calendrier, aucun prestataire nommé", () => {
    expect(html).not.toMatch(/histogram|bento|calendar|vchart/i)
    expect(html).not.toMatch(/fedapay|kkiapay|momo/i)
  })
})

describe("AdminDashboardView : sans alerte d'argent", () => {
  const html = render({ data: withDossiers([dossier(ID1, "Codjo Ahouansou"), dossier(ID2, "Nadège Kpadonou", "2026-10-14T10:00:00Z")], 2) })

  it("la file commence par le dossier le plus ancien, sans citron", () => {
    expect(html).toContain("Vérifier la carte de Codjo Ahouansou")
    expect(html).toContain("Examiner le dossier")
    expect(html).toContain("En attente depuis 3 jours.")
    expect(html).not.toContain("Priorité haute")
    expect(flags(html)).toHaveLength(0)
    expect(html).toContain("flag2 flag2--neutre")
    expect(html).toMatch(/hero2__figure">2</)
    expect(html).not.toContain("alerte d&#x27;argent")
    expect(html).toContain("<b>2</b> dossiers de vérification")
  })

  it("lien du bouton et de « Passer au suivant » vers la file de vérification", () => {
    expect(html).toContain(`class="btn btn--dark" href="/admin/verifications?id=${ID1}"`)
    expect(html).toContain(`href="/admin/verifications?id=${ID2}">Passer au suivant`)
  })

  it("un seul dossier : pas de « Passer au suivant » ni de liste", () => {
    const one = render({ data: withDossiers([dossier(ID1, "Codjo Ahouansou")]) })
    expect(one).not.toContain("Passer au suivant")
    expect(one).not.toContain("Ensuite dans la file")
  })
})

describe("AdminDashboardView : file vide", () => {
  const recent = { ok: true, users: [{ userId: ID1, name: "Afiavi Dossou", role: "student", createdAt: "2026-10-14T10:00:00Z" }] }
  const html = render({ data: baseData({ recent }) })

  it("tout est à jour : sans citron, ni bouton d'action, avec les derniers inscrits", () => {
    expect(html).toContain("Rien à traiter pour le moment")
    expect(html).toContain("Tout est à jour")
    expect(flags(html)).toHaveLength(0)
    expect(html).not.toContain("hero2__actions")
    expect(html).toMatch(/hero2__figure">0</)
    expect(html).toContain("Derniers inscrits")
    expect(html).toContain("Afiavi Dossou")
    expect(html).toContain("Étudiant")
    expect(html).toContain(`href="/admin/users/${ID1}"`)
    expect(html).not.toContain("Ensuite dans la file")
  })

  it("aucune donnée privée dans le HTML (ni e-mail, ni téléphone)", () => {
    expect(html).not.toMatch(/@|\+229/)
  })
})

describe("AdminDashboardView : blocs en erreur", () => {
  it("un bloc argent en erreur n'empêche pas le reste, message et bouton Réessayer", () => {
    const html = render({ data: { ...withDossiers([dossier(ID1, "Codjo Ahouansou")]), escrow: { ok: false } } })
    expect(html).toContain("Une partie des données n&#x27;a pas pu être chargée")
    expect(html).toContain("Réessayer")
    expect(html).toContain("Indisponible")
    expect(html).toContain("Vérifier la carte de Codjo Ahouansou")
    expect(html).toContain("Commissions d&#x27;octobre")
    expect(html).toContain('role="alert"')
  })

  it("file en erreur : jamais « tout est à jour »", () => {
    const html = render({ data: baseData({ dossiers: { ok: false }, alerts: { ok: false }, withdrawals: { ok: false } }) })
    expect(html).not.toContain("Tout est à jour")
    expect(html).toContain("La file n&#x27;a pas pu être calculée en entier")
    expect(html).toContain("Réessayer")
  })

  it("chaque bloc en erreur est repéré", () => {
    const model = buildDashboardModel(baseData({ missions: { ok: false }, commissions: { ok: false } }))
    expect(model.failed.sort()).toEqual(["commissions", "missions"])
    expect(model.queueComplete).toBe(true)
  })

  it("lecture entièrement refusée : erreur distincte, salutation conservée", () => {
    const html = render({ data: null, error: "Le service est momentanément indisponible. Réessayez dans un instant." })
    expect(html).toContain("Le tableau de bord n&#x27;a pas pu être chargé")
    expect(html).toContain("Bonjour, Mawuli")
    expect(html).toContain("indisponible")
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).not.toContain("Rien à traiter")
  })

  it("sans prénom : simple « Bonjour »", () => {
    expect(render({ data: baseData(), firstName: "" })).toContain(">Bonjour<")
  })
})

describe("aides pures", () => {
  const now = new Date(NOW)

  it("mois précédé de la bonne préposition", () => {
    expect(monthPhrase("2026-10")).toBe("d'octobre")
    expect(monthPhrase("2026-04")).toBe("d'avril")
    expect(monthPhrase("2026-08")).toBe("d'août")
    expect(monthPhrase("2026-11")).toBe("de novembre")
  })

  it("ancienneté d'un dossier", () => {
    expect(waitText("2026-10-15T08:00:00Z", now)).toBe("Dossier reçu aujourd'hui.")
    expect(waitText("2026-10-14T08:00:00Z", now)).toBe("Dossier reçu hier.")
    expect(waitText("2026-10-13T08:00:00Z", now)).toBe("En attente depuis 2 jours.")
    expect(waitText(null, now)).toBe("Dossier en attente d'examen.")
  })

  it("liens et libellés des éléments de la file", () => {
    expect(itemHref({ kind: "dossier", userId: ID1 })).toBe(`/admin/verifications?id=${ID1}`)
    expect(itemHref({ kind: "money", reason: "negative-balance", userId: ID1 })).toBe("/admin/wallets")
    const stuck = describeItem({ kind: "money", reason: "withdrawal-stuck", name: "", amount: 15000, since: "2026-10-14T08:00:00Z" }, now)
    expect(stuck.heroTitle).toContain("Compte sans nom")
    expect(stuck.text).toContain("sans référence de paiement enregistrée")
    expect(stuck.text).toContain("il y a 1 j")
    expect(stuck.text).toContain("vérifiez chez le prestataire de paiement que le virement n'est pas parti")
  })
})

describe("compteur de l'accueil, de la coquille et de l'onglet À examiner : mêmes données", () => {
  const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
  const student = (n, over = {}) => ({
    user_id: uid(n),
    role: "student",
    full_name: `Etudiant ${n}`,
    is_verified: false,
    verified_until: null,
    rejection_reason: null,
    verification_submitted_at: `2026-10-0${n}T09:00:00+00:00`,
    created_at: "2026-09-01T08:00:00+00:00",
    ...over,
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(NOW))
    state.user = { id: uid(99) }
    state.sessionProfile = { role: "admin", full_name: "Admin", is_suspended: false }
    state.tables = {
      profiles: [
        student(1),
        student(2),
        student(3, { verification_submitted_at: "2026-10-05T09:00:00+00:00" }),
        student(4, { rejection_reason: "Photo floue ou illisible" }),
        student(5, { is_verified: true, verified_until: "2027-01-01" }),
        student(6),
        student(7, { verified_until: "2026-06-01", verification_submitted_at: "2025-05-01T09:00:00+00:00" }),
        student(8, { verified_until: "2026-06-01", verification_submitted_at: "2026-09-20T09:00:00+00:00" }),
        student(9, { verified_until: "2026-06-01", verification_submitted_at: "2026-05-20T09:00:00+00:00" }),
      ],
      student_profiles: [1, 2, 3, 4, 5, 7, 8, 9].map((n) => ({ user_id: uid(n), school: "EPAC", level: "L3", card_url: `${uid(n)}/card.jpg` })),
      wallets: [],
      wallet_transactions: [],
      missions: [],
    }
  })
  afterEach(() => vi.useRealTimers())

  it("accueil, coquille et onglet affichent le même nombre, et la vue l'imprime", async () => {
    const dashboard = await getAdminDashboard()
    const shell = await getAdminShellData()
    const queue = await getVerificationQueue({})
    const expected = queue.counts["a-examiner"]
    // 1, 2, 3, 8 (carte renvoyée après l'échéance) et 9 (renouvellement anticipé non traité) sont à examiner ;
    // 4 refusé, 5 vérifié, 6 incomplet, 7 expiré (carte antérieure à la dernière validation).
    expect(expected).toBe(5)
    expect(dashboard.dossiers.total).toBe(expected)
    expect(shell.shell.pendingCount).toBe(expected)
    const html = render({ data: dashboard })
    expect(html).toMatch(new RegExp(`hero2__figure">${expected}<`))
    expect(html).toContain(`<b>${expected}</b> dossiers de vérification`)
  })

  it("le plus ancien dossier de l'accueil est le premier de la file de vérification", async () => {
    const dashboard = await getAdminDashboard()
    const queue = await getVerificationQueue({})
    expect(dashboard.dossiers.dossiers[0].userId).toBe(queue.rows[0].userId)
  })
})
