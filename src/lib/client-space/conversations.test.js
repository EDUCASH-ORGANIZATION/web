import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  MEDIA_MAX_BYTES,
  buildConversations,
  conversationAccess,
  conversationKey,
  coordsValid,
  dayOf,
  fileProblem,
  filterConversations,
  formatClock,
  formatDayLabel,
  formatListTime,
  imageExtensionOf,
  isPairRow,
  mediaKindOfPath,
  mergeMessages,
  previewOf,
  MEDIA_SIGNED_URL_TTL,
  createMediaRefresher,
  mediaPathOf,
  safeSignedMediaUrl,
  toMessage,
  unreadTotal,
} from "./conversations"

const ME = "client-1"
const S1 = "student-1"
const S2 = "student-2"
const M1 = "mission-1"
const M2 = "mission-2"
const ORIGIN = "https://example.supabase.co"

const row = (over) => ({
  mission_id: M1,
  sender_id: S1,
  receiver_id: ME,
  content: "Bonjour",
  type: "text",
  read: false,
  created_at: "2026-10-13T08:00:00Z",
  ...over,
})

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN))
afterEach(() => vi.unstubAllEnvs())

describe("buildConversations", () => {
  it("donne une conversation par (mission, interlocuteur) : deux candidats d'une mission restent séparés", () => {
    const list = buildConversations(
      [
        row({ sender_id: S1, content: "De S1", created_at: "2026-10-13T08:00:00Z" }),
        row({ sender_id: S2, content: "De S2", created_at: "2026-10-13T09:00:00Z" }),
      ],
      ME,
    )
    expect(list.map((c) => c.key)).toEqual([conversationKey(M1, S2), conversationKey(M1, S1)])
    expect(list[0].last.content).toBe("De S2")
    expect(list[1].last.content).toBe("De S1")
  })

  it("sépare aussi deux missions avec le même étudiant", () => {
    const list = buildConversations([row({ mission_id: M1 }), row({ mission_id: M2 })], ME)
    expect(list).toHaveLength(2)
  })

  it("garde le message le plus récent et compte les seuls messages reçus non lus", () => {
    const list = buildConversations(
      [
        row({ created_at: "2026-10-13T08:00:00Z", read: false }),
        row({ created_at: "2026-10-13T08:30:00Z", read: false }),
        row({ created_at: "2026-10-13T09:00:00Z", sender_id: ME, receiver_id: S1, content: "Ma réponse", read: false }),
        row({ created_at: "2026-10-13T07:00:00Z", read: true }),
      ],
      ME,
    )
    expect(list).toHaveLength(1)
    expect(list[0].unreadCount).toBe(2)
    expect(list[0].last).toMatchObject({ mine: true, content: "Ma réponse" })
  })

  it("ignore les lignes qui ne concernent pas l'utilisateur ou sont incomplètes", () => {
    const list = buildConversations(
      [row({ sender_id: S1, receiver_id: S2 }), row({ sender_id: ME, receiver_id: ME }), row({ mission_id: undefined }), null],
      ME,
    )
    expect(list).toEqual([])
    expect(buildConversations(undefined, ME)).toEqual([])
  })

  it("trie de la plus récente à la plus ancienne", () => {
    const list = buildConversations(
      [
        row({ sender_id: S1, created_at: "2026-10-12T08:00:00Z" }),
        row({ sender_id: S2, created_at: "2026-10-13T08:00:00Z" }),
      ],
      ME,
    )
    expect(list.map((c) => c.studentId)).toEqual([S2, S1])
  })
})

describe("previewOf", () => {
  it("préfixe « Vous : » pour un message envoyé", () => {
    expect(previewOf({ mine: true, type: "text", content: " Bonjour " })).toBe("Vous : Bonjour")
    expect(previewOf({ mine: false, type: "text", content: "Salut" })).toBe("Salut")
  })

  it("nomme le média au lieu d'afficher son texte stocké", () => {
    expect(previewOf({ mine: false, type: "image", content: "🖼️ Image" })).toBe("Image")
    expect(previewOf({ mine: true, type: "voice", content: "x" })).toBe("Vous : Message vocal")
    expect(previewOf({ mine: false, type: "location", content: "x" })).toBe("Position partagée")
  })

  it("traite un type inconnu comme du texte et un message absent comme vide", () => {
    expect(previewOf({ mine: false, type: "autre", content: "Salut" })).toBe("Salut")
    expect(previewOf(null)).toBe("")
  })
})

describe("filterConversations et unreadTotal", () => {
  const list = [
    { name: "Awa K.", missionTitle: "Traduire un flyer", preview: "Bonjour", unreadCount: 2 },
    { name: "Sèna A.", missionTitle: "Cours de maths", preview: "À ce soir", unreadCount: 0 },
  ]

  it("filtre les non lues", () => {
    expect(filterConversations(list, { unreadOnly: true }).map((c) => c.name)).toEqual(["Awa K."])
    expect(unreadTotal(list)).toBe(2)
  })

  it("cherche dans le nom, la mission et l'aperçu, sans tenir compte de la casse ni des accents", () => {
    expect(filterConversations(list, { q: "sena" }).map((c) => c.name)).toEqual(["Sèna A."])
    expect(filterConversations(list, { q: "FLYER" }).map((c) => c.name)).toEqual(["Awa K."])
    expect(filterConversations(list, { q: "ce soir" }).map((c) => c.name)).toEqual(["Sèna A."])
    expect(filterConversations(list, { q: "introuvable" })).toEqual([])
  })

  it("combine recherche et filtre, et rend tout sans critère", () => {
    expect(filterConversations(list, { q: "sena", unreadOnly: true })).toEqual([])
    expect(filterConversations(list)).toHaveLength(2)
    expect(filterConversations(undefined)).toEqual([])
  })
})

describe("conversationAccess", () => {
  const open = { status: "open", selectedStudentId: null }
  const running = { status: "in_progress", selectedStudentId: S1 }

  it("refuse un étudiant sans candidature ni sélection", () => {
    expect(conversationAccess({ mission: open, application: null, studentId: S1 })).toEqual({ allowed: false, canWrite: false, state: null })
    expect(conversationAccess({ mission: null, application: { status: "pending" }, studentId: S1 }).allowed).toBe(false)
  })

  it("autorise l'écriture : candidature en attente d'une mission ouverte, étudiant retenu d'une mission en cours", () => {
    expect(conversationAccess({ mission: open, application: { status: "pending" }, studentId: S1 })).toEqual({ allowed: true, canWrite: true, state: "candidate" })
    expect(conversationAccess({ mission: running, application: { status: "accepted" }, studentId: S1 })).toEqual({ allowed: true, canWrite: true, state: "in_progress" })
  })

  it("passe en lecture seule dans tous les autres cas", () => {
    const app = { status: "pending" }
    expect(conversationAccess({ mission: open, application: { status: "rejected" }, studentId: S1 })).toMatchObject({ canWrite: false, state: "rejected" })
    expect(conversationAccess({ mission: { status: "done", selectedStudentId: S1 }, application: app, studentId: S1 })).toMatchObject({ canWrite: false, state: "done" })
    expect(conversationAccess({ mission: { status: "cancelled", selectedStudentId: null }, application: app, studentId: S1 })).toMatchObject({ canWrite: false, state: "cancelled" })
    expect(conversationAccess({ mission: running, application: app, studentId: S2 })).toMatchObject({ canWrite: false, state: "closed" })
    expect(conversationAccess({ mission: { status: "?", selectedStudentId: null }, application: app, studentId: S1 })).toMatchObject({ canWrite: false, state: "closed" })
  })
})

describe("fichiers joints", () => {
  it("déduit la nature du fichier de son extension", () => {
    expect(mediaKindOfPath("u/a.JPG")).toBe("image")
    expect(mediaKindOfPath("u/a.heic")).toBe("image")
    expect(mediaKindOfPath("u/a.webm")).toBe("voice")
    expect(mediaKindOfPath("u/a.m4a")).toBe("voice")
    expect(mediaKindOfPath("u/a.html")).toBeNull()
    expect(mediaKindOfPath("u/a.svg")).toBeNull()
    expect(mediaKindOfPath("u/noext")).toBeNull()
    expect(mediaKindOfPath(null)).toBeNull()
  })

  it("déduit l'extension d'une image de son type MIME, pas de son nom", () => {
    expect(imageExtensionOf({ type: "image/jpeg", name: "photo.jfif" })).toBe("jpg")
    expect(imageExtensionOf({ type: "image/jpeg", name: "photo" })).toBe("jpg")
    expect(imageExtensionOf({ type: "image/png", name: "a.jpeg" })).toBe("png")
    expect(imageExtensionOf({ type: "IMAGE/WEBP", name: "" })).toBe("webp")
    expect(imageExtensionOf({ type: "image/heic", name: "IMG.HEIC" })).toBe("heic")
    expect(imageExtensionOf({ type: "", name: "a.gif" })).toBe("gif")
    expect(imageExtensionOf({ type: "", name: "a.jfif" })).toBe("jpg")
    expect(imageExtensionOf({})).toBe("jpg")
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]) {
      expect(mediaKindOfPath(`u/a.${imageExtensionOf({ type })}`)).toBe("image")
    }
  })

  it("contrôle taille et type avant l'envoi", () => {
    expect(fileProblem({ size: 1000, type: "image/png", name: "a.png" }, "image")).toBeNull()
    expect(fileProblem({ size: 1000, type: "", name: "a.heic" }, "image")).toBeNull()
    expect(fileProblem({ size: MEDIA_MAX_BYTES + 1, type: "image/png", name: "a.png" }, "image")).toBe("L'image ne doit pas dépasser 10 Mo.")
    expect(fileProblem({ size: MEDIA_MAX_BYTES + 1, type: "audio/webm" }, "voice")).toBe("Le message vocal ne doit pas dépasser 10 Mo.")
    expect(fileProblem({ size: MEDIA_MAX_BYTES, type: "image/gif", name: "a.gif" }, "image")).toBeNull()
    expect(fileProblem({ size: 10, type: "image/svg+xml", name: "a.svg" }, "image")).toMatch(/Choisissez une image/)
    expect(fileProblem({ size: 10, type: "application/pdf", name: "a.pdf" }, "image")).toMatch(/Choisissez une image/)
    expect(fileProblem({ size: 10, type: "video/mp4" }, "voice")).toBe("Ce message vocal n'est pas accepté.")
    expect(fileProblem({ size: 0, type: "image/png" }, "image")).toBe("Ce fichier est vide.")
    expect(fileProblem(null, "image")).toBe("Ce fichier est vide.")
  })

  it("fixe la validité des adresses signées à 1 h", () => {
    expect(MEDIA_SIGNED_URL_TTL).toBe(3600)
  })

  it("mediaPathOf extrait le chemin sous le dossier de l'expéditeur", () => {
    const base = `${ORIGIN}/storage/v1/object`
    expect(mediaPathOf(`${base}/public/message-media/u1/a.jpg`, "u1")).toBe("u1/a.jpg")
    expect(mediaPathOf(`${base}/sign/message-media/u1/a.jpg?token=t`, "u1")).toBe("u1/a.jpg")
    expect(mediaPathOf(`${base}/authenticated/message-media/u1/a.jpg`, "u1")).toBe("u1/a.jpg")
    expect(mediaPathOf(`${base}/public/avatars/u1/a.jpg`, "u1")).toBeNull()
    expect(mediaPathOf(`https://evil.test/storage/v1/object/public/message-media/u1/a.jpg`, "u1")).toBeNull()
    expect(mediaPathOf(`${base}/public/message-media/u1/../u2/a.jpg`, "u1")).toBeNull()
    expect(mediaPathOf(`${base}/public/message-media/u1/..%2Fu2/a.jpg`, "u1")).toBeNull()
    expect(mediaPathOf(`${base}/public/message-media/u2/a.jpg`, "u1")).toBeNull()
    expect(mediaPathOf(null, "u1")).toBeNull()
  })

  it("safeSignedMediaUrl n'accepte que l'adresse signée du compartiment du projet", () => {
    const ok = `${ORIGIN}/storage/v1/object/sign/message-media/u1/a.jpg?token=abc`
    expect(safeSignedMediaUrl(ok)).toBe(ok)
    expect(safeSignedMediaUrl(`${ORIGIN}/storage/v1/object/public/message-media/u1/a.jpg`)).toBeNull()
    expect(safeSignedMediaUrl(`${ORIGIN}/storage/v1/object/sign/avatars/u1/a.jpg?token=abc`)).toBeNull()
    expect(safeSignedMediaUrl(`${ORIGIN}/storage/v1/object/sign/message-media/../avatars/u1/a.jpg?token=abc`)).toBeNull()
    expect(safeSignedMediaUrl("https://evil.test/storage/v1/object/sign/message-media/u1/a.jpg?token=abc")).toBeNull()
    expect(safeSignedMediaUrl("javascript:alert(1)")).toBeNull()
    expect(safeSignedMediaUrl("/relatif/a.jpg")).toBeNull()
    expect(safeSignedMediaUrl(null)).toBeNull()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(safeSignedMediaUrl(ok)).toBeNull()
  })

  it("valide les coordonnées", () => {
    expect(coordsValid(6.37, 2.39)).toBe(true)
    expect(coordsValid(-90, 180)).toBe(true)
    expect(coordsValid(91, 0)).toBe(false)
    expect(coordsValid(0, -181)).toBe(false)
    expect(coordsValid(NaN, 0)).toBe(false)
    expect(coordsValid("6", 2)).toBe(false)
  })
})

describe("toMessage, isPairRow, mergeMessages", () => {
  const raw = (over) => ({
    id: "m1",
    sender_id: ME,
    receiver_id: S1,
    content: "Bonjour",
    type: "text",
    media_url: null,
    location_lat: null,
    location_lng: null,
    read: true,
    created_at: "2026-10-13T08:00:00Z",
    ...over,
  })

  it("réduit une ligne à ce que la vue affiche, sans identifiant de personne", () => {
    const m = toMessage(raw(), ME)
    expect(m).toEqual({ id: "m1", mine: true, type: "text", content: "Bonjour", mediaPath: null, mediaUrl: null, lat: null, lng: null, createdAt: "2026-10-13T08:00:00Z", read: true })
    expect(toMessage(raw({ sender_id: S1, receiver_id: ME }), ME).mine).toBe(false)
  })

  it("ignore l'adresse d'un média hors compartiment et les coordonnées invalides", () => {
    expect(toMessage(raw({ type: "image", media_url: "https://evil.test/p.png" }), ME).mediaUrl).toBeNull()
    const good = `${ORIGIN}/storage/v1/object/public/message-media/${ME}/p.png`
    const signed = `${ORIGIN}/storage/v1/object/sign/message-media/${ME}/p.png?token=t`
    // Sans table de signatures : le chemin est connu, jamais l'adresse brute.
    expect(toMessage(raw({ type: "image", media_url: good }), ME)).toMatchObject({ mediaPath: `${ME}/p.png`, mediaUrl: null })
    expect(toMessage(raw({ type: "image", media_url: good }), ME, { [`${ME}/p.png`]: signed })).toMatchObject({
      mediaPath: `${ME}/p.png`,
      mediaUrl: signed,
    })
    // Une adresse non signée ou externe dans la table n'est jamais affichée.
    expect(toMessage(raw({ type: "image", media_url: good }), ME, { [`${ME}/p.png`]: good }).mediaUrl).toBeNull()
    expect(toMessage(raw({ type: "image", media_url: good, sender_id: S1, receiver_id: ME }), ME)).toMatchObject({ mediaPath: null })
    expect(toMessage(raw({ type: "text", media_url: good }), ME)).toMatchObject({ mediaPath: null, mediaUrl: null })
    expect(toMessage(raw({ type: "location", location_lat: 200, location_lng: 1 }), ME)).toMatchObject({ lat: null, lng: null })
    expect(toMessage(raw({ type: "location", location_lat: 6.4, location_lng: 2.4 }), ME)).toMatchObject({ lat: 6.4, lng: 2.4 })
    expect(toMessage(raw({ type: "inconnu" }), ME).type).toBe("text")
    expect(toMessage({ id: 1 }, ME)).toBeNull()
    expect(toMessage(null, ME)).toBeNull()
  })

  it("reconnaît les lignes de la paire dans les deux sens, jamais celles d'un tiers", () => {
    expect(isPairRow({ sender_id: ME, receiver_id: S1 }, ME, S1)).toBe(true)
    expect(isPairRow({ sender_id: S1, receiver_id: ME }, ME, S1)).toBe(true)
    expect(isPairRow({ sender_id: S2, receiver_id: ME }, ME, S1)).toBe(false)
    expect(isPairRow({ sender_id: S1, receiver_id: S2 }, ME, S1)).toBe(false)
    expect(isPairRow(null, ME, S1)).toBe(false)
  })

  it("fusionne sans doublon d'identifiant et trie du plus ancien au plus récent", () => {
    const a = { id: "a", createdAt: "2026-10-13T08:00:00Z" }
    const b = { id: "b", createdAt: "2026-10-13T09:00:00Z" }
    expect(mergeMessages([b], [a, b]).map((m) => m.id)).toEqual(["a", "b"])
    expect(mergeMessages([], [])).toEqual([])
  })
})

describe("horodatages au fuseau du Bénin (UTC+1)", () => {
  const now = new Date("2026-10-13T12:00:00Z")

  it("affiche l'heure locale", () => {
    expect(formatClock("2026-10-13T09:48:00Z")).toBe("10:48")
    expect(formatClock("2026-10-13T23:30:00Z")).toBe("00:30")
    expect(formatClock("pas une date")).toBe("")
  })

  it("choisit le libellé de la liste : heure, Hier, date", () => {
    expect(formatListTime("2026-10-13T09:48:00Z", now)).toBe("10:48")
    expect(formatListTime("2026-10-12T15:00:00Z", now)).toBe("Hier")
    expect(formatListTime("2026-10-06T15:00:00Z", now)).toBe("6 oct.")
    expect(formatListTime(undefined, now)).toBe("")
  })

  it("compte les jours à minuit heure du Bénin, pas à minuit UTC", () => {
    // 23:30 UTC le 12 = 00:30 le 13 au Bénin : c'est déjà aujourd'hui.
    expect(formatListTime("2026-10-12T23:30:00Z", now)).toBe("00:30")
    expect(dayOf("2026-10-12T23:30:00Z")).toBe("2026-10-13")
  })

  it("libelle les séparateurs de jour", () => {
    expect(formatDayLabel("2026-10-13T09:00:00Z", now)).toBe("Aujourd'hui")
    expect(formatDayLabel("2026-10-12T09:00:00Z", now)).toBe("Hier")
    expect(formatDayLabel("2026-10-08T09:00:00Z", now)).toBe("jeudi 8 octobre")
    expect(formatDayLabel("x", now)).toBe("")
  })
})

describe("createMediaRefresher", () => {
  const make = (results) => {
    const applied = []
    const fetchUrl = vi.fn(async () => results.shift() ?? null)
    const refresh = createMediaRefresher({ fetchUrl, onUrl: (id, url) => applied.push([id, url]) })
    return { refresh, fetchUrl, applied }
  }

  it("re-signe une fois puis déclare le média indisponible, sans nouvel appel", async () => {
    const { refresh, fetchUrl, applied } = make(["https://x/new"])
    await refresh("m1")
    expect(applied).toEqual([["m1", "https://x/new"]])
    await refresh("m1")
    await refresh("m1")
    expect(fetchUrl).toHaveBeenCalledTimes(1)
    expect(applied.slice(1)).toEqual([["m1", null], ["m1", null]])
  })

  it("une signature vide donne null tout de suite", async () => {
    const { refresh, applied } = make([null])
    await refresh("m1")
    expect(applied).toEqual([["m1", null]])
  })

  it("ignore les erreurs simultanées pendant une signature en cours", async () => {
    const { refresh, fetchUrl, applied } = make(["https://x/new"])
    await Promise.all([refresh("m1"), refresh("m1")])
    expect(fetchUrl).toHaveBeenCalledTimes(1)
    expect(applied).toEqual([["m1", "https://x/new"]])
  })

  it("compte séparément chaque message", async () => {
    const { refresh, fetchUrl } = make(["a", "b"])
    await refresh("m1")
    await refresh("m2")
    expect(fetchUrl).toHaveBeenCalledTimes(2)
  })

  it("ignore un identifiant invalide", async () => {
    const { refresh, fetchUrl, applied } = make([])
    await refresh(undefined)
    expect(fetchUrl).not.toHaveBeenCalled()
    expect(applied).toEqual([])
  })
})
