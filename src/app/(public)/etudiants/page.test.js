import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

// Client Supabase factice : une réponse par table, le rôle vient de profiles.
let tables
let user

function builder(table) {
  const b = new Proxy(
    {},
    {
      get(_, name) {
        if (name === "then") return (res, rej) => Promise.resolve(tables[table]).then(res, rej)
        if (name === "maybeSingle") return () => Promise.resolve(tables.profileRole)
        return () => b
      },
    },
  )
  return b
}

let selectCalls
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table) => {
      selectCalls.push(table)
      // profiles : compteur étudiants vérifiés ou rôle du visiteur (maybeSingle)
      return table === "profiles" ? builder("profiles") : builder(table)
    },
  }),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal()), preload: vi.fn() }))
vi.mock("@/components/design/select", () => ({ Select: ({ id, name }) => <select id={id} name={name} /> }))
vi.mock("@/components/vitrine/vitrine-navbar", () => ({
  VitrineNavbar: ({ audience }) => <nav data-audience={audience} />,
}))
vi.mock("@/components/vitrine/vitrine-footer", () => ({ VitrineFooter: () => <footer /> }))

const { default: EtudiantsPage, metadata } = await import("./page.js")

const MISSIONS = [
  { id: "m1", title: "Cours de maths niveau 3e", type: "Cours particuliers", city: "Cotonou", budget: 25000, urgency: "low", deadline: null, created_at: "2026-10-01T10:00:00Z" },
]

function ok(count, data) {
  return { data, count, error: null }
}

beforeEach(() => {
  selectCalls = []
  user = null
  tables = {
    missions: ok(3, MISSIONS),
    profiles: ok(10, []),
    reviews: ok(0, []),
    profileRole: { data: { role: "student" }, error: null },
  }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const render = async () => renderToStaticMarkup(await EtudiantsPage())

describe("page /etudiants", () => {
  it("rend le hero tutoyé, la recherche vers /missions et la photo de l'étudiante", async () => {
    const html = await render()
    expect(html).toContain("Bosse entre")
    expect(html).toContain("Encaisse.")
    expect(html).toContain('action="/missions"')
    expect(html).toContain('srcSet="/images/hero/portrait-hero.webp"')
    expect(html).toContain('width="644"')
    expect(html).toContain('height="1100"')
    expect(html).toContain('media="(min-width: 1024px)"')
  })

  it("passe audience etudiants à l'en-tête", async () => {
    expect(await render()).toContain('data-audience="etudiants"')
  })

  it("affiche les missions réelles avec le libellé de leur type", async () => {
    const html = await render()
    expect(html).toContain("Cours de maths niveau 3e")
    expect(html).toContain('href="/missions/m1"')
  })

  it("état vide : invite à créer un compte", async () => {
    tables.missions = ok(0, [])
    const html = await render()
    expect(html).toContain("Sois prêt pour")
    expect(html).toContain('href="/auth/register?role=student"')
  })

  it("état erreur : le reste de la page reste rendu", async () => {
    tables.missions = { data: null, count: null, error: { code: "X", message: "boom" } }
    const html = await render()
    expect(html).toContain("Les missions n&#x27;ont pas pu être chargées")
    expect(html).toContain("Tes gains")
    expect(console.error).toHaveBeenCalled()
  })

  it("visiteur : CTA Créer mon compte, vers l'inscription étudiante", async () => {
    const html = await render()
    expect(html).toContain("Créer mon compte")
    expect(html).toContain('href="/auth/register?role=student"')
    expect(html).not.toContain("Voir les missions pour moi")
  })

  it("étudiant connecté : CTA vers ses missions", async () => {
    user = { id: "u1" }
    const html = await render()
    expect(html).toContain('href="/student/missions"')
    expect(html).toContain("Voir les missions pour moi")
  })

  it("client connecté : la carte famille propose de publier, pas de création de compte étudiant", async () => {
    user = { id: "u2" }
    tables.profileRole = { data: { role: "client" }, error: null }
    const html = await render()
    expect(html).toContain('href="/client/missions/new"')
    expect(html).not.toContain("Voir les missions pour moi")
  })

  it("la carte famille est vouvoyée et renvoie vers l'accueil", async () => {
    const html = await render()
    expect(html).toContain("Vous avez")
    expect(html).toContain("Le marché, les devoirs des enfants, vos documents à mettre en forme")
    expect(html).toContain('href="/"')
  })

  it("pastille en mode qualitatif : les trois villes, pas de compteur", async () => {
    const html = await render()
    expect(html).toContain("Cotonou · Porto-Novo · Abomey-Calavi")
    expect(html).not.toContain("missions ouvertes en ce moment")
  })

  it("pastille en mode live : compteur réel", async () => {
    tables.missions = ok(60, MISSIONS)
    tables.profiles = ok(150, [])
    const html = await render()
    expect(html).toContain("missions ouvertes en ce moment")
  })

  it("métadonnées : titre, description tutoyée, url openGraph", () => {
    expect(metadata.title).toBe("Pour les étudiants")
    expect(metadata.description).toMatch(/Bosse entre deux cours/)
    expect(metadata.description).toContain("Celtiis Cash")
    expect(metadata.openGraph.url).toBe("/etudiants")
    expect(JSON.stringify(metadata)).not.toMatch(/fedapay/i)
  })

  it("contenu : aucun mot ni promesse banni, Celtiis Cash présent", async () => {
    const html = await render()
    const text = html.replace(/<[^>]*>/g, " ")
    expect(text).not.toMatch(/livraison|coursier|\bcourses?\b|saisie|fedapay|J(?:'|&#x27;)ai terminé|recrédit|débité qu/i)
    expect(text).not.toMatch(/\d\s*h\s*ouvrées|72\s*h/i)
    expect(text).not.toMatch(/Pour les clients|Entreprises/)
    expect(text).toContain("Celtiis Cash")
    expect(text).toContain("MTN MoMo")
    expect(text).toContain("Moov Money")
    expect(html).not.toContain("—")
  })

  it("libellés issus du dictionnaire, filtres avec la valeur en base", async () => {
    const html = await render()
    expect(html).toContain("Marché et achats")
    expect(html).toContain("Démarches et files d&#x27;attente")
    expect(html).toContain("Travaux sur ordinateur")
    expect(html).toContain('href="/missions?type=Livraison"')
    expect(html).toContain('href="/missions?type=Cours%20particuliers"')
    expect(html).toContain('href="/missions?type=D%C3%A9marches"')
  })
})
