import { describe, expect, it, vi } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
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
vi.mock("@/lib/actions/student-profile.actions", () => ({ saveStudentProfile: vi.fn() }))

const { StudentProfileView, monthYear, ratingValue } = await import("./profile-view")
const { StudentProfileEditView, initialValues, toPayload, changedSections, submitStudentProfile, leavesPage } =
  await import("./profile-form")
const rules = await import("@/lib/student-space/profile-rules")
const { missingProfileItems } = rules

const SRC = path.resolve(__dirname, "../../..")

const IDENTITY = {
  userId: "u1",
  fullName: "Sèna Agossou",
  city: "Abomey-Calavi",
  avatarUrl: null,
  bio: "Étudiante en Licence 2.\nJe donne des cours de maths.",
  school: "UAC",
  level: "Licence 2",
  skills: ["Traduction", "Saisie", "Mathématiques"],
  availability: "Week-end, Soirée, mardi après 17 h",
  memberSince: "2026-03-02T10:00:00Z",
}
const VERIFICATION = { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: 200, action: null, verifiedUntil: "2027-06-29" }
const STATS = { done: 23, totalEarned: 318720, rating: 4.9, reviewsCount: 12 }
const REVIEWS = [
  { id: "r1", rating: 5, comment: "Ponctuelle et patiente.", createdAt: "2026-09-10T10:00:00Z", authorFirstName: "Rosine", missionTitle: "Cours de maths niveau 2nde" },
  { id: "r2", rating: 4, comment: null, createdAt: "2026-08-12T10:00:00Z", authorFirstName: "Codjo", missionTitle: null },
]
const summary = (over = {}) => ({
  identity: { ...IDENTITY, ...over.identity },
  verification: { ...VERIFICATION, ...over.verification },
  stats: { ...STATS, ...over.stats },
  reviews: over.reviews ?? REVIEWS,
})
const view = (over, props = {}) =>
  renderToStaticMarkup(<StudentProfileView summary={summary(over)} logoutAction={() => {}} {...props} />)
// Le script de rejeu de formulaire injecté par React (action serveur) n'est pas du contenu visible.
const text = (html) =>
  html
    .replace(/<script>[^]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")

describe("profil étudiant : consultation", () => {
  const html = view()
  const t = text(html)

  it("a un seul h1 avec le nom et l'identité (ville, études, ancienneté, badge vérifié)", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>Sèna Agossou<\/h1>/)
    expect(t).toContain("Abomey-Calavi")
    expect(t).toContain("UAC · Licence 2")
    expect(t).toContain("Membre depuis mars 2026")
    expect(t).toContain("Vérifié")
  })

  it("rend les 3 chiffres : note, missions terminées, total gagné net", () => {
    expect(t).toContain("Note 4,9 / 5")
    expect(t).toContain("12 avis reçus")
    expect(t).toContain("Missions terminées 23")
    expect(t).toMatch(/Total gagné 318\s?720\s?FCFA/)
    expect(t).toContain("votre part nette")
    expect(html).toContain('href="/wallet"')
  })

  it("rend à propos, compétences (libellés d'affichage), disponibilités", () => {
    expect(t).toContain("Étudiante en Licence 2.")
    expect(t).toContain("Compétences 3")
    expect(t).toContain("Travaux sur ordinateur")
    expect(t).not.toMatch(/>Saisie</)
    expect(t).toContain("Mathématiques")
    for (const day of ["Week-end", "Soirée", "mardi après 17 h"]) expect(t).toContain(day)
  })

  it("liste les avis avec le prénom seul de l'auteur, le titre de la mission et des étoiles nommées", () => {
    expect(t).toContain("Avis reçus 12")
    expect(t).toContain("Rosine")
    expect(t).toContain("Cours de maths niveau 2nde · septembre 2026")
    expect(t).toContain("Ponctuelle et patiente.")
    expect(html).toContain('aria-label="Note : 5 sur 5"')
    expect(html).toContain('aria-label="Note : 4 sur 5"')
    expect(t).toContain("Les 2 avis les plus récents sont affichés.")
    expect(text(view({ stats: { reviewsCount: 2 } }))).not.toContain("les plus récents")
  })

  it("« Modifier » est le seul bouton encre ; profil public, édition et déconnexion par formulaire", () => {
    expect(html.match(/btn--dark/g)).toHaveLength(1)
    expect(html).toMatch(/<a href="\/profile\/edit" class="btn btn--dark">/)
    expect(html).toContain('href="/talents/u1"')
    expect(t).toContain("Voir mon profil public")
    expect(html).toMatch(/<form[^>]*>\s*<button type="submit" class="e2-10-out">/)
    expect(t).toContain("Se déconnecter")
  })

  it("profil complet : pas de bloc « Complétez votre profil »", () => {
    expect(missingProfileItems({ ...IDENTITY, avatarUrl: "x" })).toEqual([])
    expect(view({ identity: { avatarUrl: "https://proj.supabase.co/a.png" } })).not.toContain("Complétez votre profil")
  })

  it("ne contient aucune donnée privée : ni téléphone, ni carte, ni motif, ni date de dépôt", () => {
    expect(html.replace(/<script>[^]*?<\/script>/g, "")).not.toMatch(/\+229|01 97|card_url|rejection|submitted_at/i)
    expect(t).not.toMatch(/téléphone/i)
  })

  it("est vouvoyé, sans mot banni, sans tiret cadratin, sans style en ligne", () => {
    expect(t).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
    expect(t).not.toMatch(/livraison|course|coursier|saisie|bientôt|24 à 48/i)
    expect(html).not.toMatch(/[\u2013\u2014]|style=|#[0-9a-f]{6}/i)
  })
})

describe("profil étudiant : états", () => {
  it("sans avis : explique et ne rend pas de note inventée", () => {
    const t = text(view({ reviews: [], stats: { rating: 0, reviewsCount: 0 } }))
    expect(t).toContain("Pas encore d'avis")
    expect(t).toContain("Les clients vous notent après chaque mission terminée")
    expect(t).toContain("Pas de note")
    expect(t).toContain("aucun avis reçu")
    expect(t).not.toContain("0 / 5")
  })

  it("total gagné indisponible : jamais un faux 0", () => {
    const t = text(view({ stats: { totalEarned: null } }))
    expect(t).toContain("Total gagné Indisponible")
    expect(t).not.toMatch(/Total gagné 0/)
    expect(t).not.toContain("votre part nette")
  })

  it("total gagné à 0 FCFA quand aucune libération (lecture réussie)", () => {
    expect(text(view({ stats: { totalEarned: 0 } }))).toMatch(/Total gagné 0\s*FCFA/)
  })

  it("autres chiffres indisponibles : Indisponible sans NaN", () => {
    const t = text(view({ stats: { done: null, reviewsCount: null } }))
    expect(t).toMatch(/Missions terminées Indisponible/)
    expect(t).not.toMatch(/NaN|undefined|null/)
  })

  it("montant de 10 chiffres : rendu entier dans un indicateur", () => {
    expect(text(view({ stats: { totalEarned: 1234567890 } }))).toMatch(/Total gagné 1\s?234\s?567\s?890\s?FCFA/)
  })

  it("profil incomplet : invitation à compléter, sections vides dites sans inventer", () => {
    const html = view({ identity: { bio: null, school: null, level: null, skills: [], availability: null, avatarUrl: null } })
    const t = text(html)
    expect(t).toContain("Complétez votre profil")
    expect(t).toContain("Il manque une photo, une présentation, votre établissement, votre niveau d'études, vos compétences.")
    expect(t).toContain("Compléter mon profil")
    expect(t).toContain("Aucune présentation pour le moment.")
    expect(t).toContain("Aucune compétence renseignée.")
    expect(t).toContain("Aucune disponibilité renseignée.")
    expect(html).toContain('href="/profile/edit"')
  })

  it.each([
    ["verified", /Votre badge est valable jusqu'au 29 juin 2027/, null],
    ["expiring", /Votre badge expire le 29 juin 2027/, "Renouveler mon badge"],
    ["expired", /Votre badge a expiré/, "Renouveler mon badge"],
    ["rejected", /Votre carte a été refusée/, "Renvoyer ma carte"],
    ["pending", /Votre carte est en cours d'examen/, null],
    ["not_submitted", /Envoyez votre carte étudiante/, "Envoyer ma carte"],
  ])("statut de vérification %s", (key, phrase, actionLabel) => {
    const action = actionLabel ? { label: actionLabel, href: "/profile/verify" } : null
    const html = view({ verification: { key, label: `Libellé ${key}`, action, verifiedUntil: key === "verified" || key === "expiring" ? "2027-06-29" : null } })
    const t = text(html)
    expect(t).toContain(`Libellé ${key}`)
    expect(t).toMatch(phrase)
    if (actionLabel) expect(html).toContain('href="/profile/verify"')
    expect(t).not.toMatch(/24 à 48|sous 24|heures/i)
  })

  it("le badge « Vérifié » du bandeau d'identité n'existe que pour un badge actif", () => {
    expect(view({ verification: { key: "expired", label: "Badge expiré", action: null, verifiedUntil: null } })).not.toContain("badge--succes")
    expect(view({ verification: { key: "expiring", label: "Badge à renouveler", action: null, verifiedUntil: "2026-11-01" } })).toContain("badge--succes")
  })

  it("erreur de chargement : état d'erreur avec le seul h1, sans chiffres", () => {
    const out = renderToStaticMarkup(<StudentProfileView error="Impossible de charger votre profil." />)
    expect(out.match(/<h1\b/g)).toHaveLength(1)
    expect(out).toContain('role="alert"')
    expect(text(out)).toContain("Impossible de charger votre profil")
    expect(out).not.toContain("stats2")
  })

  it("échappe le nom, la présentation, les commentaires et les titres", () => {
    const out = view({
      identity: { fullName: "<b>Hack</b>", bio: '<img src=x onerror="a()">' },
      reviews: [{ ...REVIEWS[0], comment: "<script>x()</script>", authorFirstName: "<i>A</i>", missionTitle: "<u>T</u>" }],
    })
    for (const raw of ["<b>Hack", "<img src=x", "<script>x()", "<i>A", "<u>T"]) expect(out).not.toContain(raw)
    expect(out).toContain("&lt;script&gt;")
  })
})

describe("helpers de la vue", () => {
  it("monthYear et ratingValue", () => {
    expect(monthYear("2026-04-02T10:00:00Z")).toBe("avril 2026")
    expect(monthYear(null)).toBe("")
    expect(monthYear("pas une date")).toBe("")
    expect(ratingValue(4.84)).toBe("4,8")
    expect(ratingValue("x")).toBe("0")
  })

  it("missingProfileItems liste ce qui manque, dans l'ordre", () => {
    expect(missingProfileItems({})).toEqual(["une photo", "une présentation", "votre établissement", "votre niveau d'études", "vos compétences"])
    expect(missingProfileItems(null)).toHaveLength(5)
  })
})

// ─── Édition ─────────────────────────────────────────────────────────────────

const FORM = {
  values: {
    userId: "u1", fullName: "Sèna Agossou", city: "Abomey-Calavi", phone: "+2290197452108", bio: "Étudiante.", school: "UAC", level: "Licence 2",
    availability: "Week-end, Soirée", skills: ["Traduction", "Spécialité rare"], avatarUrl: "https://proj.supabase.co/storage/v1/object/public/avatars/u1/a.png",
  },
  verification: { key: "pending", label: "Carte en cours d'examen", action: null },
  universities: [
    { name: "Université d'Abomey-Calavi", shortName: "UAC" },
    { name: "Université de Parakou", shortName: null },
  ],
}
const form = (over = {}) => ({ ...FORM, ...over, values: { ...FORM.values, ...over.values } })
const edit = (over) => renderToStaticMarkup(<StudentProfileEditView form={form(over)} />)

describe("profil étudiant : édition (rendu)", () => {
  const html = edit()
  const t = text(html)

  it("a un seul h1 et le formulaire prérempli, téléphone de l'utilisateur formaté", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>Modifier mon profil<\/h1>/)
    expect(html).toContain('value="Sèna Agossou"')
    expect(html).toContain('value="01 97 45 21 08"')
    expect(html).toContain("Étudiante.")
  })

  it("quatre sections et un libellé visible relié à chaque champ", () => {
    for (const title of ["Informations personnelles", "Études", "Compétences", "Disponibilités"]) expect(t).toContain(title)
    for (const label of ["Nom complet", "Ville", "Téléphone", "Présentation", "Établissement", "Niveau d'études", "Autre disponibilité", "Photo"]) {
      expect(t).toContain(label)
    }
    expect(html.match(/<label\b/g).length).toBeGreaterThanOrEqual(7)
    expect(html).toContain("tel-national")
    expect(html).toContain("control__prefix")
  })

  it("compteur de la présentation et bornes de longueur", () => {
    expect(t).toContain("10 / 400")
    expect(html).toContain('maxLength="400"')
    expect(html).toContain('maxLength="100"')
  })

  it("compétences : puces à l'état pressé, libellés d'affichage, compétence rare conservée, compteur", () => {
    expect(t).toContain("2 sur 8")
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:<svg[^>]*>.*?<\/svg>)?Traduction/)
    expect(t).toContain("Travaux sur ordinateur")
    expect(t).toContain("Spécialité rare")
  })

  it("disponibilités : choix prédéfinis pressés et texte libre séparé", () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:<svg[^>]*>.*?<\/svg>)?Week-end/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Matin/)
  })

  it("la carte étudiante n'est plus ici : lien vers la vérification et statut, aucun champ fichier de carte", () => {
    expect(t).toContain("Statut actuel : Carte en cours d'examen.")
    expect(html).toContain('href="/profile/verify"')
    expect(html.match(/type="file"/g)).toHaveLength(1)
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"')
  })

  it("statut avec action : le lien porte son libellé", () => {
    const out = edit({ verification: { key: "rejected", label: "Carte refusée", action: { label: "Renvoyer ma carte", href: "/profile/verify" } } })
    expect(text(out)).toContain("Renvoyer ma carte")
  })

  it("a un seul bouton encre « Enregistrer », un lien Annuler, une barre d'état annoncée", () => {
    expect(html.match(/btn--dark/g)).toHaveLength(1)
    expect(html).toMatch(/<button type="submit" class="btn btn--dark" disabled="">Enregistrer<\/button>/)
    expect(t).toContain("Aucune modification")
    expect(html).toContain('role="status"')
    expect(t).toContain("Annuler")
  })

  it("aperçu client : prénom et initiale seulement, lien vers le profil public", () => {
    expect(t).toContain("Aperçu client")
    expect(t).toContain("Sèna A.")
    expect(t).toContain("Votre téléphone n'est jamais affiché.")
    expect(html).toContain('href="/talents/u1"')
  })

  it("un établissement hors liste passe en « Autre établissement » avec son nom saisi", () => {
    const out = edit({ values: { school: "Institut inconnu" } })
    expect(text(out)).toContain("Nom de l'établissement")
    expect(out).toContain('value="Institut inconnu"')
  })

  it("ne présélectionne pas une ville hors liste", () => {
    expect(edit({ values: { city: "Parakou" } })).not.toContain('value="Parakou"')
  })

  it("sans lecture fiable du profil : état d'erreur, aucun formulaire (il effacerait le téléphone)", () => {
    const out = renderToStaticMarkup(<StudentProfileEditView error="Impossible de charger votre profil." />)
    expect(out).not.toContain("<form")
    expect(out).toContain('role="alert"')
    expect(out.match(/<h1\b/g)).toHaveLength(1)
  })

  it("est vouvoyé, sans mot banni, sans tiret cadratin ni style en ligne", () => {
    expect(t).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
    expect(t).not.toMatch(/livraison|course|coursier|saisie|bientôt|24 à 48/i)
    expect(html).not.toMatch(/[\u2013\u2014]|style=/)
  })
})

describe("valeurs et rubriques du formulaire", () => {
  it("initialValues reconnaît l'établissement par son nom ou son sigle", () => {
    expect(initialValues(form()).school).toBe("Université d'Abomey-Calavi")
    expect(initialValues(form({ values: { school: "Université de Parakou" } })).school).toBe("Université de Parakou")
    const other = initialValues(form({ values: { school: "Institut inconnu" } }))
    expect(other).toMatchObject({ school: "__other__", schoolOther: "Institut inconnu" })
    expect(initialValues(form({ values: { school: "" } })).school).toBe("")
  })

  it("initialValues sépare les disponibilités et formate le téléphone", () => {
    const v = initialValues(form({ values: { availability: "Week-end, mardi soir" } }))
    expect(v.presets).toEqual(["Week-end"])
    expect(v.availabilityOther).toBe("mardi soir")
    expect(v.phone).toBe("01 97 45 21 08")
  })

  it("toPayload reconstitue établissement et disponibilités, sans espaces parasites", () => {
    const v = { ...initialValues(form()), fullName: " Sèna ", school: "__other__", schoolOther: " Institut ", presets: ["Soirée", "Week-end"], availabilityOther: " mardi " }
    expect(toPayload(v)).toMatchObject({ fullName: "Sèna", school: "Institut", availability: "Week-end, Soirée, mardi" })
  })

  it("changedSections nomme les rubriques modifiées, dans l'ordre de la page", () => {
    const start = initialValues(form())
    expect(changedSections(start, start, false)).toEqual([])
    expect(changedSections(start, { ...start, bio: "autre", level: "Master 1", skills: [], presets: [] }, true)).toEqual([
      "photo", "informations", "études", "compétences", "disponibilités",
    ])
    expect(changedSections(start, { ...start, city: "Cotonou" }, false)).toEqual(["informations"])
  })
})

describe("règles du profil", () => {
  it("parseAvailability et formatAvailability font l'aller-retour", () => {
    const parsed = rules.parseAvailability("Soirée, Week-end, Autre, mardi 17 h")
    expect(parsed).toEqual({ presets: ["Soirée", "Week-end"], other: "mardi 17 h" })
    expect(rules.formatAvailability(parsed.presets, parsed.other)).toBe("Week-end, Soirée, mardi 17 h")
    expect(rules.formatAvailability([], "")).toBe("")
    expect(rules.parseAvailability(null)).toEqual({ presets: [], other: "" })
  })

  it("validateStudentProfile accepte un formulaire complet et les bornes exactes", () => {
    const ok = { fullName: "a".repeat(100), city: "Cotonou", phone: "01 97 45 21 08", bio: "b".repeat(400), school: "UAC", level: "BTS", availability: "", skills: [] }
    expect(rules.validateStudentProfile(ok)).toEqual({})
    expect(rules.validateStudentProfile({ ...ok, level: "", school: "" })).toEqual({})
  })

  it("checkAvatarFile et avatarPath", () => {
    expect(rules.checkAvatarFile({ type: "image/png", size: 1 })).toBeNull()
    expect(rules.checkAvatarFile({ type: "image/gif", size: 1 })).toMatch(/PNG, JPG ou WebP/)
    expect(rules.checkAvatarFile({ type: "image/png", size: rules.AVATAR_MAX_BYTES + 1 })).toMatch(/3 Mo/)
    expect(rules.checkAvatarFile(null)).toBeNull()
    expect(rules.avatarPath("u1", "image/png", 7)).toBe("u1/avatar-7.png")
    expect(rules.avatarPath("u1", "image/png", 8)).not.toBe(rules.avatarPath("u1", "image/png", 7))
  })
})

describe("submitStudentProfile", () => {
  const values = { ...initialValues(form()), fullName: " Sèna " }
  const photo = { type: "image/png", size: 10, name: "p.png" }

  it("ne contacte ni le stockage ni le serveur quand le formulaire est invalide", async () => {
    const upload = vi.fn()
    const save = vi.fn()
    const res = await submitStudentProfile({ values: { ...values, fullName: "", phone: "12" }, avatarFile: photo }, { upload, save })
    expect(res.kind).toBe("invalid")
    expect(Object.keys(res.errors).sort()).toEqual(["fullName", "phone"])
    expect(upload).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it("« Autre établissement » sans nom : erreur sous le champ", async () => {
    const res = await submitStudentProfile({ values: { ...values, school: "__other__", schoolOther: "  " }, avatarFile: null }, { upload: vi.fn(), save: vi.fn() })
    expect(res.errors.school).toMatch(/établissement/)
  })

  it("enregistre sans photo : pas d'envoi de fichier, charge utile nettoyée", async () => {
    const upload = vi.fn()
    const save = vi.fn().mockResolvedValue({ success: true })
    expect(await submitStudentProfile({ values, avatarFile: null }, { upload, save })).toEqual({ kind: "done" })
    expect(upload).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Sèna", city: "Abomey-Calavi", avatarUrl: undefined }))
    const sent = save.mock.calls[0][0]
    for (const forbidden of ["role", "is_verified", "is_suspended", "verified_until", "card_url", "cardUrl"]) expect(sent).not.toHaveProperty(forbidden)
  })

  it("envoie la photo puis transmet son URL à l'action", async () => {
    const upload = vi.fn().mockResolvedValue("https://proj.supabase.co/storage/v1/object/public/avatars/u1/avatar-1.png")
    const save = vi.fn().mockResolvedValue({ success: true })
    expect((await submitStudentProfile({ values, avatarFile: photo }, { upload, save })).kind).toBe("done")
    expect(upload).toHaveBeenCalledWith(photo)
    expect(save.mock.calls[0][0].avatarUrl).toContain("/avatars/u1/avatar-1.png")
  })

  it("signale l'échec de l'envoi de la photo sans enregistrer le profil", async () => {
    const upload = vi.fn().mockRejectedValue(new Error('bucket "secret"'))
    const save = vi.fn()
    const res = await submitStudentProfile({ values, avatarFile: photo }, { upload, save })
    expect(res).toEqual({ kind: "error", error: "La photo n'a pas pu être envoyée. Réessayez ou retirez-la.", photo: true })
    expect(save).not.toHaveBeenCalled()
  })

  it("renvoie l'erreur et les erreurs de champ de l'action", async () => {
    const save = vi.fn().mockResolvedValue({ error: "Certains champs sont à corriger avant d'enregistrer.", errors: { city: "Choisissez votre ville." } })
    expect(await submitStudentProfile({ values, avatarFile: null }, { upload: vi.fn(), save })).toEqual({
      kind: "error",
      error: "Certains champs sont à corriger avant d'enregistrer.",
      errors: { city: "Choisissez votre ville." },
    })
  })

  it("donne un message neutre si l'action lève une exception", async () => {
    const save = vi.fn().mockRejectedValue(new Error("boom secret"))
    const res = await submitStudentProfile({ values, avatarFile: null }, { upload: vi.fn(), save })
    expect(res.kind).toBe("error")
    expect(res.error).not.toMatch(/secret/)
    expect(res.error).toMatch(/Réessayez/)
  })
})

describe("alerte en quittant la page", () => {
  const origin = "https://educash.test"
  const anchor = (href, extra = {}) => ({ getAttribute: (n) => (n === "href" ? href : null), hasAttribute: () => false, target: "", ...extra })
  const click = (over = {}) => ({ defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over })

  it("demande confirmation pour un lien interne, pas pour les autres cas", () => {
    expect(leavesPage({ anchor: anchor("/profile"), event: click(), origin })).toBe(true)
    expect(leavesPage({ anchor: anchor(`${origin}/wallet`), event: click(), origin })).toBe(true)
    expect(leavesPage({ anchor: anchor("https://autre.test/x"), event: click(), origin })).toBe(false)
    expect(leavesPage({ anchor: anchor("#haut"), event: click(), origin })).toBe(false)
    expect(leavesPage({ anchor: anchor("/profile", { target: "_blank" }), event: click(), origin })).toBe(false)
    expect(leavesPage({ anchor: anchor("/profile"), event: click({ ctrlKey: true }), origin })).toBe(false)
    expect(leavesPage({ anchor: anchor("/profile"), event: click({ button: 1 }), origin })).toBe(false)
    expect(leavesPage({ anchor: anchor("/profile"), event: click({ defaultPrevented: true }), origin })).toBe(false)
    expect(leavesPage({ anchor: null, event: click(), origin })).toBe(false)
  })
})

describe("structure de l'écran", () => {
  const files = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name)
      return statSync(full).isDirectory() ? files(full) : [full]
    })
  const profileDir = path.join(SRC, "app/(student)/profile")

  it("aucun notFound() sous profile : le loading.js du segment ne peut pas transformer un 404 en 200", () => {
    for (const file of files(profileDir).filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\./.test(f))) {
      const code = readFileSync(file, "utf8").split("\n").filter((line) => !line.trim().startsWith("//")).join("\n")
      expect(code, file).not.toMatch(/\bnotFound\b/)
    }
  })

  it("les pages sont minces : actions étudiant seulement, aucun accès direct à Supabase", () => {
    for (const rel of ["page.js", "edit/page.js"]) {
      const source = readFileSync(path.join(profileDir, rel), "utf8")
      expect(source).toContain("@ds-screen RD-STUDENT-01")
      expect(source).not.toMatch(/@\/lib\/supabase/)
      expect(source).toContain("student-profile.actions")
    }
    expect(readFileSync(path.join(profileDir, "page.js"), "utf8")).toMatch(/logoutAction=\{logout\}/)
  })

  it("la photo part vers avatars/<userId>/ avec un nom unique, jamais en écrasant", () => {
    const source = readFileSync(path.join(SRC, "components/student-space/profile/profile-form.jsx"), "utf8")
    expect(source).not.toContain("upsert: true")
    expect(source).toContain('from("avatars")')
    expect(source).toContain("avatarPath(form.values.userId")
  })

  it("la carte étudiante n'est plus envoyée depuis l'édition", () => {
    const source = readFileSync(path.join(SRC, "components/student-space/profile/profile-form.jsx"), "utf8")
    expect(source).not.toMatch(/student-cards|cardUrl|CardUpload/)
  })
})
