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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/message.actions", () => ({
  sendClientMessage: vi.fn(),
  markClientConversationRead: vi.fn(),
}))
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: ({ initialMessages }) => ({ messages: initialMessages, append: vi.fn() }),
  useMessageMediaUpload: () => vi.fn(),
}))

const { InboxView, InboxSkeleton, inboxHref, subtitleOf } = await import("./inbox-view")
const { ConversationView, deliverMessage } = await import("./conversation-view")
const { Bubble } = await import("./bubble")
const { StatusBanner } = await import("./status-banner")
const { Composer, LockedComposer, clockText } = await import("./composer")
const { ImageDialog } = await import("./image-dialog")

const ORIGIN = "https://example.supabase.co"
const M1 = "11111111-1111-4111-8111-111111111111"
const S1 = "22222222-2222-4222-8222-222222222221"
const S2 = "22222222-2222-4222-8222-222222222222"
const NOW = "2026-10-13T12:00:00Z"

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN))
afterEach(() => vi.unstubAllEnvs())

const conv = (over) => ({
  key: `${M1}:${S1}`,
  missionId: M1,
  studentId: S1,
  name: "Awa K.",
  avatarUrl: null,
  missionTitle: "Traduire un flyer en anglais",
  state: "candidate",
  preview: "Oui, je peux vous envoyer un essai.",
  lastAt: "2026-10-13T09:48:00Z",
  unreadCount: 0,
  ...over,
})

const inbox = (props) => renderToStaticMarkup(<InboxView now={NOW} {...props} />)
const h1Count = (html) => (html.match(/<h1[\s>]/g) ?? []).length

// ─── C12 Boîte de réception ────────────────────────────────────────────────────────────────────────────────

describe("InboxView : boîte vide", () => {
  const html = inbox({ result: { conversations: [] } })

  it("invite à lancer une discussion depuis une candidature, avec un bouton et un lien", () => {
    expect(html).toContain("Aucune conversation")
    expect(html).toContain("Lancez une discussion depuis une candidature")
    expect(html).toContain('<a href="/client/missions" class="btn btn--primary">Voir mes missions</a>')
    expect(html).toContain('<a href="/client/missions/new" class="link2">Publier une mission</a>')
  })

  it("n'affiche ni recherche ni filtre et garde un seul h1", () => {
    expect(html).not.toContain('role="search"')
    expect(html).not.toContain("segmented")
    expect(h1Count(html)).toBe(1)
    expect(html).toContain("Messages")
  })
})

describe("InboxView : erreur", () => {
  it("affiche une erreur annoncée, distincte du vide", () => {
    const html = inbox({ result: { error: "Impossible de charger vos messages. Veuillez réessayer." } })
    expect(html).toContain('role="alert"')
    expect(html).toContain("Impossible d&#x27;afficher vos messages")
    expect(html).toContain("Impossible de charger vos messages. Veuillez réessayer.")
    expect(html).toContain("Réessayer")
    expect(html).not.toContain("Aucune conversation")
    expect(h1Count(html)).toBe(1)
  })

  it("traite une réponse sans liste comme une erreur", () => {
    expect(inbox({ result: undefined })).toContain('role="alert"')
  })
})

describe("InboxView : conversations", () => {
  const list = [
    conv({ key: `${M1}:${S1}`, studentId: S1, name: "Awa K.", unreadCount: 2 }),
    conv({ key: `${M1}:${S2}`, studentId: S2, name: "Sèna A.", preview: "Vous : À ce soir", lastAt: "2026-10-12T15:00:00Z", state: "in_progress" }),
  ]
  const html = inbox({ result: { conversations: list } })

  it("rend deux conversations distinctes pour deux candidats d'une même mission", () => {
    expect(html).toContain(`href="/client/messages/${M1}?studentId=${S1}"`)
    expect(html).toContain(`href="/client/messages/${M1}?studentId=${S2}"`)
    expect((html.match(/class="convo( is-unread)?"/g) ?? []).length).toBe(2)
  })

  it("annonce le résumé, les non lus (compteur et texte caché) et l'état de lecture", () => {
    expect(html).toContain("2 conversations · 2 non lues")
    expect(html).toContain('class="convo is-unread"')
    expect(html).toContain('<span class="count">2<span class="sr-only"> messages non lus</span></span>')
    expect(html).toContain("Non lues (2)")
  })

  it("affiche aperçu, mission avec relation et heure au fuseau du Bénin", () => {
    expect(html).toContain("Candidat · Traduire un flyer en anglais")
    expect(html).toContain("Traduire un flyer en anglais · en cours")
    expect(html).toContain("Vous : À ce soir")
    expect(html).toContain("10:48")
    expect(html).toContain("Hier")
  })

  it("propose recherche et filtre portés par l'adresse, un seul h1", () => {
    expect(html).toContain('role="search"')
    expect(html).toContain('action="/client/messages"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain(`href="${inboxHref({ unreadOnly: true })}"`)
    expect(h1Count(html)).toBe(1)
  })

  it("filtre les non lues", () => {
    const only = inbox({ result: { conversations: list }, unreadOnly: true })
    expect(only).toContain("Awa K.")
    expect(only).not.toContain("Sèna A.")
    expect(only).toContain('name="filtre" value="non-lues"')
  })

  it("filtre par recherche sans accent ni casse, et garde le mot dans le champ", () => {
    const found = inbox({ result: { conversations: list }, q: "SENA" })
    expect(found).toContain("Sèna A.")
    expect(found).not.toContain("Awa K.")
    expect(found).toContain('value="SENA"')
  })

  it("explique l'absence de résultat et propose d'effacer la recherche", () => {
    const none = inbox({ result: { conversations: list }, q: "zzz" })
    expect(none).toContain("Aucune conversation pour « zzz »")
    expect(none).toContain('href="/client/messages"')
    expect(none).not.toMatch(/class="convo( is-unread)?"/)
  })

  it("explique l'absence de non lus", () => {
    const none = inbox({ result: { conversations: [conv()] }, unreadOnly: true })
    expect(none).toContain("Aucun message non lu")
    expect(none).toContain("Voir toutes les conversations")
  })

  it("échappe le contenu des aperçus et des titres", () => {
    const html = inbox({ result: { conversations: [conv({ preview: "<script>alert(1)</script>", missionTitle: "<b>Titre</b>" })] } })
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<b>Titre</b>")
  })

  it("encode la recherche dans les adresses", () => {
    expect(inboxHref({ q: "a b&c", unreadOnly: true })).toBe("/client/messages?q=a+b%26c&filtre=non-lues")
    expect(inboxHref()).toBe("/client/messages")
  })

  it("nomme la relation de chaque état", () => {
    expect(subtitleOf({ state: "rejected", missionTitle: "T" })).toBe("Candidature refusée · T")
    expect(subtitleOf({ state: "done", missionTitle: "T" })).toBe("T · terminée")
    expect(subtitleOf({ state: "cancelled", missionTitle: "T" })).toBe("T · annulée")
    expect(subtitleOf({ state: "closed", missionTitle: "" })).toBe("Mission")
  })

  it("rend un squelette de chargement annoncé", () => {
    const skeleton = renderToStaticMarkup(<InboxSkeleton />)
    expect(skeleton).toContain("Chargement en cours")
    expect(h1Count(skeleton)).toBe(1)
  })
})

// ─── C13 Conversation ──────────────────────────────────────────────────────────────────────────────────────

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
  userId: "client-1",
  missionId: M1,
  studentId: S1,
  student: { id: S1, name: "Awa K.", avatarUrl: null },
  mission: { title: "Traduire un flyer en anglais", status: "open" },
  state: "candidate",
  canWrite: true,
  messages: [],
  ...over,
})

const view = (over) => renderToStaticMarkup(<ConversationView conversation={conversation(over)} now={NOW} />)

describe("ConversationView : premier message à un candidat", () => {
  const html = view()

  it("affiche l'en-tête, le bandeau « Voir la candidature » et l'invitation à écrire", () => {
    expect(html).toContain('<h1 class="conv2__name">Awa K.</h1>')
    expect(html).toContain("Traduire un flyer en anglais")
    expect(html).toContain("Candidature en attente de votre réponse")
    expect(html).toContain(`href="/client/missions/${M1}?candidat=${S1}"`)
    expect(html).toContain("Voir la candidature")
    expect(html).toContain("Aucun message pour l&#x27;instant. Écrivez à Awa K. pour démarrer la discussion.")
    expect(h1Count(html)).toBe(1)
  })

  it("propose la saisie vouvoyée avec image, message vocal et position", () => {
    expect(html).toContain("Écrivez un message...")
    expect(html).toContain('aria-label="Joindre une image"')
    expect(html).toContain('aria-label="Enregistrer un message vocal"')
    expect(html).toContain('aria-label="Partager une position"')
    expect(html).toContain('aria-label="Envoyer"')
    expect(html).toMatch(/maxLength="2000"/i)
  })

  it("place la saisie dans la barre d'action fixe sur mobile (.mbar2) et annonce le journal poliment", () => {
    expect(html).toContain('class="mbar2 mbar2--chat"')
    expect(html).toContain('role="log"')
    expect(html).toContain('aria-relevant="additions"')
    expect(html).toContain('aria-label="Retour aux messages"')
  })
})

describe("ConversationView : mission en cours", () => {
  const html = view({ state: "in_progress", mission: { title: "Cours de maths", status: "in_progress" }, messages: [msg()] })

  it("propose « Confirmer la fin » vers ?confirmer=1", () => {
    expect(html).toContain("Mission en cours")
    expect(html).toContain(`href="/client/missions/${M1}?confirmer=1"`)
    expect(html).toContain("Confirmer la fin")
  })

  it("rend les messages avec séparateur de jour et heure du Bénin", () => {
    expect(html).toContain('class="chat__day"')
    expect(html).toContain("Aujourd&#x27;hui")
    expect(html).toContain("10:00")
  })
})

describe("ConversationView : lecture seule", () => {
  for (const [state, text] of [
    ["done", "Mission terminée : cette conversation est en lecture seule."],
    ["cancelled", "Mission annulée : cette conversation est en lecture seule."],
    ["rejected", "Candidature refusée : cette conversation est en lecture seule."],
    ["closed", "Un autre étudiant a été retenu : cette conversation est en lecture seule."],
  ]) {
    it(`verrouille la saisie quand l'état est ${state}`, () => {
      const html = view({ state, canWrite: false, messages: [msg()] })
      expect(html).toContain(text.replace("'", "&#x27;"))
      expect(html).toContain("composer is-locked")
      expect(html).not.toContain("<textarea")
      expect(html).not.toContain('aria-label="Envoyer"')
    })
  }

  it("n'invite pas à écrire dans une conversation vide en lecture seule", () => {
    const html = view({ state: "done", canWrite: false })
    expect(html).toContain("Aucun message dans cette conversation.")
    expect(html).not.toContain("démarrer la discussion")
  })
})

describe("Bubble", () => {
  const render = (message, extra) => renderToStaticMarkup(<Bubble message={message} senderName="Awa K." {...extra} />)

  it("distingue le message du client (bulle encre) de celui de l'étudiant", () => {
    expect(render(msg({ mine: true }))).toContain("bubble bubble--me")
    expect(render(msg({ mine: true }))).toContain("<span class=\"sr-only\">Vous : </span>")
    expect(render(msg())).toContain("bubble bubble--them")
    expect(render(msg())).toContain("Awa K. : ")
  })

  it("échappe le texte, sans HTML interprété ni lien automatique", () => {
    const html = render(msg({ content: '<img src=x onerror="alert(1)"> <script>x</script> https://exemple.test' }))
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;")
    expect(html).not.toContain("<a ")
    expect(html).toContain("https://exemple.test")
  })

  it("rend une image et un message vocal du compartiment du projet", () => {
    const image = `${ORIGIN}/storage/v1/object/public/message-media/u/a.jpg`
    expect(render(msg({ type: "image", mediaUrl: image }))).toContain(`src="${image}"`)
    expect(render(msg({ type: "image", mediaUrl: image }))).toContain("bubble--media")
    expect(render(msg({ type: "voice", mediaUrl: image }))).toContain("<audio")
  })

  it("affiche un média indisponible quand l'adresse a été refusée", () => {
    expect(render(msg({ type: "image", mediaUrl: null }))).toContain("Image indisponible")
    expect(render(msg({ type: "voice", mediaUrl: null }))).toContain("Message vocal indisponible")
    expect(render(msg({ type: "location", lat: null, lng: null }))).toContain("Position indisponible")
  })

  it("rend une position comme un lien construit à partir de nombres", () => {
    const html = render(msg({ type: "location", lat: 6.37, lng: 2.39 }))
    expect(html).toContain('href="https://www.openstreetmap.org/?mlat=6.37&amp;mlon=2.39#map=16/6.37/2.39"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it("montre l'envoi en cours sans actions", () => {
    const html = render(msg({ mine: true }), { status: "sending" })
    expect(html).toContain("is-sending")
    expect(html).toContain("Envoi en cours...")
    expect(html).not.toContain("Réessayer")
  })

  it("montre l'échec d'envoi avec Réessayer et Supprimer", () => {
    const html = render(msg({ mine: true }), { status: "failed", error: "Non envoyé. Votre message n'a pas pu être envoyé." })
    expect(html).toContain("is-failed")
    expect(html).toContain("Non envoyé. Votre message n&#x27;a pas pu être envoyé.")
    expect(html).toContain("Réessayer")
    expect(html).toContain("Supprimer")
  })

  it("indique lu ou envoyé pour un message du client", () => {
    expect(render(msg({ mine: true, read: true }))).toContain("Lu")
    expect(render(msg({ mine: true, read: false }))).toContain("Envoyé")
    expect(render(msg({ mine: false }))).not.toContain("Envoyé")
  })
})

describe("StatusBanner", () => {
  const render = (state) => renderToStaticMarkup(<StatusBanner state={state} missionId={M1} studentId={S1} />)

  it("décline chaque état avec son action", () => {
    expect(render("candidate")).toContain("En attente")
    expect(render("in_progress")).toContain("Confirmer la fin")
    expect(render("done")).toContain("Terminée")
    expect(render("done")).toContain(`href="/client/missions/${M1}"`)
    expect(render("cancelled")).toContain("Annulée")
    expect(render("rejected")).toContain("Refusée")
    expect(render("closed")).toContain("Clôturée")
  })

  it("ne rend rien pour un état inconnu", () => {
    expect(render("???")).toBe("")
  })
})

describe("Composer et dialogues", () => {
  it("désactive l'envoi tant que le champ est vide et borne la longueur", () => {
    const html = renderToStaticMarkup(<Composer onSend={vi.fn()} />)
    expect(html).toMatch(/<button type="submit" class="composer__send" aria-label="Envoyer" disabled/)
    expect(html).toMatch(/maxLength="2000"|maxlength="2000"/i)
    expect(html).toContain('accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"')
  })

  it("rend la saisie verrouillée avec une note", () => {
    const html = renderToStaticMarkup(<LockedComposer text="Lecture seule." />)
    expect(html).toContain('role="note"')
    expect(html).toContain("Lecture seule.")
  })

  it("formate la durée d'enregistrement", () => {
    expect(clockText(0)).toBe("00:00")
    expect(clockText(75)).toBe("01:15")
  })

  it("demande confirmation avant d'envoyer une image", () => {
    const html = renderToStaticMarkup(
      <ImageDialog file={{ size: 2.5 * 1024 * 1024 }} previewUrl="blob:local" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain("Envoyer cette image ?")
    expect(html).toContain("2,5 Mo")
    expect(html).toContain('src="blob:local"')
  })
})

// ─── Livraison d'un message : envoi, échec, reprise ────────────────────────────────────────────────────────

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
    const upload = vi.fn().mockResolvedValue("client-1/a.png")
    const send = vi.fn().mockResolvedValue({ success: true, message: sent })
    await deliverMessage({ type: "image", file, ext: "png" }, { upload, send })
    expect(upload).toHaveBeenCalledWith(file, "png")
    expect(send.mock.calls[0][0]).toMatchObject({ type: "image", mediaPath: "client-1/a.png" })
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
    const upload = vi.fn().mockResolvedValue("client-1/a.png")
    const send = vi
      .fn()
      .mockResolvedValueOnce({ error: "Cette conversation est en lecture seule." })
      .mockResolvedValueOnce({ success: true, message: sent })
    const item = { type: "image", file: new Blob(["x"]), ext: "png" }
    const first = await deliverMessage(item, { upload, send })
    expect(first).toEqual({ ok: false, error: "Non envoyé. Cette conversation est en lecture seule.", mediaPath: "client-1/a.png" })
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

// ─── Garde-fous de structure ───────────────────────────────────────────────────────────────────────────────

describe("structure", () => {
  const root = join(import.meta.dirname, "..", "..", "..", "..")
  const messagesDir = join(root, "src", "components", "client-space", "messages")
  const sources = readdirSync(messagesDir)
    .filter((f) => /\.jsx$/.test(f) && !f.endsWith(".test.jsx"))
    .map((f) => [f, readFileSync(join(messagesDir, f), "utf8")])

  it("n'utilise jamais dangerouslySetInnerHTML", () => {
    for (const [file, source] of sources) expect(source, file).not.toContain("dangerouslySetInnerHTML")
  })

  it("n'importe aucun composant de la messagerie partagée avec l'étudiant", () => {
    const pages = [
      join(root, "src", "app", "(client)", "client", "messages", "page.js"),
      join(root, "src", "app", "(client)", "client", "messages", "[missionId]", "page.js"),
    ].map((p) => [p, readFileSync(p, "utf8")])
    for (const [file, source] of [...sources, ...pages]) {
      expect(source, file).not.toMatch(/components\/messages\//)
      expect(source, file).not.toMatch(/lib\/supabase\//)
    }
  })

  it("ne place aucun loading.js sous client/messages (le segment [missionId] appelle notFound)", () => {
    const base = join(root, "src", "app", "(client)", "client", "messages")
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
  })

  it("la page de conversation appelle notFound() hors de tout <Suspense>", () => {
    const page = readFileSync(join(root, "src", "app", "(client)", "client", "messages", "[missionId]", "page.js"), "utf8")
    expect(page).toContain("notFound()")
    expect(page).not.toMatch(/<Suspense[\s>]/)
  })
})
