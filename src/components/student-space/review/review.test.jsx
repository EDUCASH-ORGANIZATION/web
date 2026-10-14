import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("@/lib/actions/review.actions", () => ({ createStudentReview: vi.fn() }))

const { formatAmount } = await import("@/lib/app/format")
const { ReviewView, ThanksCard, submitReview, validateReview, ratingText, COMMENT_MAX } = await import("./review-view")

const MISSION = { id: "m-1", title: "Traduction d'un flyer", type: "Livraison", budget: 8000, status: "done" }
const CLIENT = { name: "Rosine H.", avatarUrl: null, city: "Cotonou" }
const base = { state: "form", mission: MISSION, client: CLIENT, review: null }

const view = (page = {}) => renderToStaticMarkup(<ReviewView page={{ ...base, ...page }} />)
const text = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")

describe("formulaire d'avis (vide)", () => {
  const html = view()
  const t = text(html)

  it("a un seul h1 « Noter le client » et un retour vers la mission", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain("Noter le client")
    expect(html).toContain('href="/student/missions/m-1"')
    expect(t).toContain("Comment s'est passée la mission avec ce client ?")
  })

  it("rend un groupe radio de 5 étoiles nommé par sa légende, sans note choisie", () => {
    expect(html).toContain('role="radiogroup"')
    expect(html).toMatch(/aria-labelledby="[^"]+-legend"/)
    expect(html.match(/role="radio"/g)).toHaveLength(5)
    expect(html).toContain('aria-label="1 étoile sur 5"')
    expect(html).toContain('aria-label="5 étoiles sur 5"')
    expect(html).not.toContain('aria-checked="true"')
    expect(html).toMatch(/aria-describedby="[^"]+-rating"/)
    expect(t).toContain("Choisissez une note")
  })

  it("laisse « Publier mon avis » inactif tant qu'aucune note n'est choisie, bureau et mobile", () => {
    const buttons = html.match(/<button[^>]*type="submit"[^>]*>/g)
    expect(buttons).toHaveLength(2)
    for (const b of buttons) expect(b).toContain('disabled=""')
    expect(html.match(/Publier mon avis/g)).toHaveLength(2)
    expect(html).toMatch(/<button[^>]*form="[^"]+-form"/)
  })

  it("a un commentaire facultatif de 300 caractères avec compteur", () => {
    expect(t).toContain("Votre commentaire sur ce client")
    expect(t).toContain("(facultatif)")
    expect(html).toContain('maxLength="300"')
    expect(COMMENT_MAX).toBe(300)
    expect(t).toContain("0 / 300")
    expect(t).toContain("Visible sur le profil de Rosine H.")
    expect(t).not.toContain("H..")
  })

  it("offre « Plus tard » vers la mission", () => {
    expect(t).toContain("Plus tard")
    expect(html.match(/href="\/student\/missions\/m-1"/g).length).toBeGreaterThanOrEqual(2)
  })

  it("rappelle la mission : titre, type par missionTypeLabel, client public, part par escrowSplit", () => {
    expect(t).toContain("La mission")
    expect(t).toContain("Traduction d'un flyer")
    expect(t).toContain("Rosine H.")
    expect(t).toContain("Client · Cotonou")
    expect(t).toContain("Marché et achats")
    expect(html).not.toContain(">Livraison<")
    expect(html).toContain(formatAmount(8000))
    expect(html).toContain(formatAmount(960, { sign: "debit" }))
    expect(html).toContain(formatAmount(7040))
    expect(html).toContain("Commission EduCash 12 %")
    expect(t).toContain("Votre part")
  })

  it("ne dit rien d'une publication différée des avis", () => {
    expect(t).not.toMatch(/7 jours|croisé|différé|publié quand|dès que vous publiez|après 48/i)
  })

  it("est vouvoyée, sans mot banni, sans tiret cadratin, sans couleur ni style en ligne", () => {
    expect(t).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
    expect(t).not.toMatch(/livraison|course|coursier|saisie|bientôt/i)
    expect(html).not.toMatch(/[\u2013\u2014]/)
    expect(html).not.toMatch(/style=|#[0-9a-f]{6}/i)
    expect(html).not.toMatch(/class="[^"]*\b(text|bg|p|m)-[a-z]/)
  })

  it("n'a qu'un seul bouton encre principal par zone (pas de bouton citron)", () => {
    expect(html).not.toContain("btn--lime")
    expect(html).not.toContain("btn--citron")
  })

  it("échappe le titre de la mission et le nom du client", () => {
    const evil = view({
      mission: { ...MISSION, title: '<img src=x onerror="alert(1)">' },
      client: { ...CLIENT, name: "<b>Hack</b> D." },
    })
    expect(evil).not.toContain("<img src=x")
    expect(evil).not.toContain("<b>Hack")
    expect(evil).toContain("&lt;img")
  })

  it("garde un nom neutre pour un client sans nom", () => {
    const out = text(view({ client: { ...CLIENT, name: "Client EduCash", city: null } }))
    expect(out).toContain("Client EduCash")
    expect(out).toContain("Client")
  })
})

describe("note choisie", () => {
  it("le libellé de la note et la note maximale du commentaire", () => {
    expect(ratingText(5)).toBe("Excellent")
    expect(ratingText(1)).toBe("Très décevant")
    expect(ratingText(0)).toBe("Choisissez une note")
    expect(ratingText(9)).toBe("Choisissez une note")
  })
})

describe("merci", () => {
  const html = renderToStaticMarkup(<ThanksCard page={base} review={{ rating: 4, comment: "Très <i>bien</i>" }} />)
  const t = text(html)

  it("remercie, cite la note, échappe le commentaire", () => {
    expect(t).toContain("Merci pour votre avis")
    expect(t).toContain("Il apparaît sur le profil de Rosine H.")
    expect(html).toContain('aria-label="Note : 4 sur 5"')
    expect(html).toContain("Très &lt;i&gt;bien&lt;/i&gt;")
    expect(html).not.toContain("<i>bien</i>")
  })

  it("propose la suite sans promettre de publication différée", () => {
    expect(html).toContain('href="/student/missions"')
    expect(html).toContain('href="/applications"')
    expect(t).not.toMatch(/7 jours|croisé|différé/i)
    expect(t).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
  })

  it("n'affiche pas de citation vide sans commentaire", () => {
    const none = renderToStaticMarkup(<ThanksCard page={base} review={{ rating: 5, comment: null }} />)
    expect(none).not.toContain("e2-13-quote")
  })
})

describe("déjà noté", () => {
  const review = { rating: 5, comment: "Excellent <script>x()</script>", createdAt: "2026-10-08T16:05:00Z" }
  const html = view({ state: "already", review })
  const t = text(html)

  it("montre l'avis en lecture seule, sans formulaire", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(t).toContain("Vous avez déjà noté ce client")
    expect(t).toContain("8 octobre 2026")
    expect(html).not.toContain("<form")
    expect(html).not.toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Note : 5 sur 5"')
    expect(html).not.toContain("e2-mbar")
  })

  it("échappe le commentaire et renvoie vers la mission", () => {
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain('href="/student/missions/m-1"')
  })
})

describe("mission non terminée", () => {
  const html = view({ state: "not_done", mission: { ...MISSION, status: "in_progress" } })
  const t = text(html)

  it("explique l'attente, sans formulaire, et renvoie vers le suivi de la mission", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(t).toContain("Pas encore possible")
    expect(t).toContain("Vous pourrez noter le client une fois la mission terminée")
    expect(html).toContain('href="/student/missions/m-1"')
    expect(t).toContain("Voir le suivi de la mission")
    expect(html).not.toContain("<form")
    expect(html).not.toContain("e2-mbar")
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
    const create = vi.fn().mockResolvedValue({ error: "Vous avez déjà noté le client pour cette mission." })
    expect(await submitReview(input, create)).toEqual({
      kind: "error",
      error: "Vous avez déjà noté le client pour cette mission.",
    })
  })

  it("donne un message neutre si l'appel lève une exception", async () => {
    const create = vi.fn().mockRejectedValue(new Error('relation "secret" does not exist'))
    const res = await submitReview(input, create)
    expect(res.kind).toBe("error")
    expect(res.error).not.toMatch(/secret/)
    expect(res.error).toMatch(/Réessayez/)
  })

  it("validateReview", () => {
    expect(validateReview({ rating: 3 })).toBeNull()
    expect(validateReview({ rating: 0 })).not.toBeNull()
  })
})
