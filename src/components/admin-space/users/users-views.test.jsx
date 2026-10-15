import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const refresh = vi.fn()
const suspendAccount = vi.fn()
const reactivateAccount = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/admin-users.actions", () => ({
  suspendAccount: (...a) => suspendAccount(...a),
  reactivateAccount: (...a) => reactivateAccount(...a),
}))

const { ToastProvider } = await import("@/components/app-ui/toast")
const { UsersView, displayName } = await import("./users-view")
const { UserDetailView, ratingText, subtitleParts } = await import("./user-detail-view")
const { SuspendDialog } = await import("./suspend-dialog")
const { ReactivateDialog } = await import("./reactivate-dialog")

const ID1 = "11111111-1111-4111-8111-111111111111"
const ID2 = "22222222-2222-4222-8222-222222222222"
const ID3 = "33333333-3333-4333-8333-333333333333"

const params = (over = {}) => ({ q: "", role: "", verif: "", statut: "", page: 1, ...over })

const row = (over = {}) => ({
  userId: ID1,
  name: "Sèna Agossou",
  email: "sena.a@exemple.bj",
  role: "student",
  verification: "Vérifié",
  isSuspended: false,
  city: "Abomey-Calavi",
  balance: 47600,
  missions: 23,
  createdAt: "2026-03-12T09:00:00Z",
  isSelf: false,
  ...over,
})

const list = (over = {}) => ({
  params: params(),
  requestedPage: 1,
  pageClamped: false,
  total: 3,
  pageCount: 1,
  pageSize: 20,
  totals: { students: 2, clients: 1, admins: 0, all: 3 },
  rows: [row()],
  today: "2026-10-15",
  ...over,
})

const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

const html = (node) => renderToStaticMarkup(<ToastProvider>{node}</ToastProvider>)

const detail = (over = {}) => ({
  onglet: "apercu",
  today: "2026-10-15",
  user: {
    userId: ID1,
    name: "Sèna Agossou",
    email: "sena.a@exemple.bj",
    phone: "+2290197000008",
    role: "student",
    city: "Abomey-Calavi",
    isSuspended: false,
    isSelf: false,
    createdAt: "2026-03-12T09:00:00Z",
    missionsDone: 23,
    rating: 4.9,
    school: "IFRI",
    level: "Licence 2",
  },
  verification: {
    tab: "verifies",
    label: "Vérifié",
    verifiedUntil: "2027-03-12",
    rejectionReason: null,
    submittedAt: "2026-03-10T08:00:00Z",
    hasCard: true,
  },
  missions: {
    count: 1,
    role: "student",
    rows: [{ id: ID2, title: "Cours de maths", type: "Livraison", status: "in_progress", budget: 25000, city: "Cotonou", deadline: null, createdAt: "2026-10-01" }],
  },
  applicationsCount: 2,
  wallet: {
    balance: 47600,
    reserved: 22000,
    transactions: [{ id: ID3, type: "release", amount: 22000, createdAt: "2026-10-01T10:00:00Z", missionId: ID2 }],
  },
  ...over,
})

describe("UsersView", () => {
  it("rend le tableau : un seul h1, lignes vers la fiche, rôle en texte, sans bouton Suspendre", () => {
    const out = html(<UsersView data={list()} />)
    expect(out.match(/<h1/g)).toHaveLength(1)
    expect(out).toContain("Utilisateurs")
    expect(out).toContain("3 comptes")
    expect(out).toContain(`href="/admin/users/${ID1}"`)
    expect(out).toContain("Sèna Agossou")
    expect(out).toContain("Étudiant")
    expect(out).toContain("Vérifié")
    expect(out).not.toMatch(/Suspendre/)
    expect(out).toContain("47")
    expect(out).toContain("FCFA")
    expect(out).toContain('data-label="Solde disponible"')
  })

  it("profil sans nom : mention neutre avec l'e-mail ; suspendu atténué ; admin sans solde", () => {
    const out = html(
      <UsersView
        data={list({
          rows: [
            row({ userId: ID1, name: "", email: "k.hounsou@exemple.bj" }),
            row({ userId: ID2, name: "Ulrich Zinsou", isSuspended: true }),
            row({ userId: ID3, name: "Fifamè Gbaguidi", role: "admin", verification: "", balance: null, missions: null }),
          ],
        })}
      />,
    )
    expect(out).toContain("Profil incomplet")
    expect(out).toContain("k.hounsou@exemple.bj")
    expect(out).toContain("a2-03-row--off")
    expect(out).toContain("Suspendu")
    expect(out).toContain("Administrateur")
    expect(displayName({ name: "" })).toBe("Profil incomplet")
  })

  it("marque le compte connecté", () => {
    expect(html(<UsersView data={list({ rows: [row({ isSelf: true })] })} />)).toContain("(vous)")
  })

  it("aucun résultat : rappelle la recherche et propose d'effacer les filtres", () => {
    const out = html(<UsersView data={list({ rows: [], total: 0, params: params({ q: "agbodjan", statut: "suspendu" }) })} />)
    expect(out).toContain("Aucun utilisateur trouvé")
    expect(out).toContain("agbodjan")
    expect(out).toContain("Effacer les filtres")
    expect(out).toContain('href="/admin/users"')
    expect(out).not.toContain("<table")
  })

  it("liste vide sans filtre", () => {
    const out = html(<UsersView data={list({ rows: [], total: 0, totals: { students: 0, clients: 0, admins: 0, all: 0 } })} />)
    expect(out).toContain("Aucun compte pour le moment.")
  })

  it("page hors limites : note grise avec la dernière page", () => {
    const out = html(<UsersView data={list({ pageClamped: true, requestedPage: 40, params: params({ page: 13 }), pageCount: 13 })} />)
    expect(out).toContain("La page 40 n&#x27;existe pas")
    expect(out).toContain("(13)")
  })

  it("pagination numérotée avec page courante", () => {
    const out = html(<UsersView data={list({ pageCount: 13, params: params({ page: 7 }) })} />)
    expect(out).toContain('aria-current="page"')
    expect(out).toContain('aria-label="Page 13"')
    expect(out).toContain("…")
    expect(out).toContain("page=6")
    expect(out).toContain("page=8")
  })

  it("erreur de chargement distincte du vide, sans compteur à 0", () => {
    const out = html(<UsersView data={null} error="Les comptes n'ont pas pu être chargés. Réessayez dans un instant." />)
    expect(out).toContain("n&#x27;ont pas pu être chargés")
    expect(out).toContain("Réessayer")
    expect(out).not.toContain("0 compte")
    expect(out).not.toContain("<table")
  })

  it("recherche et filtres : champ étiqueté, rôle en liens, aucun tiret cadratin ni tutoiement", () => {
    const out = html(<UsersView data={list({ params: params({ q: "sèna", role: "student" }) })} />)
    expect(out).toContain('role="search"')
    expect(out).toContain('aria-label="Rechercher par nom, e-mail ou téléphone"')
    expect(out).toContain('name="role"')
    expect(out).toContain('value="student"')
    expect(out).toContain('role="radiogroup"')
    expect(out).not.toMatch(DASHES)
    expect(out).not.toMatch(/\b(tu|ton|ta|tes|vérifie)\b/i)
  })

  it("n'expose ni téléphone ni jeton", () => {
    const out = html(<UsersView data={list()} />)
    expect(out).not.toMatch(/\+229|fcm|2290/)
  })
})

describe("UserDetailView", () => {
  it("rend la fiche d'un étudiant : nom en h1, 3 indicateurs, onglets en liens, Suspendre", () => {
    const out = html(<UserDetailView data={detail()} />)
    expect(out.match(/<h1/g)).toHaveLength(1)
    expect(out).toContain("Sèna Agossou")
    expect(out).toContain("Missions terminées")
    expect(out).toContain("4,9 / 5")
    expect(out).toContain("Disponible")
    expect(out).toContain(`href="/admin/users/${ID1}?onglet=verification"`)
    expect(out).toContain('aria-current="page"')
    expect(out).toContain("Suspendre")
    expect(out).toContain("sena.a@exemple.bj")
    expect(out).toContain("+2290197000008")
    expect(out).not.toContain("Réactiver")
    expect(out).toContain('href="/admin/users"')
  })

  it("compte suspendu : Réactiver est le seul bouton d'action, note grise", () => {
    const d = detail()
    d.user.isSuspended = true
    const out = html(<UserDetailView data={d} />)
    expect(out).toContain("Réactiver")
    expect(out).not.toContain(">Suspendre<")
    expect(out).toContain("Ce compte est suspendu")
  })

  it("compte administrateur : aucune action ni onglet de portefeuille", () => {
    const d = detail({ verification: null, wallet: null, missions: { count: 0, rows: [], role: "admin" } })
    d.user.role = "admin"
    const out = html(<UserDetailView data={d} />)
    expect(out).not.toContain("Suspendre")
    expect(out).not.toContain("Réactiver")
    expect(out).not.toContain("Portefeuille")
    expect(out).toContain("ne peut pas être modifié")
  })

  it("son propre compte : aucune action, mention explicite", () => {
    const d = detail({ verification: null })
    d.user.role = "admin"
    d.user.isSelf = true
    const out = html(<UserDetailView data={d} />)
    expect(out).not.toContain("Suspendre")
    expect(out).toContain("Il s&#x27;agit de votre compte")
  })

  it("onglet vérification : état, lien vers le dossier, aucune adresse de carte", () => {
    const d = detail({ onglet: "verification" })
    d.verification = { ...d.verification, tab: "refuses", label: "Carte refusée", rejectionReason: "Photo floue ou illisible" }
    const out = html(<UserDetailView data={d} />)
    expect(out).toContain("Carte refusée")
    expect(out).toContain("Photo floue ou illisible")
    expect(out).toContain(`/admin/verifications?onglet=refuses&amp;id=${ID1}`)
    expect(out).not.toMatch(/https?:\/\/[^"]*sign/)
  })

  it("onglet missions : type par libellé (jamais la valeur brute), statut, lien vers le détail", () => {
    const out = html(<UserDetailView data={detail({ onglet: "missions" })} />)
    expect(out).toContain("Marché et achats")
    expect(out).not.toMatch(/>Livraison</)
    expect(out).toContain("En cours")
    expect(out).toContain(`href="/admin/missions/${ID2}"`)
  })

  it("onglet missions vide", () => {
    const out = html(<UserDetailView data={detail({ onglet: "missions", missions: { count: 0, role: "client", rows: [] } })} />)
    expect(out).toContain("Aucune mission")
  })

  it("onglet portefeuille : lecture seule, aucun bouton d'argent, libellés français", () => {
    const out = html(<UserDetailView data={detail({ onglet: "portefeuille" })} />)
    expect(out).toContain("Lecture seule")
    expect(out).toContain("Libération")
    expect(out).toContain("En séquestre")
    expect(out).not.toMatch(/Rembourser|Recréditer|Libérer<|FedaPay/i)
  })

  it("client : indicateurs missions publiées, pas d'onglet Vérification", () => {
    const d = detail({ verification: null, missions: { count: 10, role: "client", rows: [] } })
    d.user.role = "client"
    const out = html(<UserDetailView data={d} />)
    expect(out).toContain("Missions publiées")
    expect(out).not.toContain("onglet=verification")
  })

  it("erreur de chargement", () => {
    const out = html(<UserDetailView data={null} error="Les comptes n'ont pas pu être chargés." />)
    expect(out).toContain("La fiche n&#x27;a pas pu être chargée")
    expect(out).toContain("Réessayer")
  })

  it("aucun tiret cadratin ni tutoiement dans la fiche", () => {
    const out = html(<UserDetailView data={detail({ onglet: "portefeuille" })} />)
    expect(out).not.toMatch(DASHES)
    expect(out).not.toMatch(/\b(tu|ton|ta|tes)\b/i)
  })

  it("helpers : note et sous-titre", () => {
    expect(ratingText(0)).toBe("Pas encore de note")
    expect(ratingText("x")).toBe("Pas encore de note")
    expect(ratingText(4)).toBe("4,0 / 5")
    expect(subtitleParts(detail())).toEqual(["Étudiant", "Vérifié", "Actif", "Licence 2 · IFRI", "Abomey-Calavi"])
  })
})

describe("modales AD05", () => {
  it("fermées : rien n'est rendu", () => {
    expect(html(<SuspendDialog open={false} onClose={() => {}} onConfirm={() => {}} name="Sèna" />)).not.toContain("Suspendre")
    expect(html(<ReactivateDialog open={false} onClose={() => {}} onConfirm={() => {}} name="Sèna" />)).not.toContain("Réactiver")
  })

  it("suspension : motif obligatoire, conséquences en notes, aucune durée ni e-mail annoncé, vouvoiement", () => {
    const out = html(<SuspendDialog open onClose={() => {}} onConfirm={() => {}} name="Sèna" />)
    expect(out).toContain("Suspendre Sèna ?")
    expect(out).toContain("Motif")
    expect(out).toContain("Le compte ne peut plus se connecter.")
    expect(out).toContain("restent en l&#x27;état")
    expect(out).toContain("pas prévenu par e-mail")
    expect(out).toContain("Suspendre le compte")
    expect(out).toContain('role="dialog"')
    expect(out).not.toMatch(/7 jours|30 jours|Illimitée/)
    expect(out).not.toMatch(DASHES)
    expect(out).not.toMatch(/\b(tu|ton|ta|tes)\b/i)
  })

  it("réactivation : motif obligatoire, bouton encre", () => {
    const out = html(<ReactivateDialog open onClose={() => {}} onConfirm={() => {}} name="Sèna" />)
    expect(out).toContain("Réactiver Sèna ?")
    expect(out).toContain("Réactiver le compte")
    expect(out).toContain("btn--dark")
    expect(out).not.toContain("btn--danger\"")
  })
})
