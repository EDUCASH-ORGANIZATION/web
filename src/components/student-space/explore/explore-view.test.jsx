import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { existsSync, readdirSync } from "node:fs"
import path from "node:path"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const { StudentExploreView, StudentExploreSkeleton } = await import("./explore-view")
const { FiltersSheetView } = await import("./filters-sheet")

const filters = (over) => ({ q: "", type: "", cities: [], urgency: "", budget: "", sort: "", page: 1, ...over })
const mission = (over) => ({
  id: "m1",
  title: "Cours de physique niveau 1re",
  type: "Cours particuliers",
  city: "Cotonou",
  budget: 20000,
  net: 17600,
  urgent: false,
  deadline: "2026-10-30",
  applicationStatus: null,
  ...over,
})
const verified = { key: "verified", label: "Compte vérifié", canApply: true, action: null }

function render(over = {}) {
  const result = {
    filters: filters(),
    hasFilter: false,
    total: 1,
    pageSize: 9,
    verification: verified,
    missions: [mission()],
    ...over,
  }
  return renderToStaticMarkup(<StudentExploreView result={result} />)
}

describe("StudentExploreView : liste", () => {
  it("un seul h1, compteur, types en liens, gain net en montant principal et budget client en petite ligne", () => {
    const html = render({ total: 24 })
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("24 missions ouvertes")
    expect(html).toContain('href="/student/missions?type=Traduction"')
    expect(html).toContain('href="/student/missions"')
    expect(html).toMatch(/e2-amount e2-amount--m">17 600<small>FCFA<\/small>/)
    expect(html).toContain("Budget client 20 000 FCFA")
    expect(html).toContain("88 % du budget du client")
    expect(html).toContain('href="/student/missions/m1"')
  })

  it("affiche le type par son libellé (jamais la valeur de base) et l'étiquette Urgent", () => {
    const html = render({ missions: [mission({ type: "Livraison", urgent: true })] })
    expect(html).toContain("Marché et achats")
    expect(html).toContain("Urgent")
    expect(html).not.toMatch(/>Livraison</)
  })

  it("une mission déjà postulée garde sa place avec son statut et « Suivre »", () => {
    const html = render({ missions: [mission({ applicationStatus: "pending" })] })
    expect(html).toContain("En attente")
    expect(html).toContain("Suivre")
  })

  it("le filtre recherche, ville et budget : étiquettes retirables et lien Tout effacer", () => {
    const html = render({
      filters: filters({ q: "cours", type: "Cours particuliers", cities: ["Cotonou"], budget: "5000-15000" }),
      hasFilter: true,
      total: 2,
    })
    expect(html).toContain("2 missions pour « cours »")
    expect(html).toContain('aria-label="Retirer le filtre Cotonou"')
    expect(html).toContain('aria-label="Retirer le filtre 5 000 à 15 000 FCFA"')
    expect(html).toContain("Tout effacer")
    expect(html).toContain("Filtres · 2")
  })

  it("pagination : pages liées, filtres conservés", () => {
    const html = render({ filters: filters({ type: "Traduction", page: 2 }), total: 30 })
    expect(html).toContain('aria-current="page"')
    expect(html).toContain("10 à 18 sur 30")
    expect(html).toContain('href="/student/missions?type=Traduction&amp;page=3"')
    expect(html).toContain('href="/student/missions?type=Traduction"')
  })

  it("recherche du mobile : GET sur q, autres choix en champs cachés", () => {
    const html = render({ filters: filters({ q: "maths", cities: ["Cotonou", "Porto-Novo"], sort: "prix" }), hasFilter: true })
    expect(html).toContain('role="search"')
    expect(html).toContain('name="q"')
    expect(html).toContain('value="Cotonou,Porto-Novo"')
    expect(html).toContain('type="hidden" name="sort" value="prix"')
  })
})

describe("StudentExploreView : états", () => {
  it("aucun résultat : cite la recherche et propose d'effacer", () => {
    const html = render({ filters: filters({ q: "traduction" }), hasFilter: true, total: 0, missions: [] })
    expect(html).toContain("Aucune mission pour « traduction »")
    expect(html).toContain("Effacer les filtres")
    expect(html).not.toContain("e2-mcard")
  })

  it("aucune mission ouverte, et page vide au-delà du dernier résultat", () => {
    expect(render({ total: 0, missions: [] })).toContain("Aucune mission ouverte pour l&#x27;instant")
    const page = render({ filters: filters({ page: 9 }), total: 0, missions: [] })
    expect(page).toContain("Cette page est vide")
    expect(page).toContain("Revenir à la première page")
  })

  it("page au-delà du dernier résultat avec un filtre actif : page vide, lien vers la page 1 qui garde les filtres", () => {
    const html = render({ filters: filters({ q: "traduction", type: "Traduction", page: 4 }), hasFilter: true, total: 0, missions: [] })
    expect(html).toContain("Cette page est vide")
    expect(html).not.toContain("Aucune mission pour")
    expect(html).toContain('<a class="hero2__link" href="/student/missions?q=traduction&amp;type=Traduction">Revenir à la première page</a>')
  })

  it("erreur : message distinct du vide, bouton Réessayer, un seul h1", () => {
    const html = renderToStaticMarkup(<StudentExploreView result={{ error: "x" }} />)
    expect(html).toContain("Impossible de charger les missions")
    expect(html).toContain("Réessayer")
    expect(html).toContain('role="alert"')
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).not.toContain("e2-02-cols")
  })

  it("chargement : squelette annoncé, un seul h1", () => {
    const html = renderToStaticMarkup(<StudentExploreSkeleton />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain("Chargement en cours")
    expect(html.match(/<h1/g)).toHaveLength(1)
  })

  it("étudiant non vérifié : note « Envoyez votre carte pour postuler » avec lien, missions toujours listées", () => {
    const html = render({
      verification: { key: "not_submitted", label: "Carte à envoyer", canApply: false, action: { label: "Envoyer ma carte", href: "/profile/verify" } },
    })
    expect(html).toContain("Envoyez votre carte pour postuler")
    expect(html).toContain('href="/profile/verify"')
    expect(html).toContain("e2-mcard")
  })

  it("carte refusée et badge expiré : note ferme avec badge d'état ; vérifié ou en examen : pas de note", () => {
    const refused = render({ verification: { key: "rejected", label: "Carte refusée", canApply: false, action: { label: "Renvoyer ma carte", href: "/profile/verify" } } })
    expect(refused).toContain("Renvoyez votre carte pour postuler")
    expect(refused).toContain("Carte refusée")
    const expired = render({ verification: { key: "expired", label: "Badge expiré", canApply: false, action: { label: "Renouveler mon badge", href: "/profile/verify" } } })
    expect(expired).toContain("Renouvelez votre badge pour postuler")
    expect(render({ verification: { key: "pending", label: "Carte en cours d'examen", canApply: true, action: null } })).not.toContain("e2-note")
    expect(render({ verification: null })).not.toContain("e2-note")
    expect(render()).not.toContain("e2-note")
  })
})

describe("FiltersSheetView : feuille de filtres", () => {
  const props = { active: 0, draft: { budget: "", cities: [], urgency: "" }, onOpen() {}, onClose() {}, onDraft() {}, onClear() {}, onApply() {} }

  it("fermée : seul le bouton est rendu", () => {
    const html = renderToStaticMarkup(<FiltersSheetView {...props} open={false} />)
    expect(html).toContain("Filtres")
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('role="dialog"')
  })

  it("ouverte : dialogue titré, trois groupes, choix cochés, actions de pied", () => {
    const html = renderToStaticMarkup(
      <FiltersSheetView {...props} open active={2} draft={{ budget: "5000-15000", cities: ["Cotonou"], urgency: "" }} />,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain("Budget du client")
    expect(html).toContain("Ville")
    expect(html).toContain("Urgence")
    expect(html).toContain("2 filtres actifs")
    expect(html).toContain("Filtres · 2")
    expect(html).toContain("Tout effacer")
    expect(html).toContain("Afficher les missions")
    expect(html.match(/checked=""/g)).toHaveLength(3)
  })
})

describe("vouvoiement et vocabulaire", () => {
  it("aucun tutoiement ni mot banni dans le rendu", () => {
    const html = [
      render(),
      render({ total: 0, missions: [], verification: { key: "not_submitted", label: "x", canApply: false, action: null } }),
      renderToStaticMarkup(<StudentExploreView result={{ error: "x" }} />),
    ]
      .join(" ")
      .replace(/href="[^"]*"/g, "")
    // Registre unique (RD-VOUS-01) : le tutoiement est interdit.
    expect(html).not.toMatch(/(?<![\p{L}])(tu|toi|ton|ta|tes)(?![\p{L}])/iu)
    expect(html).not.toMatch(/livraison|course|saisie|Bientôt/i)
    expect(html).not.toMatch(/[\u2013\u2014]/)
  })
})

describe("structure : aucun loading.js sous student/missions ni parent", () => {
  it("le segment [id] appelle notFound : un loading.js dans son parent rendrait le 404 en 200", () => {
    const base = path.join(process.cwd(), "src", "app", "(student)", "student", "missions")
    const dirs = [base, path.dirname(base), path.join(process.cwd(), "src", "app", "(student)"), path.join(process.cwd(), "src", "app")]
    for (const dir of dirs) expect(existsSync(path.join(dir, "loading.js")), dir).toBe(false)
    const walk = (dir) =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    expect(walk(base).filter((f) => /loading\.(js|jsx)$/.test(f))).toEqual([])
  })
})
