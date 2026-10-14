import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/components/shared/supabase-provider", () => ({ useSupabase: () => ({ supabase: {} }) }))
vi.mock("@/lib/actions/profile.actions", () => ({ saveStudentCardUrl: vi.fn() }))
vi.mock("@/lib/actions/verify-card.actions", () => ({ verifyStudentCardWithAI: vi.fn() }))

const { VerifyView } = await import("./verify-view")
const { checkCardFile, cardStoragePath, sendCardFile, MAX_CARD_BYTES, CARD_TYPES } = await import("./card-dropzone")

const SEND = { label: "Envoyer ma carte", href: "/profile/verify" }
const VERIFS = {
  not_submitted: { key: "not_submitted", label: "Carte à envoyer", canApply: false, daysLeft: null, action: SEND, until: null, submittedLabel: null, rejectionReason: null },
  pending: { key: "pending", label: "Carte en cours d'examen", canApply: true, daysLeft: null, action: null, until: null, submittedLabel: "mer. 7 oct.", rejectionReason: null },
  verified: { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: 264, action: null, until: "2027-06-29", submittedLabel: null, rejectionReason: null },
  expiring: { key: "expiring", label: "Badge à renouveler", canApply: true, daysLeft: 30, action: { label: "Renouveler mon badge", href: "/profile/verify" }, until: "2026-11-07", submittedLabel: null, rejectionReason: null },
  expired: { key: "expired", label: "Badge expiré", canApply: false, daysLeft: -3, action: { label: "Renouveler mon badge", href: "/profile/verify" }, until: "2026-09-29", submittedLabel: null, rejectionReason: null },
  rejected: { key: "rejected", label: "Carte refusée", canApply: false, daysLeft: null, action: { label: "Renvoyer ma carte", href: "/profile/verify" }, until: null, submittedLabel: null, rejectionReason: "Carte illisible ou floue" },
}
const view = (key) => renderToStaticMarkup(<VerifyView result={{ verification: VERIFS[key] }} />)
const count = (html, re) => (html.match(re) ?? []).length

describe("6 statuts", () => {
  it.each([
    ["not_submitted", "Envoyez votre carte étudiante", "Non vérifiée", true],
    ["pending", "Votre carte est en cours d&#x27;examen", "En cours d&#x27;examen", false],
    ["verified", "Votre badge est actif", "Vérifiée", false],
    ["expiring", "Renouvelez votre badge", "À renouveler", true],
    ["expired", "Votre badge a expiré", "Badge expiré", true],
    ["rejected", "Renvoyez votre carte étudiante", "Carte refusée", true],
  ])("%s : titre, pastille, zone d'envoi seulement si une action est due", (key, title, badge, upload) => {
    const html = view(key)
    expect(html).toContain(title)
    expect(html).toContain(badge)
    expect(html.includes('aria-label="Envoyer ma carte étudiante"')).toBe(upload)
    expect(html.includes("e2-mbar")).toBe(upload)
    // L'étiquette citron « À faire » seulement si une action est due.
    expect(html.includes("flag2")).toBe(upload)
    expect(html.includes("À faire")).toBe(upload)
  })

  it("un seul h1 par état, y compris l'échec de chargement", () => {
    for (const key of Object.keys(VERIFS)) expect(count(view(key), /<h1[\s>]/g), key).toBe(1)
    expect(count(renderToStaticMarkup(<VerifyView result={{ error: "x" }} />), /<h1[\s>]/g)).toBe(1)
  })

  it("dates : fin du badge en toutes lettres, étiquette « avant le » courte, date de dépôt formatée", () => {
    expect(view("verified")).toContain("Valable jusqu&#x27;au 29 juin 2027")
    expect(view("expiring")).toContain("À faire avant le sam. 7 nov.")
    expect(view("expiring")).toContain("Votre badge prend fin le 7 novembre 2026")
    expect(view("expired")).toContain("Il a pris fin le 29 septembre 2026")
    expect(view("pending")).toContain("Envoyée le mer. 7 oct.")
  })

  it("date de fin absente : aucune phrase datée", () => {
    const html = renderToStaticMarkup(<VerifyView result={{ verification: { ...VERIFS.expired, until: null } }} />)
    expect(html).toContain("Vos nouvelles candidatures sont bloquées")
    expect(html).not.toContain("Il a pris fin le")
  })

  it("carte refusée : motif affiché ; sans motif, pas de bloc", () => {
    expect(view("rejected")).toContain("Motif du refus")
    expect(view("rejected")).toContain("Carte illisible ou floue")
    const none = renderToStaticMarkup(<VerifyView result={{ verification: { ...VERIFS.rejected, rejectionReason: null } }} />)
    expect(none).not.toContain("Motif du refus")
  })

  it("candidature : expliquée quand elle est bloquée, permise pendant l'examen", () => {
    expect(view("not_submitted")).toContain("pour postuler, envoyez-la ici")
    expect(view("expired")).toContain("nouvelles candidatures sont bloquées")
    expect(view("rejected")).toContain("vous ne pouvez pas postuler")
    expect(view("pending")).toContain("Vous pouvez déjà postuler")
  })

  it("aucun délai d'examen, aucun mot banni, aucun tutoiement, aucun tiret cadratin", () => {
    for (const key of Object.keys(VERIFS)) {
      const html = view(key).replace(/<[^>]*>/g, " ")
      expect(html, key).not.toMatch(/24\s*(à|a|-)\s*48|sous 24|48\s*h/i)
      expect(html, key).not.toMatch(/livraison|course|saisie|bientôt/i)
      expect(html.match(/(?<![\p{L}])(ta|ton|tes|tu|toi)(?![\p{L}])/iu), key).toBeNull()
      expect(html, key).not.toMatch(/[\u2013\u2014]/)
    }
  })

  it("aucune URL de carte ni date brute dans le rendu", () => {
    const html = view("pending")
    expect(html).not.toContain("card_url")
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it("zone d'envoi : formats, poids, conseils sans la ligne des formats en double, bouton mobile relié au formulaire", () => {
    const html = view("not_submitted")
    expect(html).toContain("JPG, PNG, PDF · 10 Mo max")
    expect(html).toContain('accept="image/jpeg,image/png,application/pdf"')
    expect(html).toContain("Tous les coins de la carte doivent être visibles")
    expect(html).not.toContain("Formats acceptés")
    expect(html).not.toContain("10 MB")
    const formId = html.match(/<form id="([^"]+)"/)[1]
    expect(html).toContain(`form="${formId}"`)
    expect(html).toContain("Prendre une photo")
  })

  it("échec de chargement : alerte distincte d'un statut", () => {
    const html = renderToStaticMarkup(<VerifyView result={{ error: "Impossible" }} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain("Impossible de charger votre vérification")
    expect(html).not.toContain("Statut actuel")
  })
})

describe("contrôle du fichier avant envoi", () => {
  const f = (type, size) => ({ type, size })
  it("accepte JPG, PNG, PDF jusqu'à 10 Mo inclus", () => {
    for (const t of Object.keys(CARD_TYPES)) expect(checkCardFile(f(t, 1000))).toEqual({ ok: true })
    expect(checkCardFile(f("image/png", MAX_CARD_BYTES))).toEqual({ ok: true })
  })
  it("refuse un autre format, y compris WEBP, HEIC, texte et type vide", () => {
    for (const t of ["image/webp", "image/heic", "text/html", "image/svg+xml", "application/zip", ""]) {
      expect(checkCardFile(f(t, 1000))).toEqual({ ok: false, reason: "format" })
    }
    expect(checkCardFile(null)).toEqual({ ok: false, reason: "format" })
    expect(checkCardFile({ type: "toString", size: 5 })).toEqual({ ok: false, reason: "format" })
  })
  it("refuse un fichier trop lourd ou vide", () => {
    expect(checkCardFile(f("application/pdf", MAX_CARD_BYTES + 1))).toEqual({ ok: false, reason: "size" })
    expect(checkCardFile(f("image/jpeg", 0))).toEqual({ ok: false, reason: "empty" })
  })
})

describe("chemin d'envoi", () => {
  it("dossier de l'utilisateur, nom unique, extension déduite du type MIME et non du nom", () => {
    expect(cardStoragePath("u1", "image/jpeg", "a1")).toBe("u1/carte-a1.jpg")
    expect(cardStoragePath("u1", "application/pdf", "a2")).toBe("u1/carte-a2.pdf")
    expect(cardStoragePath("u1", "image/png", "a3")).toBe("u1/carte-a3.png")
    expect(cardStoragePath("u1", "image/png", "a1")).not.toBe(cardStoragePath("u1", "image/png", "a2"))
  })
})

describe("envoi complet", () => {
  const png = { name: "carte.exe", type: "image/png", size: 2000 }
  function setup({ user = { id: "u1" }, uploadError = null } = {}) {
    const upload = vi.fn().mockResolvedValue({ error: uploadError })
    const remove = vi.fn().mockResolvedValue({ error: null })
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      storage: { from: vi.fn(() => ({ upload, remove })) },
    }
    return { supabase, upload, remove, verifyCard: vi.fn().mockResolvedValue({ valid: true }), saveCard: vi.fn().mockResolvedValue({ success: true }) }
  }

  it("dépose dans student-cards/<userId>/, sans écraser, puis enregistre le même chemin", async () => {
    const s = setup()
    const phases = []
    const res = await sendCardFile({ ...s, file: png, unique: "z9", onPhase: (p) => phases.push(p) })
    expect(res).toEqual({ success: true })
    expect(s.supabase.storage.from).toHaveBeenCalledWith("student-cards")
    expect(s.upload).toHaveBeenCalledWith("u1/carte-z9.png", png, { upsert: false, contentType: "image/png" })
    expect(s.verifyCard).toHaveBeenCalledWith("u1/carte-z9.png")
    expect(s.saveCard).toHaveBeenCalledWith("u1/carte-z9.png")
    expect(phases).toEqual(["upload", "check", "save"])
  })

  it("fichier hors format ou trop lourd : rien n'est envoyé", async () => {
    for (const file of [{ name: "a.heic", type: "image/heic", size: 10 }, { name: "a.pdf", type: "application/pdf", size: MAX_CARD_BYTES + 1 }]) {
      const s = setup()
      const res = await sendCardFile({ ...s, file })
      expect(res.error).toBeTruthy()
      expect(s.supabase.auth.getUser).not.toHaveBeenCalled()
      expect(s.upload).not.toHaveBeenCalled()
      expect(s.saveCard).not.toHaveBeenCalled()
    }
  })

  it("session absente : aucun envoi", async () => {
    const s = setup({ user: null })
    expect((await sendCardFile({ ...s, file: png })).error).toMatch(/session/i)
    expect(s.upload).not.toHaveBeenCalled()
  })

  it("échec du dépôt : message vouvoyé, aucun enregistrement", async () => {
    const s = setup({ uploadError: { message: "boom" } })
    const res = await sendCardFile({ ...s, file: png })
    expect(res.error).toBe("L'envoi de la carte a échoué. Réessayez.")
    expect(s.saveCard).not.toHaveBeenCalled()
    expect(s.remove).not.toHaveBeenCalled()
  })

  it("image refusée au contrôle : fichier retiré, rien d'enregistré, motif de l'IA non repris", async () => {
    const s = setup()
    s.verifyCard.mockResolvedValue({ valid: false, reason: "Tu envoies un chat" })
    const res = await sendCardFile({ ...s, file: png, unique: "z9" })
    expect(res.error).toContain("ne semble pas être une carte étudiante")
    expect(res.error).not.toContain("chat")
    expect(s.remove).toHaveBeenCalledWith(["u1/carte-z9.png"])
    expect(s.saveCard).not.toHaveBeenCalled()
  })

  it("refus du serveur (chemin, rôle) : message du serveur affiché, fichier retiré", async () => {
    const s = setup()
    s.saveCard.mockResolvedValue({ error: "Fichier non autorisé." })
    const res = await sendCardFile({ ...s, file: png, unique: "z9" })
    expect(res).toEqual({ error: "Fichier non autorisé." })
    expect(s.remove).toHaveBeenCalledWith(["u1/carte-z9.png"])
  })

  it("exception inattendue : message neutre, jamais le message technique", async () => {
    const s = setup()
    s.verifyCard.mockRejectedValue(new TypeError(""))
    expect((await sendCardFile({ ...s, file: png })).error).toBe("Une erreur inattendue est survenue. Réessayez.")
  })
})
