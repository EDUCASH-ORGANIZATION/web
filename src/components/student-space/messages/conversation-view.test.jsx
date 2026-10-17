// @ds-screen RD-STUDENT-01
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("next/navigation", () => ({ notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/message.actions", () => ({
  sendStudentMessage: vi.fn(),
  markStudentConversationRead: vi.fn(),
  getStudentConversation: vi.fn(),
  getStudentMessageMedia: vi.fn(async () => ({ media: {} })),
}))
const realtime = vi.fn(({ initialMessages }) => ({ messages: initialMessages, append: vi.fn(), refreshMedia: vi.fn() }))
vi.mock("@/lib/actions/purchase-request.actions", () => ({
  createPurchaseRequest: vi.fn(),
  editPurchaseRequest: vi.fn(),
  cancelPurchaseRequest: vi.fn(),
  confirmPurchaseReceived: vi.fn(),
  reportPurchaseRequestAsStudent: vi.fn(),
}))
vi.mock("@/hooks/use-purchase-proof-upload", () => ({ usePurchaseProofUpload: () => vi.fn() }))
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: (options) => realtime(options),
  useMessageMediaUpload: () => vi.fn(),
}))

vi.mock("@/lib/actions/message-report.actions", () => ({ reportStudentMessage: vi.fn() }))

const { StudentConversationView, deliverMessage } = await import("./conversation-view")
const { Bubble } = await import("./bubble")
const { getStudentMessageMedia } = await import("@/lib/actions/message.actions")
const { StatusBanner } = await import("./status-banner")
const { Composer, LockedComposer, clockText } = await import("./composer")
const { ImageDialog, LocationDialog } = await import("./media-dialogs")
const { isPairRow } = await import("@/lib/client-space/conversations")

const ORIGIN = "https://example.supabase.co"
const M1 = "11111111-1111-4111-8111-111111111111"
const STUDENT = "22222222-2222-4222-8222-222222222221"
const CLIENT = "33333333-3333-4333-8333-333333333331"
const NOW = "2026-10-13T12:00:00Z"

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN)
  realtime.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

const h1Count = (html) => (html.match(/<h1[\s>]/g) ?? []).length
const h2Count = (html) => (html.match(/<h2[\s>]/g) ?? []).length

const msg = (over) => ({
  id: "m1",
  mine: false,
  type: "text",
  content: "Bonjour",
  mediaUrl: null,
  lat: null,
  lng: null,
  createdAt: "2026-10-13T09:00:00Z",
  read: false,
  ...over,
})

const conversation = (over) => ({
  userId: STUDENT,
  missionId: M1,
  clientId: CLIENT,
  client: { id: CLIENT, name: "Rosine H.", avatarUrl: null },
  mission: { title: "Cours de maths niveau 3e", status: "open" },
  state: "candidate",
  canWrite: true,
  messages: [],
  ...over,
})

const view = (over) => renderToStaticMarkup(<StudentConversationView conversation={conversation(over)} now={NOW} />)

describe("StudentConversationView : conversation vide, candidature en cours", () => {
  const html = view()

  it("affiche l'en-tête (retour, nom du client en h2, mission), aucun h1 et l'invitation à écrire", () => {
    expect(html).toContain('<h2 class="e2-who__name e2-07-name">Rosine H.</h2>')
    expect(html).toContain("Cours de maths niveau 3e")
    expect(html).toContain('href="/messages"')
    expect(html).toContain('aria-label="Retour aux messages"')
    expect(html).toContain("Aucun message pour l&#x27;instant. Écrivez à Rosine H. pour démarrer la discussion.")
    expect(h1Count(html)).toBe(0)
    expect(h2Count(html)).toBe(1)
  })

  it("place « Voir la mission » dans l'en-tête, pas dans le bandeau", () => {
    const head = html.slice(html.indexOf("<header"), html.indexOf("</header>"))
    const banner = html.slice(html.indexOf('class="e2-07-status"'), html.indexOf('class="chat e2-07-chat"'))
    expect(head).toContain(`href="/student/missions/${M1}"`)
    expect(head).toContain("Voir la mission")
    expect(banner).toContain("Candidature en attente de la réponse du client")
    expect(banner).not.toContain("Voir la mission")
  })

  it("propose un compositeur vouvoyé avec image, message vocal et position", () => {
    expect(html).toContain("Écrivez un message…")
    expect(html).toContain('aria-label="Joindre une image"')
    expect(html).toContain('aria-label="Enregistrer un message vocal"')
    expect(html).toContain('aria-label="Partager une position"')
    expect(html).toMatch(/maxLength="2000"/i)
  })

  it("garde le compositeur dans le volet (pas de barre fixe) et annonce le journal poliment", () => {
    expect(html).toContain('class="e2-07-bar"')
    expect(html).not.toContain("mbar2")
    expect(html).not.toContain("e2-mbar")
    expect(html).toContain('role="log"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-relevant="additions"')
  })
})

describe("StudentConversationView : temps réel", () => {
  it("passe le client comme autre partie au hook et l'étudiant comme utilisateur", () => {
    view({ messages: [msg()] })
    expect(realtime).toHaveBeenCalledTimes(1)
    const options = realtime.mock.calls[0][0]
    expect(options.missionId).toBe(M1)
    expect(options.studentId).toBe(CLIENT)
    expect(options.userId).toBe(STUDENT)
    expect(typeof options.onIncoming).toBe("function")
  })

  it("le filtre de paire du hook couvre le cas étudiant (échange dans les deux sens, jamais un tiers)", () => {
    expect(isPairRow({ sender_id: STUDENT, receiver_id: CLIENT }, STUDENT, CLIENT)).toBe(true)
    expect(isPairRow({ sender_id: CLIENT, receiver_id: STUDENT }, STUDENT, CLIENT)).toBe(true)
    expect(isPairRow({ sender_id: "autre", receiver_id: STUDENT }, STUDENT, CLIENT)).toBe(false)
    expect(isPairRow({ sender_id: CLIENT, receiver_id: "autre" }, STUDENT, CLIENT)).toBe(false)
  })
})


// Descend dans l'arbre d'éléments rendu par Bubble pour retrouver le premier <img> ou <audio>.
function findMedia(node) {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findMedia(child)
      if (found) return found
    }
    return null
  }
  if (node.type === "img" || node.type === "audio") return node
  const rendered = typeof node.type === "function" ? node.type(node.props) : null
  return findMedia(rendered) ?? findMedia(node.props?.children)
}

describe("StudentConversationView : médias signés", () => {
  it("fournit au hook une résolution qui appelle getStudentMessageMedia avec la mission seule", async () => {
    realtime.mockClear()
    view({ messages: [msg()] })
    const { resolveMedia } = realtime.mock.calls[0][0]
    await resolveMedia(["m-1"])
    expect(getStudentMessageMedia).toHaveBeenCalledWith({ missionId: M1, messageIds: ["m-1"] })
  })

  it("une erreur de chargement de l'image ou du vocal appelle onMediaError avec l'identifiant du message", () => {
    const onMediaError = vi.fn()
    const signed = "https://example.supabase.co/storage/v1/object/sign/message-media/u/a.jpg?token=t"
    for (const type of ["image", "voice"]) {
      const el = findMedia(Bubble({ message: msg({ id: `m-${type}`, type, mediaUrl: signed }), senderName: "Rosine H.", onMediaError }))
      expect(el.props.src).toBe(signed)
      el.props.onError()
      expect(onMediaError).toHaveBeenLastCalledWith(`m-${type}`)
    }
  })
})

describe("StudentConversationView : mission en cours", () => {
  const html = view({ state: "in_progress", mission: { title: "Cours de maths", status: "in_progress" }, messages: [msg()] })

  it("rappelle de prévenir le client quand c'est terminé", () => {
    expect(html).toContain("Mission en cours. Prévenez le client par message quand c&#x27;est terminé.")
    expect(html).toContain("Voir la mission")
  })

  it("rend les messages avec séparateur de jour et heure du Bénin", () => {
    expect(html).toContain('class="chat__day"')
    expect(html).toContain("Aujourd&#x27;hui")
    expect(html).toContain("10:00")
  })
})

describe("StudentConversationView : bandeau de mission avec montants", () => {
  const mission = (over) => ({ title: "Courses du mois", status: "in_progress", budget: 8000, net: 7040, purchasesEstimate: 7450, ...over })
  const banner = (html) => html.slice(html.indexOf('class="e2-07-status'), html.indexOf('class="chat e2-07-chat"'))
  const withState = (over, paymentsEnabled) =>
    renderToStaticMarkup(
      <StudentConversationView
        conversation={conversation({ state: "in_progress", mission: mission(over) })}
        now={NOW}
        paymentsEnabled={paymentsEnabled}
      />,
    )

  it("affiche « Avec achats », le service en séquestre, le net touché et la règle des achats", () => {
    const text = banner(withState({}, true)).replace(/<[^>]+>/g, "").replace(/\u202f|\u00a0/g, " ")
    expect(banner(withState({}, true))).toContain("Avec achats")
    expect(text).toContain("Service : 8 000 FCFA en séquestre · vous touchez 7 040 FCFA · les achats se paient hors EduCash")
    expect(text).toContain("8 000 FCFA en séquestre")
  })

  it("sans estimation : pas de badge ni de règle des achats", () => {
    const html = banner(withState({ purchasesEstimate: null }, true))
    expect(html).not.toContain("Avec achats")
    expect(html).not.toContain("hors EduCash")
    expect(html.replace(/\u202f|\u00a0/g, " ")).toContain("vous touchez")
  })

  it("paiements fermés : montants indicatifs, aucune promesse de séquestre", () => {
    const text = banner(withState({}, false)).replace(/<[^>]+>/g, "").replace(/\u202f|\u00a0/g, " ")
    expect(text).toContain("Service : 8 000 FCFA · vous touchez 7 040 FCFA (montants indicatifs)")
    expect(text).not.toContain("séquestre")
  })

  it("la classe e2-07-status--amounts n'est posée que lorsque les montants s'affichent", () => {
    expect(banner(withState({}, true))).toContain("e2-07-status e2-07-status--amounts")
    expect(banner(withState({ budget: null, net: null }, true))).not.toContain("e2-07-status--amounts")
  })

  it("sans budget ou sans net : texte d'état seul, aucun montant", () => {
    const html = banner(withState({ budget: null, net: null }, true))
    expect(html).toContain("Mission en cours. Prévenez le client par message quand c&#x27;est terminé.")
    expect(html).not.toContain("FCFA")
  })
})

describe("StudentConversationView : mission terminée", () => {
  const html = view({ state: "done", canWrite: false, mission: { title: "Cours de maths", status: "done" }, messages: [msg()] })

  it("propose « Noter le client » et verrouille l'écriture", () => {
    expect(html).toContain("Noter le client")
    expect(html).toContain(`href="/student/review/${M1}"`)
    expect(html).toContain("Mission terminée : cette conversation est en lecture seule.")
    expect(html).toContain("composer e2-07-composer is-locked")
    expect(html).not.toContain("<textarea")
    expect(html).not.toContain('aria-label="Envoyer"')
  })
})

describe("StudentConversationView : lecture seule", () => {
  for (const [state, text] of [
    ["cancelled", "Mission annulée : cette conversation est en lecture seule."],
    ["rejected", "Candidature non retenue : cette conversation est en lecture seule."],
    ["closed", "Un autre étudiant a été retenu : cette conversation est en lecture seule."],
  ]) {
    it(`verrouille l'écriture quand l'état est ${state}`, () => {
      const html = view({ state, canWrite: false, messages: [msg()] })
      expect(html).toContain(text.replace("'", "&#x27;"))
      expect(html).not.toContain("<textarea")
    })
  }

  it("n'invite pas à écrire dans une conversation vide en lecture seule", () => {
    const html = view({ state: "done", canWrite: false })
    expect(html).toContain("Aucun message dans cette conversation.")
    expect(html).not.toContain("démarrer la discussion")
  })
})

describe("Bubble", () => {
  const render = (message, extra) => renderToStaticMarkup(<Bubble message={message} senderName="Rosine H." {...extra} />)

  it("distingue le message de l'étudiant (bulle encre) de celui du client", () => {
    expect(render(msg({ mine: true }))).toContain("bubble bubble--me")
    expect(render(msg({ mine: true }))).toContain('<span class="sr-only">Vous : </span>')
    expect(render(msg())).toContain("bubble bubble--them")
    expect(render(msg())).toContain("Rosine H. : ")
  })

  it("échappe le texte, sans HTML interprété ni lien automatique", () => {
    const html = render(msg({ content: '<img src=x onerror="alert(1)"> <script>x</script> https://exemple.test' }))
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;")
    expect(html).not.toContain("<a ")
    expect(html).toContain("https://exemple.test")
  })

  it("rend une image et un message vocal du compartiment du projet, sans lien vers l'objet brut", () => {
    const image = `${ORIGIN}/storage/v1/object/public/message-media/u/a.jpg`
    const html = render(msg({ type: "image", mediaUrl: image }))
    expect(html).toContain(`src="${image}"`)
    expect(html).toContain("bubble--media")
    expect(html).not.toContain("<a ")
    expect(render(msg({ type: "voice", mediaUrl: image }))).toContain("<audio")
  })

  it("affiche un média indisponible quand l'adresse a été refusée", () => {
    expect(render(msg({ type: "image", mediaUrl: null }))).toContain("Image indisponible")
    expect(render(msg({ type: "voice", mediaUrl: null }))).toContain("Message vocal indisponible")
    expect(render(msg({ type: "location", lat: null, lng: null }))).toContain("Position indisponible")
  })

  it("rend une position comme un lien construit à partir de nombres", () => {
    const html = render(msg({ type: "location", lat: 6.37, lng: 2.39 }))
    expect(html).toContain('href="https://www.google.com/maps/search/?api=1&amp;query=6.37,2.39"')
    expect(html).toContain('href="https://www.google.com/maps/dir/?api=1&amp;destination=6.37,2.39"')
    expect(html).not.toContain("openstreetmap.org")
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it("montre l'envoi en cours sans actions", () => {
    const html = render(msg({ mine: true }), { status: "sending" })
    expect(html).toContain("is-sending")
    expect(html).toContain("Envoi en cours...")
    expect(html).not.toContain("Réessayer")
  })

  it("montre l'échec d'envoi visible avec Réessayer et Supprimer", () => {
    const html = render(msg({ mine: true }), { status: "failed", error: "Non envoyé. Votre message n'a pas pu être envoyé." })
    expect(html).toContain("is-failed")
    expect(html).toContain("Non envoyé. Votre message n&#x27;a pas pu être envoyé.")
    expect(html).toContain("Réessayer")
    expect(html).toContain("Supprimer")
  })

  it("indique lu ou envoyé pour un message de l'étudiant", () => {
    expect(render(msg({ mine: true, read: true }))).toContain("Lu")
    expect(render(msg({ mine: true, read: false }))).toContain("Envoyé")
    expect(render(msg({ mine: false }))).not.toContain("Envoyé")
  })
})

describe("StatusBanner", () => {
  const render = (state) => renderToStaticMarkup(<StatusBanner state={state} missionId={M1} />)

  it("décline chaque état avec son action", () => {
    expect(render("candidate")).toContain("En attente")
    expect(render("in_progress")).toContain("En cours")
    expect(render("done")).toContain("Terminée")
    expect(render("done")).toContain("Noter le client")
    expect(render("cancelled")).toContain("Annulée")
    expect(render("cancelled")).not.toContain("<a ")
    expect(render("rejected")).toContain("Non retenue")
    expect(render("closed")).toContain("Attribuée")
  })

  it("ne rend rien pour un état inconnu", () => {
    expect(render("???")).toBe("")
  })
})

describe("Composer et dialogues", () => {
  it("au repos, le micro remplace l'envoi ; le champ est borné en longueur et en type de fichier", () => {
    const html = renderToStaticMarkup(<Composer onSend={vi.fn()} />)
    // Au repos, le micro occupe la place de l'envoi (il est remplacé dès qu'il y a du texte, voir composer.test.jsx).
    expect(html).not.toContain('type="submit"')
    expect(html).toContain('aria-label="Enregistrer un message vocal"')
    expect(html).toMatch(/maxLength="2000"|maxlength="2000"/i)
    expect(html).toContain('accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"')
  })

  it("rend l'écriture verrouillée avec une note", () => {
    const html = renderToStaticMarkup(<LockedComposer text="Lecture seule." />)
    expect(html).toContain('role="note"')
    expect(html).toContain("Lecture seule.")
  })

  it("formate la durée d'enregistrement", () => {
    expect(clockText(0)).toBe("00:00")
    expect(clockText(75)).toBe("01:15")
  })

  it("demande confirmation avant d'envoyer une image (fenêtre modale titrée, taille annoncée)", () => {
    const html = renderToStaticMarkup(
      <ImageDialog file={{ size: 2.5 * 1024 * 1024 }} previewUrl="blob:local" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain("Envoyer cette image ?")
    expect(html).toContain("2,5 Mo")
    expect(html).toContain('src="blob:local"')
  })

  it("propose le partage de position dans une fenêtre modale vouvoyée", () => {
    const html = renderToStaticMarkup(<LocationDialog onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain("Partager une position")
    expect(html).toContain("Le client pourra l&#x27;ouvrir dans Google Maps.")
    expect(html).toContain("Utiliser ma position")
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Partager cette position/)
  })
})

describe("deliverMessage", () => {
  const sent = { id: "srv-1", mine: true, type: "text", content: "Bonjour" }

  it("envoie un texte sans téléverser", async () => {
    const upload = vi.fn()
    const send = vi.fn().mockResolvedValue({ success: true, message: sent })
    const out = await deliverMessage({ type: "text", content: "Bonjour" }, { upload, send })
    expect(out).toEqual({ ok: true, message: sent })
    expect(upload).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith({ type: "text", content: "Bonjour", mediaPath: undefined, lat: undefined, lng: undefined })
  })

  it("téléverse d'abord un fichier puis transmet seulement son chemin", async () => {
    const file = new Blob(["x"], { type: "image/png" })
    const upload = vi.fn().mockResolvedValue(`${STUDENT}/a.png`)
    const send = vi.fn().mockResolvedValue({ success: true, message: sent })
    await deliverMessage({ type: "image", file, ext: "png" }, { upload, send })
    expect(upload).toHaveBeenCalledWith(file, "png")
    expect(send.mock.calls[0][0]).toMatchObject({ type: "image", mediaPath: `${STUDENT}/a.png` })
    expect(send.mock.calls[0][0]).not.toHaveProperty("file")
  })

  it("signale un échec de téléversement sans appeler l'action", async () => {
    const upload = vi.fn().mockRejectedValue(new Error("upload"))
    const send = vi.fn()
    const out = await deliverMessage({ type: "voice", file: new Blob(["x"]), ext: "webm" }, { upload, send })
    expect(out).toEqual({ ok: false, error: "Non envoyé. Votre fichier n'a pas pu être téléversé.", mediaPath: undefined })
    expect(send).not.toHaveBeenCalled()
  })

  it("conserve le chemin téléversé quand l'envoi échoue, et ne téléverse pas deux fois à la reprise", async () => {
    const upload = vi.fn().mockResolvedValue(`${STUDENT}/a.png`)
    const send = vi
      .fn()
      .mockResolvedValueOnce({ error: "Cette conversation est en lecture seule." })
      .mockResolvedValueOnce({ success: true, message: sent })
    const item = { type: "image", file: new Blob(["x"]), ext: "png" }
    const first = await deliverMessage(item, { upload, send })
    expect(first).toEqual({ ok: false, error: "Non envoyé. Cette conversation est en lecture seule.", mediaPath: `${STUDENT}/a.png` })
    const second = await deliverMessage({ ...item, mediaPath: first.mediaPath }, { upload, send })
    expect(second.ok).toBe(true)
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it("convertit une exception réseau en erreur neutre", async () => {
    const out = await deliverMessage({ type: "text", content: "x" }, { upload: vi.fn(), send: vi.fn().mockRejectedValue(new Error("TypeError: Failed to fetch")) })
    expect(out).toEqual({ ok: false, error: "Non envoyé. Votre message n'a pas pu être envoyé.", mediaPath: undefined })
  })

  it("traite une réponse vide comme un échec", async () => {
    const out = await deliverMessage({ type: "text", content: "x" }, { upload: vi.fn(), send: vi.fn().mockResolvedValue(undefined) })
    expect(out.ok).toBe(false)
  })
})

// ─── Garde-fous de structure et de sécurité ────────────────────────────────────────────────────────────────

describe("structure et sécurité", () => {
  const root = join(import.meta.dirname, "..", "..", "..", "..")
  const messagesDir = join(root, "src", "components", "student-space", "messages")
  const sources = readdirSync(messagesDir)
    .filter((f) => /\.jsx$/.test(f) && !f.endsWith(".test.jsx"))
    .map((f) => [f, readFileSync(join(messagesDir, f), "utf8")])
  const pagePath = join(root, "src", "app", "(student)", "messages", "[missionId]", "page.js")
  const page = readFileSync(pagePath, "utf8")

  it("n'utilise jamais dangerouslySetInnerHTML ni h-screen / 100vh", () => {
    for (const [file, source] of [...sources, ["page.js", page]]) {
      expect(source, file).not.toContain("dangerouslySetInnerHTML")
      expect(source, file).not.toMatch(/h-screen|100vh/)
    }
  })

  it("n'écrit jamais dans messages depuis le navigateur : seul le hook de src/hooks touche Supabase", () => {
    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(/lib\/supabase\//)
      expect(source, file).not.toMatch(/\.from\(\s*["']messages["']/)
      expect(source, file).not.toMatch(/\.update\(|\.insert\(/)
    }
    const view = sources.find(([f]) => f === "conversation-view.jsx")[1]
    expect(view).toContain("sendStudentMessage")
    expect(view).toContain("markStudentConversationRead")
    expect(view).toContain("useMessageMediaUpload(userId)")
  })

  it("n'importe aucun composant de la messagerie client ni de l'ancienne messagerie", () => {
    for (const [file, source] of [...sources, ["page.js", page]]) {
      expect(source, file).not.toMatch(/components\/messages\//)
      expect(source, file).not.toMatch(/components\/client-space\//)
    }
  })

  it("ne place aucun loading.js sous messages (le segment [missionId] appelle notFound)", () => {
    const base = join(root, "src", "app", "(student)", "messages")
    const found = []
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/^loading\./.test(name)) found.push(p)
      }
    }
    expect(existsSync(base)).toBe(true)
    walk(base)
    expect(found).toEqual([])
    expect(existsSync(join(root, "src", "app", "(student)", "loading.js"))).toBe(false)
  })

  it("la page appelle notFound() hors de tout <Suspense> et ne lit jamais l'autre partie dans l'adresse", () => {
    expect(page).toContain("notFound()")
    expect(page).not.toMatch(/<Suspense[\s>]/)
    // Seuls les deux drapeaux d'achats (sans action) sont lus ; l'interlocuteur vient de l'action, jamais de l'adresse.
    expect([...new Set([...page.matchAll(/query\.(\w+)/g)].map((m) => m[1]))].sort()).toEqual(["achat", "demande"])
    expect(page).not.toMatch(/query\.(client|clientId|studentId|userId|other|receiver)/)
    expect(page).toContain("getStudentConversation({ missionId })")
  })
})

describe("e07.css : saisie et bandeau (règles statiques)", () => {
  const css = readFileSync(join(process.cwd(), "src/app/design/student/e07.css"), "utf8")
  const tablet = css.slice(css.indexOf("@media (max-width: 1023.98px)"))

  it("la saisie ne passe jamais à la ligne (aucun flex-wrap sous 480 px)", () => {
    expect(css).not.toMatch(/\.e2-07-composer \{[^}]*flex-wrap: wrap/)
    expect(css).not.toMatch(/\.e2-07-composer \.composer__tools \{[^}]*flex: 1 1 100%/)
  })

  it("outils de 40 px au bureau, 44 px sous 1024", () => {
    expect(css).toContain(".e2-07-composer .iconbtn2, .e2-07-composer .composer__send { width: 40px; height: 40px; }")
    expect(tablet).toContain(".e2-07-composer .iconbtn2, .e2-07-composer .composer__send { width: 44px; height: 44px; }")
  })

  it("bandeau sur une ligne sous 1024 et volet pleine largeur sans rayon", () => {
    expect(tablet).toContain(".e2-07-status--amounts { flex-wrap: nowrap; }")
    expect(tablet).not.toMatch(/\.e2-07-status \{ flex-wrap: nowrap/)
    expect(tablet).toContain(".e2-07-status--amounts .e2-07-status__text { overflow: hidden;")
    expect(css).not.toContain("min-height: 57px")
    expect(tablet).toMatch(/\.e2-07-pane \{[^}]*border-radius: 0;/)
    expect(tablet).toMatch(/\.e2-07-pane \{[^}]*margin-inline: calc\(-1 \* var\(--s-4\)\)/)
  })

  it("le retour n'existe que sous 1024", () => {
    expect(css.slice(0, css.indexOf("@media"))).toMatch(/\.e2-07-back[^{]*\{ display: none; \}/)
    expect(tablet).toMatch(/\.e2-07-back[^{]*\{ display: inline-grid; \}/)
  })

  it("la zone sûre du bas n'est comptée qu'une fois, dans la saisie", () => {
    expect(tablet).toContain(".e2-07-composer:not(.is-locked) { padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }")
    expect(tablet).toContain(".shell--v2:has(.e2-07-pane) .shell__main { padding-bottom: var(--s-2); }")
    expect((css.match(/safe-area-inset-bottom/g) ?? []).length).toBe(1)
    const e06 = readFileSync(join(process.cwd(), "src/app/design/student/e06.css"), "utf8")
    expect(e06).not.toContain("safe-area-inset-bottom")
    expect(e06).toContain(".e2-06-inbox > .e2-07-pane { height: calc(100dvh - var(--s-2)); }")
  })
})
