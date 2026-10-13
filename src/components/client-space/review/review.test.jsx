import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("@/lib/actions/review.actions", () => ({ createClientReview: vi.fn() }))

const { formatAmount } = await import("@/lib/app/format")
const { ReviewView, ThanksCard, submitReview, validateReview, ratingText, COMMENT_MAX } = await import("./review-view")

const MISSION = { id: "m-1", title: "Garde d'enfants mercredi", budget: 10000, status: "done" }
const STUDENT = { id: "s-1", fullName: "Afiavi Dossou", avatarUrl: null }
const base = { state: "form", mission: MISSION, student: STUDENT, review: null, authorName: "Rosine Houngbédji" }

const view = (page = {}) => renderToStaticMarkup(<ReviewView page={{ ...base, ...page }} />)
const text = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
const nb = (s) => s.replace(/ /g, " ")

describe("formulaire d'avis", () => {
  const html = view()
  const t = text(html)

  it("a un seul titre h1 et le prénom de l'étudiant", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain("Noter Afiavi")
    expect(t).toContain("Comment s'est passée la mission avec Afiavi ?")
  })

  it("rend un groupe radio de 5 étoiles nommé, relié au libellé de niveau", () => {
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Note sur 5"')
    expect(html.match(/role="radio"/g)).toHaveLength(5)
    expect(html).toContain('aria-label="1 étoile sur 5"')
    expect(html).toContain('aria-label="5 étoiles sur 5"')
    expect(html).toMatch(/aria-describedby="[^"]+-rating"/)
    expect(t).toContain("Choisissez une note")
  })

  it("laisse « Enregistrer mon avis » inactif tant qu'aucune note n'est choisie", () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^]*Enregistrer mon avis/)
  })

  it("a un commentaire facultatif de 300 caractères avec compteur et signature publique", () => {
    expect(html).toContain("Votre commentaire")
    expect(t).toContain("(facultatif)")
    expect(html).toContain('maxLength="300"')
    expect(COMMENT_MAX).toBe(300)
    expect(t).toContain("0 / 300")
    expect(t).toContain("Public, signé « Rosine H. ».")
    expect(t).not.toContain("Houngbédji")
  })

  it("résume la mission avec la commission calculée par escrowSplit, sans constante en dur", () => {
    expect(t).toContain("Garde d'enfants mercredi")
    expect(t).toContain("Étudiant Afiavi D.")
    expect(html).toContain(formatAmount(10000))
    expect(html).toContain(formatAmount(1200, { sign: "debit" }))
    expect(t).toContain("Part de l'étudiant")
    expect(t).not.toContain("Versé à")
    expect(html).toContain(formatAmount(8800))
    expect(html).toContain("Commission 12\u00A0%")
    expect(html).not.toContain("Commission 12 %")
  })

  it("renvoie vers la mission (Plus tard et Voir la mission et le reçu)", () => {
    expect(html).toContain('href="/client/missions/m-1"')
    expect(t).toContain("Plus tard")
    expect(t).toContain("Voir la mission et le reçu")
  })

  it("ne dit rien d'une publication différée des avis", () => {
    expect(t).not.toMatch(/7 jours|croisé|différé|quand (les deux|vous avez)|publié quand|après 7/i)
    expect(t).not.toMatch(/Publier mon avis/)
  })

  it("est vouvoyé, sans mot banni ni tiret cadratin", () => {
    expect(t).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
    expect(t).not.toMatch(/livraison|course|coursier|saisie|bientôt/i)
    expect(html).not.toMatch(/[\u2013\u2014]/)
  })

  it("n'affiche aucune couleur ni style en ligne", () => {
    expect(html).not.toMatch(/style=|#[0-9a-f]{6}/i)
  })

  it("échappe le titre de la mission et le nom de l'étudiant", () => {
    const evil = view({
      mission: { ...MISSION, title: '<img src=x onerror="alert(1)">' },
      student: { ...STUDENT, fullName: "<b>Hack</b> Dossou" },
    })
    expect(evil).not.toContain("<img src=x")
    expect(evil).not.toContain("<b>Hack")
    expect(evil).toContain("&lt;img")
  })

  it("garde un prénom neutre quand le nom de l'étudiant est vide", () => {
    const out = text(view({ student: { ...STUDENT, fullName: "" } }))
    expect(out).toContain("Noter l'étudiant")
    expect(out).toContain("Part de l'étudiant")
  })
})

describe("merci", () => {
  const html = renderToStaticMarkup(
    <ThanksCard page={base} review={{ rating: 4, comment: "Très <i>bien</i>" }} />,
  )
  const t = text(html)

  it("remercie, cite la signature et la note, échappe le commentaire", () => {
    expect(t).toContain("Merci")
    expect(t).toContain("Votre avis est enregistré")
    expect(t).toContain("Rosine H.")
    expect(html).toContain('aria-label="Note : 4 sur 5"')
    expect(html).toContain("Très &lt;i&gt;bien&lt;/i&gt;")
    expect(html).not.toContain("<i>bien</i>")
  })

  it("propose la suite sans promettre de publication différée", () => {
    expect(html).toContain('href="/client/dashboard"')
    expect(t).toContain("Retour à l'accueil")
    expect(t).not.toMatch(/7 jours|croisé|différé|publié quand/i)
  })

  it("n'affiche pas de citation vide sans commentaire", () => {
    const none = renderToStaticMarkup(<ThanksCard page={base} review={{ rating: 5, comment: null }} />)
    expect(none).not.toContain("prof2__p")
  })
})

describe("déjà noté", () => {
  const review = { rating: 5, comment: "Excellent <script>x()</script>", createdAt: "2026-10-08T16:05:00Z" }
  const html = view({ state: "already", review })
  const t = text(html)

  it("montre l'avis en lecture seule, sans formulaire", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(t).toContain("Vous avez déjà noté Afiavi pour cette mission")
    expect(t).toContain("8 octobre 2026")
    expect(html).not.toContain("<form")
    expect(html).not.toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Note : 5 sur 5"')
  })

  it("échappe le commentaire", () => {
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("propose le profil de l'étudiant et le retour à la mission", () => {
    expect(html).toContain('href="/talents/s-1"')
    expect(html).toContain('href="/client/missions/m-1"')
    expect(html).toContain('href="/contact?sujet=question"')
  })
})

describe("mission non terminée", () => {
  it("explique que la mission est en cours et renvoie vers elle", () => {
    const html = view({ state: "not_done", mission: { ...MISSION, status: "in_progress", title: "Cours de maths" } })
    const t = text(html)
    expect(t).toContain("Pas encore de note possible")
    expect(t).toContain("La mission « Cours de maths » est toujours en cours")
    expect(t).toContain("dès que vous aurez confirmé la fin de la mission")
    expect(html).toContain('href="/client/missions/m-1"')
    expect(html).not.toContain("<form")
  })

  it("garde un texte honnête pour une mission ouverte ou sans étudiant", () => {
    const t = text(view({ state: "not_done", student: null, mission: { ...MISSION, status: "open" } }))
    expect(t).toContain("n'est pas terminée")
    expect(t).not.toContain("toujours en cours")
  })
})

describe("submitReview", () => {
  const input = { missionId: "m-1", rating: 5, comment: "Bien" }

  it("refuse une note absente ou hors bornes sans appeler le serveur", async () => {
    const create = vi.fn()
    for (const rating of [0, 6, 4.5, "5", null, undefined, Number.NaN]) {
      expect(await submitReview({ ...input, rating }, create)).toEqual({
        kind: "invalid",
        error: "Choisissez une note de 1 à 5 étoiles.",
      })
    }
    expect(create).not.toHaveBeenCalled()
  })

  it("envoie une seule fois et renvoie l'avis enregistré", async () => {
    const create = vi.fn().mockResolvedValue({ success: true, review: { rating: 5, comment: "Bien" } })
    expect(await submitReview(input, create)).toEqual({ kind: "done", review: { rating: 5, comment: "Bien" } })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(input)
  })

  it("renvoie l'erreur du serveur telle quelle (déjà vouvoyée)", async () => {
    const create = vi.fn().mockResolvedValue({ error: "Vous avez déjà noté l'étudiant pour cette mission." })
    expect(await submitReview(input, create)).toEqual({
      kind: "error",
      error: "Vous avez déjà noté l'étudiant pour cette mission.",
    })
  })

  it("donne un message neutre si l'appel lève une exception", async () => {
    const create = vi.fn().mockRejectedValue(new Error('relation "secret" does not exist'))
    const res = await submitReview(input, create)
    expect(res.kind).toBe("error")
    expect(res.error).not.toMatch(/secret/)
    expect(res.error).toMatch(/Réessayez/)
  })

  it("validateReview et ratingText", () => {
    expect(validateReview({ rating: 3 })).toBeNull()
    expect(validateReview({ rating: 0 })).not.toBeNull()
    expect(ratingText(5)).toBe("Excellent · 5 / 5")
    expect(ratingText(1)).toBe("Très décevant · 1 / 5")
    expect(ratingText(0)).toBe("Choisissez une note")
  })
})
