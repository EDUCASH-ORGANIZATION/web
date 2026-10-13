// QA indépendante RD-CLIENT-01, vague 4 : abus de la messagerie client (message.actions.js).
// requireRole et getServerRole sont RÉELS ; seul Supabase est simulé (tables en mémoire, filtres évalués).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { makeFakeSupabase } from "./fixtures/fake-supabase.js"

const ORIGIN = "https://example.supabase.co"
const CLIENT = "00000000-0000-4000-8000-000000000001"
const OTHER_CLIENT = "00000000-0000-4000-8000-000000000002"
const M1 = "11111111-1111-4111-8111-111111111111"
const M2 = "11111111-1111-4111-8111-111111111112"
const M_OTHER = "11111111-1111-4111-8111-111111111119"
const M_DONE = "11111111-1111-4111-8111-11111111111a"
const S1 = "22222222-2222-4222-8222-222222222221"
const S2 = "22222222-2222-4222-8222-222222222222"
const STRANGER = "22222222-2222-4222-8222-222222222229"

const ctx = { db: {}, log: [], failures: {}, user: null, origin: ORIGIN, delay: null }
vi.mock("@/lib/supabase/server", async () => {
  const { makeFakeSupabase: make } = await import("./fixtures/fake-supabase.js")
  return { createClient: async () => make(ctx) }
})

const { getClientConversations, getClientConversation, sendClientMessage, markClientConversationRead } = await import(
  "@/lib/actions/message.actions"
)
const { Bubble } = await import("@/components/client-space/messages/bubble")

const msg = (over) => ({
  id: "x", mission_id: M1, sender_id: S1, receiver_id: CLIENT, content: "Bonjour", type: "text",
  media_url: null, location_lat: null, location_lng: null, read: false, created_at: "2026-10-13T08:00:00Z", ...over,
})

function seed(role = "client", suspended = false) {
  ctx.user = { id: CLIENT, user_metadata: { role: "client" } }
  ctx.log = []
  ctx.failures = {}
  ctx.delay = null
  ctx.db = {
    profiles: [
      { user_id: CLIENT, role, full_name: "Rosine Adjovi", city: "Cotonou", is_suspended: suspended },
      { user_id: S1, role: "student", full_name: "Awa Kouassi", avatar_url: null },
      { user_id: S2, role: "student", full_name: "Sèna Agossou", avatar_url: null },
      { user_id: STRANGER, role: "student", full_name: "Intrus Inconnu", avatar_url: null },
    ],
    missions: [
      { id: M1, client_id: CLIENT, title: "Traduire un flyer", status: "open", selected_student_id: null },
      { id: M2, client_id: CLIENT, title: "Cours de maths", status: "in_progress", selected_student_id: S2 },
      { id: M_DONE, client_id: CLIENT, title: "Terminée", status: "done", selected_student_id: S2 },
      { id: M_OTHER, client_id: OTHER_CLIENT, title: "Autre client", status: "open", selected_student_id: null },
    ],
    applications: [
      { mission_id: M1, student_id: S1, status: "pending" },
      { mission_id: M1, student_id: S2, status: "pending" },
      { mission_id: M2, student_id: S2, status: "accepted" },
      { mission_id: M_DONE, student_id: S2, status: "accepted" },
      { mission_id: M_OTHER, student_id: S1, status: "pending" },
    ],
    messages: [
      msg({ id: "s1-a", sender_id: S1, content: "S1 premier", created_at: "2026-10-13T08:00:00Z" }),
      msg({ id: "s1-b", sender_id: CLIENT, receiver_id: S1, content: "Réponse à S1", read: true, created_at: "2026-10-13T08:05:00Z" }),
      msg({ id: "s2-a", sender_id: S2, content: "S2 premier", created_at: "2026-10-13T09:00:00Z" }),
      msg({ id: "s2-b", sender_id: S2, content: "S2 second", created_at: "2026-10-13T09:10:00Z" }),
      msg({ id: "s2-m2", mission_id: M2, sender_id: S2, content: "S2 autre mission", created_at: "2026-10-13T07:00:00Z" }),
      msg({ id: "stranger", sender_id: STRANGER, content: "Spam", created_at: "2026-10-13T11:00:00Z" }),
      msg({ id: "other-client", mission_id: M_OTHER, sender_id: S1, content: "Autre client", created_at: "2026-10-13T11:30:00Z" }),
      // Conversation entre deux étudiants, sans le client : ne doit jamais apparaître.
      msg({ id: "s1-s2", sender_id: S1, receiver_id: S2, content: "Entre étudiants", created_at: "2026-10-13T12:00:00Z" }),
    ],
  }
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN)
  seed()
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const dataQueries = () => log().filter((q) => q.table !== "profiles")
const log = () => ctx.log
const inserted = () => ctx.db.messages.filter((m) => m.id.startsWith("new-"))
const send = (over) => sendClientMessage({ missionId: M1, studentId: S1, type: "text", content: "Bonjour", ...over })

const callers = {
  inbox: () => getClientConversations(),
  conversation: () => getClientConversation({ missionId: M1, studentId: S1 }),
  send: () => send(),
  markRead: () => markClientConversationRead({ missionId: M1, studentId: S1 }),
}

describe("rôle et session : refus avant toute lecture de données", () => {
  const denials = {
    "sans session": () => { ctx.user = null },
    "étudiant": () => seed("student"),
    "admin": () => seed("admin"),
    "client suspendu": () => seed("client", true),
    "rôle inconnu": () => seed("root"),
    "profil absent": () => { ctx.db.profiles = ctx.db.profiles.filter((p) => p.user_id !== CLIENT) },
    "lecture du profil en erreur": () => { ctx.failures["profiles.select"] = "boom" },
  }
  for (const [dn, setup] of Object.entries(denials)) {
    for (const [cn, call] of Object.entries(callers)) {
      it(`${cn} : ${dn}`, async () => {
        setup()
        const out = await call()
        expect(out.error).toBeTruthy()
        expect(out.error).not.toMatch(/boom|select|supabase/i)
        expect(dataQueries()).toEqual([])
        expect(ctx.db.messages.filter((m) => m.id.startsWith("new-"))).toEqual([])
      })
    }
  }
})

describe("mission d'un autre client, étudiant sans candidature", () => {
  it("lecture : notFound, aucune requête sur messages", async () => {
    expect(await getClientConversation({ missionId: M_OTHER, studentId: S1 })).toEqual({ notFound: true })
    expect(log().some((q) => q.table === "messages")).toBe(false)
  })
  it("lecture d'un étudiant sans candidature : notFound, aucune requête sur messages", async () => {
    expect(await getClientConversation({ missionId: M1, studentId: STRANGER })).toEqual({ notFound: true })
    expect(log().some((q) => q.table === "messages")).toBe(false)
  })
  it("envoi : refus neutre et aucune insertion (mission étrangère, étudiant sans candidature, candidat d'une autre mission)", async () => {
    for (const input of [
      { missionId: M_OTHER, studentId: S1 },
      { missionId: M1, studentId: STRANGER },
      { missionId: M2, studentId: S1 }, // S1 n'a pas postulé à M2
    ]) {
      const out = await send(input)
      expect(out).toEqual({ error: "Cette conversation n'est pas disponible." })
    }
    expect(inserted()).toEqual([])
  })
  it("marquer comme lu : refus, aucun update", async () => {
    for (const input of [{ missionId: M_OTHER, studentId: S1 }, { missionId: M1, studentId: STRANGER }]) {
      expect(await markClientConversationRead(input)).toEqual({ error: "Cette conversation n'est pas disponible." })
    }
    expect(log().some((q) => q.op === "update")).toBe(false)
    expect(ctx.db.messages.find((m) => m.id === "stranger").read).toBe(false)
  })
  it("messagerie en lecture seule (mission terminée) : envoi refusé", async () => {
    expect(await send({ missionId: M_DONE, studentId: S2 })).toEqual({ error: "Cette conversation est en lecture seule." })
    expect(inserted()).toEqual([])
  })
  it("l'étudiant retenu d'une mission en cours peut écrire, un candidat non retenu non", async () => {
    expect(await send({ missionId: M2, studentId: S2 })).toMatchObject({ success: true })
    ctx.db.applications.push({ mission_id: M2, student_id: S1, status: "pending" })
    expect(await send({ missionId: M2, studentId: S1 })).toEqual({ error: "Cette conversation est en lecture seule." })
  })
})

describe("identifiants forgés dans l'entrée", () => {
  it("receiver_id, sender_id, read, id, created_at forgés : ignorés, expéditeur = session, destinataire = paire", async () => {
    const out = await send({
      receiver_id: STRANGER, sender_id: OTHER_CLIENT, receiverId: STRANGER, senderId: OTHER_CLIENT,
      read: true, id: "forged", created_at: "1999-01-01T00:00:00Z", client_id: OTHER_CLIENT,
    })
    expect(out.success).toBe(true)
    const [row] = inserted()
    expect(row.sender_id).toBe(CLIENT)
    expect(row.receiver_id).toBe(S1)
    expect(row.read).toBe(false)
    expect(row.id).not.toBe("forged")
    expect(row.created_at).not.toBe("1999-01-01T00:00:00Z")
    expect(Object.keys(row).sort()).toEqual(
      ["content", "created_at", "id", "location_lat", "location_lng", "media_url", "mission_id", "read", "receiver_id", "sender_id", "type"].sort(),
    )
    expect(JSON.stringify(out)).not.toContain(S1)
    expect(JSON.stringify(out)).not.toContain(CLIENT)
  })
  it("entrée absente, null, tableau ou chaîne : refus sans exception ni insertion", async () => {
    for (const bad of [undefined, null, [], "texte", 42]) {
      expect(await sendClientMessage(bad)).toEqual({ error: "Votre message n'est pas valide. Vérifiez son contenu et sa longueur." })
    }
    expect(inserted()).toEqual([])
  })
  it("studentId forgé = le client lui-même : refusé (aucune candidature)", async () => {
    expect(await send({ studentId: CLIENT })).toEqual({ error: "Cette conversation n'est pas disponible." })
    expect(inserted()).toEqual([])
  })
})

describe("deux candidats d'une même mission : jamais mélangés", () => {
  it("lecture : chaque conversation ne contient que les messages de sa paire", async () => {
    const a = await getClientConversation({ missionId: M1, studentId: S1 })
    const b = await getClientConversation({ missionId: M1, studentId: S2 })
    expect(a.conversation.messages.map((m) => m.id)).toEqual(["s1-a", "s1-b"])
    expect(b.conversation.messages.map((m) => m.id)).toEqual(["s2-a", "s2-b"])
    const all = JSON.stringify([a, b])
    for (const leaked of ["Spam", "Autre client", "Entre étudiants", "S2 autre mission"]) expect(all).not.toContain(leaked)
  })
  it("boîte de réception : deux lignes distinctes, compteurs séparés, ni inconnu, ni autre client, ni conversation entre étudiants", async () => {
    const { conversations } = await getClientConversations()
    const byStudent = Object.fromEntries(conversations.filter((c) => c.missionId === M1).map((c) => [c.studentId, c]))
    expect(Object.keys(byStudent).sort()).toEqual([S1, S2])
    expect(byStudent[S1].unreadCount).toBe(1)
    expect(byStudent[S2].unreadCount).toBe(2)
    expect(conversations.some((c) => c.studentId === STRANGER)).toBe(false)
    expect(conversations.some((c) => c.missionId === M_OTHER)).toBe(false)
    expect(conversations.map((c) => c.key).length).toBe(new Set(conversations.map((c) => c.key)).size)
  })
  it("marquer comme lu pour S1 ne touche ni S2, ni l'autre mission, ni l'inconnu, ni les messages envoyés", async () => {
    const before = JSON.stringify(ctx.db.messages)
    expect(await markClientConversationRead({ missionId: M1, studentId: S1 })).toEqual({ success: true })
    const read = (id) => ctx.db.messages.find((m) => m.id === id).read
    expect(read("s1-a")).toBe(true)
    for (const id of ["s2-a", "s2-b", "s2-m2", "stranger", "other-client", "s1-s2"]) expect(read(id)).toBe(false)
    const after = ctx.db.messages.filter((m) => m.id !== "s1-a")
    expect(JSON.stringify(after)).toBe(JSON.stringify(JSON.parse(before).filter((m) => m.id !== "s1-a")))
  })
  it("marquer comme lu ignore receiverId / senderId forgés dans l'entrée", async () => {
    await markClientConversationRead({ missionId: M1, studentId: S1, receiverId: STRANGER, senderId: S2, read: false })
    expect(ctx.db.messages.find((m) => m.id === "s2-a").read).toBe(false)
    expect(ctx.db.messages.find((m) => m.id === "s1-a").read).toBe(true)
  })
  it("la requête de lecture filtre bien sur la mission ET la paire (pas de fuite si la base renvoyait trop)", async () => {
    await getClientConversation({ missionId: M1, studentId: S1 })
    const q = log().find((x) => x.table === "messages")
    expect(q.filters).toContainEqual(["eq", "mission_id", M1])
    expect(q.ors).toEqual([`and(sender_id.eq.${CLIENT},receiver_id.eq.${S1}),and(sender_id.eq.${S1},receiver_id.eq.${CLIENT})`])
  })
})

describe("media_path : dossier de l'expéditeur, traversée, autre utilisateur, type", () => {
  const BAD_PATHS = {
    "dossier d'un autre utilisateur": `${OTHER_CLIENT}/a.png`,
    "dossier d'un étudiant": `${S1}/a.png`,
    "traversée vers un autre dossier": `${CLIENT}/../${OTHER_CLIENT}/a.png`,
    "traversée encodée": `${CLIENT}/..%2f${OTHER_CLIENT}%2fa.png`,
    "point-point seul": `${CLIENT}/../a.png`,
    "double barre": `${CLIENT}//a.png`,
    "barre initiale": `/${CLIENT}/a.png`,
    "antislash": `${CLIENT}\\..\\a.png`,
    "préfixe collé sans barre": `${CLIENT}x/a.png`,
    "dossier seul": `${CLIENT}/`,
    "sans extension": `${CLIENT}/fichier`,
    "extension exécutable": `${CLIENT}/a.exe`,
    "double extension déguisée": `${CLIENT}/a.png.exe`,
    "extension svg (XSS)": `${CLIENT}/a.svg`,
    "extension html": `${CLIENT}/a.html`,
    "octet nul": `${CLIENT}/a.png\u0000.exe`,
    "requête dans le chemin": `${CLIENT}/a.png?x=1`,
    "fragment": `${CLIENT}/a.png#x`,
    "schéma javascript": "javascript:alert(1)",
    "schéma data": "data:image/png;base64,AAAA",
    "schéma file": "file:///etc/passwd.png",
    "URL externe": "https://evil.example/storage/v1/object/public/message-media/" + CLIENT + "/a.png",
    "URL du projet, dossier d'un autre": `${ORIGIN}/storage/v1/object/public/message-media/${OTHER_CLIENT}/a.png`,
    "URL du projet, autre compartiment": `${ORIGIN}/storage/v1/object/public/avatars/${CLIENT}/a.png`,
    "URL du projet, traversée vers un autre compartiment": `${ORIGIN}/storage/v1/object/public/message-media/../avatars/${CLIENT}/a.png`,
    "URL à identifiants (hôte maquillé)": `https://example.supabase.co@evil.example/storage/v1/object/public/message-media/${CLIENT}/a.png`,
    "URL sous-domaine piège": `https://example.supabase.co.evil.example/storage/v1/object/public/message-media/${CLIENT}/a.png`,
    "trop long (> 300)": `${CLIENT}/${"a".repeat(300)}.png`,
    "nombre": 12345,
    "objet": { path: `${CLIENT}/a.png` },
    "tableau": [`${CLIENT}/a.png`],
  }
  for (const [name, path] of Object.entries(BAD_PATHS)) {
    it(`refus : ${name}`, async () => {
      const out = await send({ type: "image", content: undefined, mediaPath: path })
      expect(out.error).toBeTruthy()
      expect(out).not.toHaveProperty("success")
      expect(inserted()).toEqual([])
      expect(out.error).not.toContain(OTHER_CLIENT)
    })
  }
  it("type incohérent : image déclarée avec une extension audio, et inversement", async () => {
    expect((await send({ type: "image", mediaPath: `${CLIENT}/a.mp3` })).error).toBeTruthy()
    expect((await send({ type: "voice", mediaPath: `${CLIENT}/a.png` })).error).toBeTruthy()
    expect(inserted()).toEqual([])
  })
  it("image ou vocal sans mediaPath : refus", async () => {
    expect((await send({ type: "image" })).error).toBeTruthy()
    expect((await send({ type: "voice", mediaPath: "" })).error).toBeTruthy()
    expect(inserted()).toEqual([])
  })
  it("chemin valide : l'adresse stockée est reconstruite par le serveur, jamais reprise de l'entrée", async () => {
    const out = await send({ type: "image", mediaPath: `${CLIENT}/photo.PNG`, mediaUrl: "https://evil.example/x.png", media_url: "https://evil.example/y.png" })
    expect(out.success).toBe(true)
    expect(inserted()[0].media_url).toBe(`${ORIGIN}/storage/v1/object/public/message-media/${CLIENT}/photo.PNG`)
    expect(out.message.mediaUrl).toBe(inserted()[0].media_url)
  })
  it("le contrôle du chemin précède la lecture de la mission : un chemin hostile ne coûte aucune requête", async () => {
    await send({ type: "image", mediaPath: `${OTHER_CLIENT}/a.png` })
    expect(dataQueries()).toEqual([])
  })
})

describe("URL de média en lecture", () => {
  const readMedia = async (url, type = "image") => {
    ctx.db.messages = [msg({ id: "m-media", type, media_url: url, content: "Image", created_at: "2026-10-13T08:00:00Z" })]
    const out = await getClientConversation({ missionId: M1, studentId: S1 })
    return out.conversation.messages[0]
  }
  const good = `${ORIGIN}/storage/v1/object/public/message-media/${S1}/a.png`
  it("l'adresse du compartiment du projet est conservée (sans paramètres)", async () => {
    expect((await readMedia(`${good}?token=abc`)).mediaUrl).toBe(good)
  })
  const hostile = {
    "domaine externe": "https://evil.example/a.png",
    "http externe": "http://evil.example/a.png",
    "javascript": "javascript:alert(1)",
    "data": "data:image/svg+xml,<svg onload=alert(1)>",
    "autre compartiment": `${ORIGIN}/storage/v1/object/public/avatars/${S1}/a.png`,
    "traversée": `${ORIGIN}/storage/v1/object/public/message-media/../avatars/a.png`,
    "traversée encodée": `${ORIGIN}/storage/v1/object/public/message-media/%2e%2e/avatars/a.png`,
    "hôte maquillé par identifiants": `https://example.supabase.co@evil.example/storage/v1/object/public/message-media/a.png`,
    "sous-domaine piège": `https://example.supabase.co.evil.example/storage/v1/object/public/message-media/a.png`,
    "protocole relatif": `//evil.example/storage/v1/object/public/message-media/a.png`,
    "URL signée (pas publique)": `${ORIGIN}/storage/v1/object/sign/message-media/${S1}/a.png?token=t`,
    "chaîne vide": "",
    "nombre": 12,
  }
  for (const [name, url] of Object.entries(hostile)) {
    it(`ignorée : ${name}`, async () => {
      const m = await readMedia(url)
      expect(m.mediaUrl).toBeNull()
      const html = renderToStaticMarkup(<Bubble message={m} senderName="Awa K." />)
      expect(html).not.toContain("evil.example")
      expect(html).not.toContain("javascript:")
      expect(html).not.toMatch(/<img|<audio/)
    })
  }
  it("un message texte ne porte jamais d'URL de média même si la ligne en contient une", async () => {
    const m = await readMedia(good, "text")
    expect(m.mediaUrl).toBeNull()
  })
  it("position hors bornes ou NaN : aucune coordonnée, aucun lien", async () => {
    for (const [lat, lng] of [[91, 0], [0, 181], [NaN, 2], ["6.3", "2.4"], [null, null]]) {
      ctx.db.messages = [msg({ id: "loc", type: "location", location_lat: lat, location_lng: lng })]
      const m = (await getClientConversation({ missionId: M1, studentId: S1 })).conversation.messages[0]
      expect(m.lat).toBeNull()
      expect(renderToStaticMarkup(<Bubble message={m} senderName="A" />)).not.toContain("openstreetmap")
    }
  })
})

describe("UUID mal formés et caractères de filtre PostgREST", () => {
  const BAD_IDS = [
    `${S1},sender_id.neq.x`,
    `${S1}.eq.x`,
    `${S1})or(sender_id.eq.${OTHER_CLIENT}`,
    `${S1}\n`,
    ` ${S1}`,
    `${S1}%2c`,
    "x,y.z(w)",
    "*",
    "",
    null,
    undefined,
    12,
    {},
    [S1],
  ]
  const noInterpolation = () => {
    const forbidden = (s) => typeof s === "string" && /[^0-9a-f.,()a-z_-]/i.test(s)
    for (const q of ctx.log) {
      for (const expr of q.ors) {
        // les expressions or ne contiennent que des UUID de la session et de la paire légitime
        const uuids = expr.match(/[0-9a-f-]{36}/g) ?? []
        for (const u of uuids) expect([CLIENT, S1, S2, STRANGER]).toContain(u)
        expect(forbidden(expr)).toBe(false)
      }
    }
  }
  it.each(BAD_IDS.map((v, i) => [i, v]))("studentId #%i mal formé : refusé partout, aucune requête n'interpole la valeur", async (_i, bad) => {
    expect(await getClientConversation({ missionId: M1, studentId: bad })).toEqual(
      bad === undefined ? { notFound: true } : { notFound: true },
    )
    expect(await send({ studentId: bad })).toHaveProperty("error")
    expect(await markClientConversationRead({ missionId: M1, studentId: bad })).toHaveProperty("error")
    expect(inserted()).toEqual([])
    expect(log().some((q) => q.table === "messages")).toBe(false)
    expect(log().some((q) => q.ors.length > 0)).toBe(false)
    expect(JSON.stringify(log())).not.toContain("neq")
    noInterpolation()
  })
  it.each(BAD_IDS.map((v, i) => [i, v]))("missionId #%i mal formé : refusé sans aucune requête de données", async (_i, bad) => {
    expect(await getClientConversation({ missionId: bad, studentId: S1 })).toEqual({ notFound: true })
    expect(await send({ missionId: bad })).toHaveProperty("error")
    expect(await markClientConversationRead({ missionId: bad, studentId: S1 })).toHaveProperty("error")
    expect(dataQueries()).toEqual([])
    expect(inserted()).toEqual([])
  })
  it("UUID bien formé en majuscules : traité comme une valeur, jamais comme un filtre (aucune paire trouvée)", async () => {
    const out = await getClientConversation({ missionId: M1, studentId: "ABCDEFAB-1111-4111-8111-ABCDEFABCDEF" })
    expect(out).toEqual({ notFound: true })
    noInterpolation()
  })
  it("sans studentId, l'interlocuteur est le retenu : l'expression or n'utilise que des UUID connus", async () => {
    await getClientConversation({ missionId: M2 })
    noInterpolation()
    expect(log().find((q) => q.ors.length)?.ors[0]).toContain(S2)
  })
})

describe("contenu du texte", () => {
  it("HTML et liens : stockés tels quels, affichés en texte échappé (aucun lien, aucune balise)", async () => {
    const hostile = `<script>alert(1)</script><img src=x onerror=alert(1)> <a href="javascript:alert(1)">cliquer</a> https://evil.example`
    const out = await send({ content: hostile })
    expect(out.success).toBe(true)
    const html = renderToStaticMarkup(<Bubble message={out.message} senderName="Rosine" />)
    expect(html).not.toContain("<script")
    expect(html).not.toContain("<img")
    expect(html).not.toMatch(/<a[\s>]/)
    expect(html).toContain("&lt;script&gt;")
  })
  it("2000 caractères acceptés, 2001 refusés", async () => {
    expect((await send({ content: "a".repeat(2000) })).success).toBe(true)
    expect(await send({ content: "a".repeat(2001) })).toEqual({ error: "Votre message n'est pas valide. Vérifiez son contenu et sa longueur." })
    expect(inserted()).toHaveLength(1)
  })
  it("2001 caractères dont des espaces de fin : refusé (la limite s'applique avant le rognage)", async () => {
    expect((await send({ content: "a".repeat(1999) + "  " })).error).toBeTruthy()
  })
  it("texte vide, espaces, retour chariot seul, caractères de contrôle, octet nul : refusés", async () => {
    for (const c of ["", "   ", "\n\n", "\u0000", "a\u0000b", "a\u0007b", "a\u001bb", "a\u007fb"]) {
      expect((await send({ content: c })).error, JSON.stringify(c)).toBeTruthy()
    }
    expect(inserted()).toEqual([])
  })
  it("contenu non texte (objet, nombre, tableau) : refusé", async () => {
    for (const c of [{ a: 1 }, 12, ["a"], true]) expect((await send({ content: c })).error).toBeTruthy()
  })
  it("type inconnu ou __proto__ : refusé", async () => {
    for (const type of ["file", "TEXT", "", null, "__proto__"]) expect((await send({ type })).error).toBeTruthy()
  })
  it("position : coordonnées hors bornes, NaN, Infinity, chaînes refusées ; texte libre ignoré et remplacé par le libellé serveur", async () => {
    for (const [lat, lng] of [[91, 0], [0, -181], [NaN, 0], [Infinity, 0], ["6", "2"], [undefined, undefined]]) {
      expect((await send({ type: "location", lat, lng })).error, `${lat},${lng}`).toBeTruthy()
    }
    const ok = await send({ type: "location", lat: 6.37, lng: 2.39, content: "<b>autre</b>" })
    expect(ok.success).toBe(true)
    expect(inserted()[0].content).toBe("Position partagée")
  })
  it("des coordonnées restent nulles sur un message texte même si elles sont fournies", async () => {
    await send({ lat: 6, lng: 2 })
    expect(inserted()[0]).toMatchObject({ location_lat: null, location_lng: null, media_url: null })
  })
})

describe("débit : 20 messages par minute", () => {
  it("rafale séquentielle de 25 : 20 acceptés, 5 refusés, rien d'inséré au-delà", async () => {
    const results = []
    for (let i = 0; i < 25; i += 1) results.push(await send({ content: `m${i}` }))
    expect(results.filter((r) => r.success)).toHaveLength(20)
    const refused = results.filter((r) => r.error)
    expect(refused).toHaveLength(5)
    for (const r of refused) expect(r.error).toMatch(/trop vite/)
    expect(inserted()).toHaveLength(20)
  })
  it("les messages de plus d'une minute ne comptent pas, ceux de n'importe quel destinataire comptent", async () => {
    const old = new Date(Date.now() - 120_000).toISOString()
    const recent = new Date(Date.now() - 5_000).toISOString()
    ctx.db.messages = [
      ...Array.from({ length: 30 }, (_, i) => msg({ id: `old${i}`, sender_id: CLIENT, receiver_id: S1, created_at: old })),
      ...Array.from({ length: 19 }, (_, i) => msg({ id: `rec${i}`, sender_id: CLIENT, receiver_id: S2, created_at: recent })),
    ]
    expect((await send()).success).toBe(true)
    expect((await send()).error).toMatch(/trop vite/)
  })
  it("le débit d'un autre client n'affecte pas celui-ci", async () => {
    const recent = new Date(Date.now() - 1_000).toISOString()
    ctx.db.messages = Array.from({ length: 40 }, (_, i) => msg({ id: `o${i}`, sender_id: OTHER_CLIENT, receiver_id: S1, created_at: recent }))
    expect((await send()).success).toBe(true)
  })
  it("erreur de comptage : refus neutre, pas d'insertion (fail-closed)", async () => {
    ctx.failures["messages.select"] = "boom compteur"
    const out = await send()
    expect(out.error).toBeTruthy()
    expect(out.error).not.toMatch(/boom/)
    expect(inserted()).toEqual([])
  })
  it("refus de débit avant une mauvaise paire : l'erreur de paire prime et rien n'est compté", async () => {
    expect((await send({ studentId: STRANGER })).error).toBe("Cette conversation n'est pas disponible.")
    expect(log().some((q) => q.head)).toBe(false)
  })
  // CONSTAT (défaut réel, pas un test à désactiver) : le contrôle de débit est « lire le compte puis insérer » sans
  // verrou ni contrainte en base. 30 envois SIMULTANÉS lisent tous un compte de 0 et passent tous. Le commentaire
  // de l'action annonce un débit « compté en base (valable entre instances) », vrai pour des envois successifs
  // seulement. Quand un verrou (RPC atomique ou politique) sera ajouté, l'inversion de ce test est ATTENDUE.
  it("CONSTAT : une rafale simultanée de 30 envois dépasse la limite de 20 (course lecture puis insertion)", async () => {
    ctx.delay = () => new Promise((r) => setTimeout(r, 1))
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => send({ content: `c${i}` })))
    const accepted = results.filter((r) => r.success).length
    expect(accepted).toBeGreaterThan(20)
  })
})

describe("lecture : colonnes et limites", () => {
  it("aucune requête sur profiles ne sélectionne de colonne privée ni *", async () => {
    await getClientConversations()
    await getClientConversation({ missionId: M1, studentId: S1 })
    const reads = log().filter((q) => q.table === "profiles" && q.columns && !/\brole\b/.test(q.columns))
    expect(reads.length).toBeGreaterThan(0)
    for (const q of reads) {
      expect(q.columns).not.toContain("*")
      expect(q.columns).not.toMatch(/phone|email|card_url|balance|rejection/)
    }
  })
  it("la réponse ne contient ni sender_id ni receiver_id ni numéro de téléphone", async () => {
    ctx.db.profiles.find((p) => p.user_id === S1).phone = "+22997000000"
    const out = JSON.stringify(await getClientConversation({ missionId: M1, studentId: S1 }))
    expect(out).not.toMatch(/sender_id|receiver_id|\+229/)
  })
  it("erreur de lecture : message neutre sans texte SQL", async () => {
    ctx.failures["messages.select"] = 'relation "messages" does not exist'
    for (const out of [await getClientConversations(), await getClientConversation({ missionId: M1, studentId: S1 })]) {
      expect(out.error).toBeTruthy()
      expect(out.error).not.toMatch(/relation|exist/)
    }
  })
})
