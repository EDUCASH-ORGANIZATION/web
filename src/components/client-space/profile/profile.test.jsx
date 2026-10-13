import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("@/components/app-ui/toast", () => ({ useAppToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/components/shared/supabase-provider", () => ({
  useSupabase: () => ({ supabase: { storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn() }) } } }),
}))
vi.mock("@/lib/actions/profile.actions", () => ({ updateClientProfile: vi.fn() }))

const { formatAmount } = await import("@/lib/app/format")
const { ClientProfileView, monthYear, ratingValue, missingProfileItems } = await import("./profile-view")
const { ProfileEditView, checkLogoFile, validateProfileForm, submitProfile, LOGO_MAX_BYTES } = await import("./profile-edit-form")

const IDENTITY = {
  userId: "u1",
  fullName: "Rosine Houngbédji",
  companyName: "Boutique Ayaba",
  city: "Cotonou",
  avatarUrl: "https://proj.supabase.co/storage/v1/object/public/avatars/u1/avatar.png",
  phone: "+2290197452108",
  memberSince: "2026-04-02T10:00:00Z",
}
const STATS = { published: 13, active: 4, done: 8, cancelled: 1, totalSpent: 98000, rating: 4.8, reviewsCount: 6 }
const REVIEWS = [
  { id: "r1", rating: 5, comment: "Consignes claires, enfants adorables.", createdAt: "2026-10-08T10:00:00Z", authorFirstName: "Afiavi", missionTitle: "Garde d'enfants mercredi" },
  { id: "r2", rating: 4, comment: null, createdAt: "2026-09-12T10:00:00Z", authorFirstName: "Nadège", missionTitle: null },
]
const summary = (over = {}) => ({
  identity: { ...IDENTITY, ...over.identity },
  stats: { ...STATS, ...over.stats },
  reviews: over.reviews ?? REVIEWS,
})

const view = (over, props = {}) =>
  renderToStaticMarkup(<ClientProfileView summary={summary(over)} logoutAction={() => {}} {...props} />)
// Le script de rejeu de formulaire injecté par React (action serveur) n'est pas du contenu visible.
const text = (html) =>
  html
    .replace(/<script>[^]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")

describe("profil client : consultation", () => {
  const html = view()
  const t = text(html)

  it("a un seul h1 « Mon profil » et l'identité", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain("Mon profil")
    expect(t).toContain("Rosine Houngbédji")
    expect(t).toContain("Boutique Ayaba · affichée sur vos missions")
    expect(t).toContain("Cotonou")
    expect(t).toContain("Membre depuis avril 2026")
    expect(t).toContain("4,8 / 5 · 6 avis d'étudiants")
  })

  it("rend les 4 chiffres sur une rangée avec les comptes et le total dépensé", () => {
    expect(html).toContain("stats2 stats2--4")
    expect(t).toContain("Missions publiées 13")
    expect(t).toContain("4 actives · 1 annulée")
    expect(t).toContain("Terminées 8")
    expect(t).toContain("Total dépensé 98 000 FCFA")
    expect(html).toContain(formatAmount(98000).split("\u00a0")[0])
    expect(html).toContain("commission comprise")
    expect(t).toContain("Note des étudiants 4,8 / 5")
    expect(t).toContain("6 avis reçus")
  })

  it("liste les avis avec le prénom de l'auteur et le titre de la mission, en étoiles nommées", () => {
    expect(t).toContain("Avis des étudiants 6")
    expect(t).toContain("Afiavi")
    expect(t).toContain("Garde d'enfants mercredi")
    expect(t).toContain("Consignes claires, enfants adorables.")
    expect(html).toContain('aria-label="Note : 5 sur 5"')
    expect(html).toContain('aria-label="Note : 4 sur 5"')
    expect(t).toContain("octobre 2026")
  })

  it("le dit quand l'action ne renvoie que les avis les plus récents, et pas sinon", () => {
    expect(t).toContain("Les 2 avis les plus récents sont affichés.")
    expect(text(view({ stats: { reviewsCount: 2 } }))).not.toContain("les plus récents")
  })

  it("montre le téléphone du propriétaire et précise qu'il reste privé", () => {
    expect(t).toContain("01 97 45 21 08")
    expect(t).toContain("n'est jamais affiché publiquement")
  })

  it("n'a aucun bouton encre en consultation, un lien Modifier et un lien gris de déconnexion", () => {
    expect(html).not.toContain("btn--dark")
    expect(html).toContain('href="/client/profile/edit"')
    expect(t).toContain("Modifier le profil")
    expect(html).toMatch(/<form[^>]*>\s*<button type="submit" class="link2 link2--muted profile2__out">/)
    expect(t).toContain("Se déconnecter")
  })

  it("profil complet : pas de bloc « À faire »", () => {
    expect(t).not.toContain("Complétez votre profil")
  })

  it("est vouvoyé, sans mot banni ni tiret cadratin ni couleur en dur", () => {
    expect(t).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
    expect(t).not.toMatch(/livraison|course|coursier|saisie|bientôt/i)
    expect(html).not.toMatch(/[\u2013\u2014]|style=|#[0-9a-f]{6}/i)
  })

  it("ne contient ni email ni numéro des auteurs d'avis", () => {
    expect(html).not.toMatch(/@|\+229019/)
  })
})

describe("profil client : états", () => {
  it("sans avis : explique et ne rend pas de note inventée", () => {
    const t = text(view({ reviews: [], stats: { rating: 0, reviewsCount: 0 } }))
    expect(t).toContain("Pas encore d'avis")
    expect(t).toContain("Les étudiants vous notent après chaque mission terminée")
    expect(t).toContain("Pas de note")
    expect(t).toContain("aucun avis reçu")
    expect(t).not.toContain("0 / 5")
  })

  it("total dépensé indisponible : jamais un faux 0", () => {
    const html = view({ stats: { totalSpent: null } })
    const t = text(html)
    expect(t).toContain("Total dépensé Indisponible")
    expect(t).not.toMatch(/Total dépensé 0/)
    expect(t).not.toContain("commission comprise")
  })

  it("total dépensé à 0 FCFA quand aucune libération (lecture réussie)", () => {
    expect(text(view({ stats: { totalSpent: 0 } }))).toMatch(/Total dépensé 0\s*FCFA/)
  })

  it("autres chiffres indisponibles : Indisponible sans NaN", () => {
    const t = text(view({ stats: { published: null, done: null, active: null, cancelled: null, reviewsCount: null } }))
    expect(t).toMatch(/Missions publiées Indisponible/)
    expect(t).toMatch(/Terminées Indisponible/)
    expect(t).not.toMatch(/NaN|undefined|null/)
  })

  it("profil incomplet : invitation à compléter, sans chiffre inventé", () => {
    const html = view({ identity: { companyName: null, phone: null, avatarUrl: null } })
    const t = text(html)
    expect(t).toContain("Structure non renseignée")
    expect(t).toContain("À faire")
    expect(t).toContain("Complétez votre profil")
    expect(t).toContain("Il manque le nom de votre structure, votre téléphone, un logo ou une photo.")
    expect(t).toContain("Compléter mon profil")
    expect(t).toContain("Non renseigné")
    expect(html).toContain('href="/client/profile/edit"')
  })

  it("erreur de chargement : état d'erreur avec le seul h1, sans chiffres", () => {
    const html = renderToStaticMarkup(<ClientProfileView error="Impossible de charger votre profil." />)
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('role="alert"')
    expect(text(html)).toContain("Impossible de charger votre profil")
    expect(html).not.toContain("stats2")
  })

  it("échappe le nom, la structure, les commentaires et les titres", () => {
    const html = view({
      identity: { fullName: "<b>Hack</b>", companyName: '<img src=x onerror="a()">' },
      reviews: [{ ...REVIEWS[0], comment: "<script>x()</script>", authorFirstName: "<i>A</i>", missionTitle: "<u>T</u>" }],
    })
    for (const raw of ["<b>Hack", "<img src=x", "<script>x()", "<i>A", "<u>T"]) expect(html).not.toContain(raw)
    expect(html).toContain("&lt;script&gt;")
  })
})

describe("helpers de la vue", () => {
  it("monthYear, ratingValue et missingProfileItems", () => {
    expect(monthYear("2026-04-02T10:00:00Z")).toBe("avril 2026")
    expect(monthYear(null)).toBe("")
    expect(monthYear("pas une date")).toBe("")
    expect(ratingValue(4.84)).toBe("4,8")
    expect(ratingValue("x")).toBe("0")
    expect(missingProfileItems({ companyName: "A", phone: "B", avatarUrl: "C" })).toEqual([])
    expect(missingProfileItems({})).toHaveLength(3)
  })
})

describe("profil client : édition", () => {
  const render = (over) => renderToStaticMarkup(<ProfileEditView summary={summary(over)} />)
  const html = render()
  const t = text(html)

  it("a un seul h1 et le formulaire prérempli", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(t).toContain("Modifier mon profil")
    expect(html).toContain('value="Rosine Houngbédji"')
    expect(html).toContain('value="Boutique Ayaba"')
    expect(html).toContain('value="01 97 45 21 08"')
  })

  it("relie un libellé visible à chaque champ", () => {
    for (const label of ["Nom du contact", "Nom de la structure", "Ville", "Téléphone", "Logo ou photo"]) {
      expect(t).toContain(label)
    }
    expect(html.match(/<label\b/g).length).toBeGreaterThanOrEqual(4)
    expect(html).toContain('autoComplete="tel-national"')
  })

  it("utilise le PhoneInput béninois (préfixe +229) et la liste de villes du système", () => {
    expect(html).toContain("control__prefix")
    expect(t).toContain("+229")
    expect(html).toContain("ds-select")
    expect(html).toContain('type="hidden"')
    expect(html).toContain('value="Cotonou"')
  })

  it("annonce le formats du logo et propose Changer", () => {
    expect(t).toContain("JPG, PNG ou WebP · 3 Mo maximum")
    expect(t).toContain("Changer")
    expect(html).toContain("accept=\"image/png,image/jpeg,image/webp\"")
  })

  it("a un seul bouton encre « Enregistrer les modifications » et un lien Annuler", () => {
    expect(html.match(/btn--dark/g)).toHaveLength(1)
    expect(t).toContain("Enregistrer les modifications")
    expect(html).toContain('href="/client/profile"')
    expect(t).toContain("Annuler")
  })

  it("sans logo, affiche les initiales et « Choisir un fichier »", () => {
    const t2 = text(render({ identity: { avatarUrl: null } }))
    expect(t2).toContain("RH")
    expect(t2).toContain("Choisir un fichier")
  })

  it("ne présélectionne pas une ville hors liste", () => {
    expect(render({ identity: { city: "Parakou" } })).not.toContain('value="Parakou"')
  })

  it("sans lecture fiable du profil : état d'erreur, aucun formulaire (il effacerait le téléphone)", () => {
    const out = renderToStaticMarkup(<ProfileEditView error="Impossible de charger votre profil." />)
    expect(out).not.toContain("<form")
    expect(out).toContain('role="alert"')
    expect(out.match(/<h1\b/g)).toHaveLength(1)
  })

  it("est vouvoyé et sans tiret cadratin", () => {
    expect(t).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
    expect(html).not.toMatch(/[\u2013\u2014]|style=/)
  })
})

describe("validateProfileForm", () => {
  const ok = { fullName: "Rosine", companyName: "", city: "Cotonou", phone: "" }

  it("accepte un formulaire minimal (nom et ville), téléphone facultatif", () => {
    expect(validateProfileForm(ok)).toEqual({})
    expect(validateProfileForm({ ...ok, phone: "01 97 45 21 08" })).toEqual({})
    expect(validateProfileForm({ ...ok, phone: "+229 0197452108" })).toEqual({})
  })

  it.each([
    ["nom vide", { fullName: "   " }, "fullName", /Indiquez votre nom/],
    ["nom trop long", { fullName: "a".repeat(101) }, "fullName", /100 caractères/],
    ["nom avec caractère de contrôle", { fullName: "Ro\u0000" }, "fullName", /non autorisé/],
    ["structure trop longue", { companyName: "b".repeat(101) }, "companyName", /100 caractères/],
    ["ville vide", { city: "" }, "city", /Choisissez votre ville/],
    ["ville hors liste", { city: "Parakou" }, "city", /Choisissez votre ville/],
    ["téléphone trop court", { phone: "0197" }, "phone", /10 chiffres/],
    ["téléphone avec lettres", { phone: "01 97 ab 21 08" }, "phone", /chiffres/],
    ["téléphone hors 01", { phone: "02 97 45 21 08" }, "phone", /01/],
  ])("refuse : %s", (_l, patch, field, message) => {
    const errors = validateProfileForm({ ...ok, ...patch })
    expect(errors[field]).toMatch(message)
  })
})

describe("checkLogoFile", () => {
  it("accepte png, jpg, webp jusqu'à 3 Mo", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(checkLogoFile({ type, size: 1000 })).toBeNull()
    }
    expect(checkLogoFile({ type: "image/png", size: LOGO_MAX_BYTES })).toBeNull()
    expect(checkLogoFile(null)).toBeNull()
  })

  it("refuse un autre type, un fichier trop lourd ou de taille illisible", () => {
    expect(checkLogoFile({ type: "image/svg+xml", size: 10 })).toMatch(/PNG, JPG ou WebP/)
    expect(checkLogoFile({ type: "application/pdf", size: 10 })).toMatch(/PNG, JPG ou WebP/)
    expect(checkLogoFile({ type: "image/png", size: LOGO_MAX_BYTES + 1 })).toMatch(/3 Mo/)
    expect(checkLogoFile({ type: "image/png" })).toMatch(/3 Mo/)
  })
})

describe("submitProfile", () => {
  const values = { fullName: " Rosine ", companyName: " Boutique ", city: "Cotonou", phone: " 01 97 45 21 08 " }
  const logo = { type: "image/png", size: 10, name: "logo.png" }

  it("ne contacte ni le stockage ni le serveur quand le formulaire est invalide", async () => {
    const upload = vi.fn()
    const update = vi.fn()
    const res = await submitProfile({ values: { ...values, fullName: "" }, logoFile: logo }, { upload, update })
    expect(res.kind).toBe("invalid")
    expect(res.errors.fullName).toBeTruthy()
    expect(upload).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("enregistre sans logo : pas d'envoi de fichier, avatarUrl indéfini", async () => {
    const upload = vi.fn()
    const update = vi.fn().mockResolvedValue({ success: true })
    expect(await submitProfile({ values, logoFile: null }, { upload, update })).toEqual({ kind: "done" })
    expect(upload).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({
      fullName: "Rosine", city: "Cotonou", phone: "01 97 45 21 08", companyName: "Boutique", avatarUrl: undefined,
    })
  })

  it("envoie le logo puis transmet son URL à l'action", async () => {
    const upload = vi.fn().mockResolvedValue("https://proj.supabase.co/storage/v1/object/public/avatars/u1/avatar.png")
    const update = vi.fn().mockResolvedValue({ success: true })
    expect((await submitProfile({ values, logoFile: logo }, { upload, update })).kind).toBe("done")
    expect(upload).toHaveBeenCalledWith(logo)
    expect(update.mock.calls[0][0].avatarUrl).toContain("/avatars/u1/avatar.png")
  })

  it("signale l'échec de l'envoi du logo sans enregistrer le profil", async () => {
    const upload = vi.fn().mockRejectedValue(new Error('bucket "secret"'))
    const update = vi.fn()
    const res = await submitProfile({ values, logoFile: logo }, { upload, update })
    expect(res).toEqual({ kind: "error", error: "Le logo n'a pas pu être envoyé. Réessayez ou retirez-le.", logo: true })
    expect(update).not.toHaveBeenCalled()
  })

  it("renvoie l'erreur de l'action telle quelle (déjà vouvoyée)", async () => {
    const update = vi.fn().mockResolvedValue({ error: "Impossible d'enregistrer votre profil." })
    expect(await submitProfile({ values, logoFile: null }, { upload: vi.fn(), update })).toEqual({
      kind: "error",
      error: "Impossible d'enregistrer votre profil.",
    })
  })

  it("donne un message neutre si l'action lève une exception", async () => {
    const update = vi.fn().mockRejectedValue(new Error("boom secret"))
    const res = await submitProfile({ values, logoFile: null }, { upload: vi.fn(), update })
    expect(res.kind).toBe("error")
    expect(res.error).not.toMatch(/secret/)
    expect(res.error).toMatch(/Réessayez/)
  })
})
