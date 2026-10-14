import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))

import { requireRole } from "@/lib/auth/require-role"
import {
  getClientConversations,
  getClientConversation,
  sendClientMessage,
  markClientConversationRead,
  getStudentConversations,
  getStudentConversation,
  sendStudentMessage,
  markStudentConversationRead,
} from "./message.actions"

const CLIENT = "00000000-0000-4000-8000-000000000001"
const OTHER_CLIENT = "00000000-0000-4000-8000-000000000002"
const M1 = "11111111-1111-4111-8111-111111111111"
const M2 = "11111111-1111-4111-8111-111111111112"
const M_OTHER = "11111111-1111-4111-8111-111111111119"
const S1 = "22222222-2222-4222-8222-222222222221"
const S2 = "22222222-2222-4222-8222-222222222222"
const STRANGER = "22222222-2222-4222-8222-222222222229"
const ORIGIN = "https://example.supabase.co"

let db
let log
let failures

// ─── Faux client Supabase : tables en mémoire, filtres eq / in / gte / or évalués pour de bon ──────────────

function splitTop(text) {
  const parts = []
  let depth = 0
  let current = ""
  for (const c of text) {
    if (c === "(") depth += 1
    if (c === ")") depth -= 1
    if (c === "," && depth === 0) {
      parts.push(current)
      current = ""
    } else current += c
  }
  if (current) parts.push(current)
  return parts
}

function matchCondition(row, cond) {
  if (cond.startsWith("and(")) return splitTop(cond.slice(4, -1)).every((c) => matchCondition(row, c))
  const [col, op, ...rest] = cond.split(".")
  const value = rest.join(".")
  if (op !== "eq") throw new Error(`opérateur non géré : ${cond}`)
  return String(row[col]) === value
}

function makeSupabase() {
  return {
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `${ORIGIN}/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
    from: (table) => {
      const q = { table, op: "select", columns: null, filters: [], ors: [], payload: null, head: false, limit: null }
      log.push(q)
      const matches = () =>
        (db[table] ?? []).filter((row) => {
          for (const [kind, col, value] of q.filters) {
            if (kind === "eq" && row[col] !== value) return false
            if (kind === "in" && !value.includes(row[col])) return false
            if (kind === "gte" && !(row[col] >= value)) return false
          }
          return q.ors.every((expr) => splitTop(expr).some((cond) => matchCondition(row, cond)))
        })
      const run = (single) => {
        const failure = failures[`${table}.${q.op}`]
        if (failure) return Promise.resolve({ data: null, error: { message: failure }, count: null })
        if (q.op === "insert") {
          const row = { id: `msg-${(db[table] ?? []).length + 1}`, created_at: "2026-10-13T10:00:00Z", ...q.payload }
          db[table] = [...(db[table] ?? []), row]
          return Promise.resolve({ data: row, error: null })
        }
        if (q.op === "update") {
          const rows = matches()
          rows.forEach((row) => Object.assign(row, q.payload))
          return Promise.resolve({ data: null, error: null })
        }
        const rows = matches()
        if (q.head) return Promise.resolve({ data: null, error: null, count: rows.length })
        const data = q.limit ? rows.slice(0, q.limit) : rows
        return Promise.resolve({ data: single ? (data[0] ?? null) : data, error: null })
      }
      const b = {
        select: (columns, opts) => {
          q.columns = columns
          if (opts?.head) q.head = true
          return b
        },
        insert: (payload) => {
          q.op = "insert"
          q.payload = payload
          return b
        },
        update: (payload) => {
          q.op = "update"
          q.payload = payload
          return b
        },
        eq: (c, v) => (q.filters.push(["eq", c, v]), b),
        in: (c, v) => (q.filters.push(["in", c, v]), b),
        gte: (c, v) => (q.filters.push(["gte", c, v]), b),
        or: (expr) => (q.ors.push(expr), b),
        order: () => b,
        limit: (n) => ((q.limit = n), b),
        maybeSingle: () => run(true),
        single: () => run(true),
        then: (ok, ko) => run(false).then(ok, ko),
      }
      return b
    },
  }
}

const row = (over) => ({
  id: "x",
  mission_id: M1,
  sender_id: S1,
  receiver_id: CLIENT,
  content: "Bonjour",
  type: "text",
  media_url: null,
  location_lat: null,
  location_lng: null,
  read: false,
  created_at: "2026-10-13T08:00:00Z",
  ...over,
})

function seed() {
  db = {
    missions: [
      { id: M1, client_id: CLIENT, title: "Traduire un flyer", status: "open", selected_student_id: null },
      { id: M2, client_id: CLIENT, title: "Cours de maths", status: "in_progress", selected_student_id: S2 },
      { id: M_OTHER, client_id: OTHER_CLIENT, title: "Mission d'un autre", status: "open", selected_student_id: null },
    ],
    applications: [
      { mission_id: M1, student_id: S1, status: "pending" },
      { mission_id: M1, student_id: S2, status: "pending" },
      { mission_id: M2, student_id: S2, status: "accepted" },
      { mission_id: M_OTHER, student_id: S1, status: "pending" },
    ],
    profiles: [
      { user_id: S1, full_name: "Awa Kouassi", avatar_url: null },
      { user_id: S2, full_name: "Sèna Agossou", avatar_url: "https://example.supabase.co/storage/v1/object/public/avatars/s2/a.png" },
      { user_id: STRANGER, full_name: "Intrus Inconnu", avatar_url: null },
    ],
    messages: [
      row({ id: "a1", sender_id: S1, receiver_id: CLIENT, content: "Message de S1", created_at: "2026-10-13T08:00:00Z" }),
      row({ id: "a2", sender_id: CLIENT, receiver_id: S1, content: "Réponse à S1", created_at: "2026-10-13T08:05:00Z", read: true }),
      row({ id: "b1", sender_id: S2, receiver_id: CLIENT, content: "Message de S2 (candidat)", created_at: "2026-10-13T09:00:00Z" }),
      row({ id: "b2", sender_id: S2, receiver_id: CLIENT, content: "Deuxième de S2", created_at: "2026-10-13T09:10:00Z" }),
      row({ id: "c1", mission_id: M2, sender_id: S2, receiver_id: CLIENT, content: "Mission en cours S2", created_at: "2026-10-13T07:00:00Z" }),
      row({ id: "z1", sender_id: STRANGER, receiver_id: CLIENT, content: "Spam d'un inconnu", created_at: "2026-10-13T11:00:00Z" }),
      row({ id: "z2", mission_id: M_OTHER, sender_id: S1, receiver_id: CLIENT, content: "Autre mission", created_at: "2026-10-13T11:30:00Z" }),
    ],
  }
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN)
  log = []
  failures = {}
  seed()
  requireRole.mockResolvedValue({ supabase: makeSupabase(), user: { id: CLIENT }, role: "client", profile: {} })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const reads = (table) => log.filter((q) => q.table === table)

// ─── Rôle : première instruction de chaque export ───────────────────────────────────────────────────────────

describe("garde de rôle", () => {
  const calls = {
    getClientConversations: () => getClientConversations(),
    getClientConversation: () => getClientConversation({ missionId: M1, studentId: S1 }),
    sendClientMessage: () => sendClientMessage({ missionId: M1, studentId: S1, type: "text", content: "Bonjour" }),
    markClientConversationRead: () => markClientConversationRead({ missionId: M1, studentId: S1 }),
  }

  for (const [name, call] of Object.entries(calls)) {
    it(`${name} exige le rôle client et ne touche à aucune table quand l'accès est refusé`, async () => {
      requireRole.mockResolvedValueOnce({ error: "Vous n'avez pas les droits pour effectuer cette action." })
      const result = await call()
      expect(requireRole).toHaveBeenCalledWith(["client"])
      expect(result).toEqual({ error: "Vous n'avez pas les droits pour effectuer cette action." })
      expect(log).toEqual([])
    })
  }

  for (const [name, call] of Object.entries(calls)) {
    it(`${name} appelle requireRole avant tout accès aux données`, async () => {
      let readsBeforeRole = -1
      requireRole.mockImplementationOnce(async () => {
        readsBeforeRole = log.length
        return { supabase: makeSupabase(), user: { id: CLIENT }, role: "client", profile: {} }
      })
      await call()
      expect(readsBeforeRole).toBe(0)
    })
  }
})

// ─── Boîte de réception ─────────────────────────────────────────────────────────────────────────────────────

describe("getClientConversations", () => {
  it("donne deux conversations distinctes pour deux candidats d'une même mission", async () => {
    const { conversations } = await getClientConversations()
    const m1 = conversations.filter((c) => c.missionId === M1)
    expect(m1.map((c) => c.studentId).sort()).toEqual([S1, S2].sort())
    const s1 = m1.find((c) => c.studentId === S1)
    const s2 = m1.find((c) => c.studentId === S2)
    expect(s1.preview).toBe("Vous : Réponse à S1")
    expect(s1.unreadCount).toBe(1)
    expect(s2.preview).toBe("Deuxième de S2")
    expect(s2.unreadCount).toBe(2)
  })

  it("distingue aussi deux missions avec le même étudiant", async () => {
    const { conversations } = await getClientConversations()
    const forS2 = conversations.filter((c) => c.studentId === S2)
    expect(forS2.map((c) => c.missionId).sort()).toEqual([M1, M2].sort())
  })

  it("ignore un expéditeur sans candidature et une mission d'un autre client", async () => {
    const { conversations } = await getClientConversations()
    expect(conversations.map((c) => c.studentId)).not.toContain(STRANGER)
    expect(conversations.map((c) => c.missionId)).not.toContain(M_OTHER)
    expect(JSON.stringify(conversations)).not.toContain("Spam d'un inconnu")
  })

  it("ne lit les candidatures que des missions du client, après avoir lu ses missions", async () => {
    await getClientConversations()
    const tables = log.map((q) => q.table)
    expect(tables.indexOf("missions")).toBeLessThan(tables.indexOf("applications"))
    const appFilter = reads("applications")[0].filters.find(([kind, col]) => kind === "in" && col === "mission_id")
    expect(appFilter[2]).not.toContain(M_OTHER)
    expect(appFilter[2].sort()).toEqual([M1, M2].sort())
  })

  it("ne lit aucune candidature quand aucune mission des messages n'appartient au client", async () => {
    db.missions = db.missions.map((m) => ({ ...m, client_id: "autre-client" }))
    expect((await getClientConversations()).conversations).toEqual([])
    expect(reads("applications")).toHaveLength(0)
  })

  it("lit des colonnes explicites et ne renvoie que des champs publics (nom court, avatar)", async () => {
    const result = await getClientConversations()
    for (const q of log) expect(q.columns).not.toContain("*")
    expect(reads("profiles")[0].columns).toBe("user_id, full_name, avatar_url")
    const s1 = result.conversations.find((c) => c.studentId === S1)
    expect(s1.name).toBe("Awa K.")
    expect(JSON.stringify(result)).not.toContain("Kouassi")
    expect(Object.keys(s1).sort()).toEqual(
      ["avatarUrl", "key", "lastAt", "missionId", "missionTitle", "name", "preview", "state", "studentId", "unreadCount"].sort(),
    )
  })

  it("trie les conversations de la plus récente à la plus ancienne", async () => {
    const { conversations } = await getClientConversations()
    const dates = conversations.map((c) => c.lastAt)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it("renvoie une liste vide sans message", async () => {
    db.messages = []
    expect(await getClientConversations()).toEqual({ conversations: [] })
  })

  it("renvoie une erreur neutre quand la lecture échoue, sans texte SQL", async () => {
    failures["messages.select"] = 'relation "messages" does not exist'
    const result = await getClientConversations()
    expect(result).toEqual({ error: "Impossible de charger vos messages. Veuillez réessayer." })
    expect(JSON.stringify(result)).not.toContain("relation")
  })
})

// ─── Une conversation ───────────────────────────────────────────────────────────────────────────────────────

describe("getClientConversation", () => {
  it("n'affiche que les messages de la paire (mission, étudiant)", async () => {
    const { conversation } = await getClientConversation({ missionId: M1, studentId: S1 })
    expect(conversation.messages.map((m) => m.id)).toEqual(["a1", "a2"])
    expect(conversation.messages.map((m) => m.mine)).toEqual([false, true])
    const other = await getClientConversation({ missionId: M1, studentId: S2 })
    expect(other.conversation.messages.map((m) => m.id)).toEqual(["b1", "b2"])
  })

  it("écarte les lignes d'une autre paire même si la lecture les renvoyait", async () => {
    const supabase = makeSupabase()
    const leaky = {
      ...supabase,
      from: (table) => {
        const builder = supabase.from(table)
        if (table !== "messages") return builder
        // Lecture « fuyarde » : renvoie tous les messages sans appliquer aucun filtre.
        const all = { then: (ok) => Promise.resolve({ data: db.messages, error: null }).then(ok) }
        const proxy = new Proxy(all, { get: (t, k) => (k === "then" ? t.then : () => proxy) })
        return proxy
      },
    }
    requireRole.mockResolvedValue({ supabase: leaky, user: { id: CLIENT }, role: "client", profile: {} })
    const { conversation } = await getClientConversation({ missionId: M1, studentId: S1 })
    expect(conversation.messages.map((m) => m.id)).toEqual(["a1", "a2"])
  })

  it("filtre la lecture par mission et par paire dans la requête", async () => {
    await getClientConversation({ missionId: M1, studentId: S1 })
    const q = reads("messages")[0]
    expect(q.filters).toContainEqual(["eq", "mission_id", M1])
    expect(q.ors[0]).toBe(`and(sender_id.eq.${CLIENT},receiver_id.eq.${S1}),and(sender_id.eq.${S1},receiver_id.eq.${CLIENT})`)
    expect(q.columns).not.toContain("*")
  })

  it("renvoie notFound pour la mission d'un autre client", async () => {
    expect(await getClientConversation({ missionId: M_OTHER, studentId: S1 })).toEqual({ notFound: true })
  })

  it("renvoie notFound pour un étudiant sans candidature ni lien avec la mission", async () => {
    expect(await getClientConversation({ missionId: M1, studentId: STRANGER })).toEqual({ notFound: true })
    expect(await getClientConversation({ missionId: M2, studentId: S1 })).toEqual({ notFound: true })
  })

  it("renvoie notFound pour des identifiants mal formés ou absents", async () => {
    expect(await getClientConversation({ missionId: "abc", studentId: S1 })).toEqual({ notFound: true })
    expect(await getClientConversation({ missionId: M1, studentId: "../etc" })).toEqual({ notFound: true })
    expect(await getClientConversation({ missionId: M1 })).toEqual({ notFound: true })
    expect(await getClientConversation()).toEqual({ notFound: true })
  })

  it("prend l'étudiant retenu quand aucun étudiant n'est indiqué", async () => {
    const { conversation } = await getClientConversation({ missionId: M2 })
    expect(conversation.studentId).toBe(S2)
    expect(conversation.messages.map((m) => m.id)).toEqual(["c1"])
  })

  it("autorise l'écriture pour une candidature en attente et l'étudiant retenu d'une mission en cours", async () => {
    const candidate = (await getClientConversation({ missionId: M1, studentId: S1 })).conversation
    expect(candidate).toMatchObject({ state: "candidate", canWrite: true })
    const selected = (await getClientConversation({ missionId: M2, studentId: S2 })).conversation
    expect(selected).toMatchObject({ state: "in_progress", canWrite: true })
  })

  it("passe en lecture seule pour une mission terminée, annulée, une candidature refusée ou un autre étudiant retenu", async () => {
    db.missions[1].status = "done"
    expect((await getClientConversation({ missionId: M2, studentId: S2 })).conversation).toMatchObject({ state: "done", canWrite: false })
    db.missions[1].status = "cancelled"
    expect((await getClientConversation({ missionId: M2, studentId: S2 })).conversation).toMatchObject({ state: "cancelled", canWrite: false })
    db.applications[0].status = "rejected"
    expect((await getClientConversation({ missionId: M1, studentId: S1 })).conversation).toMatchObject({ state: "rejected", canWrite: false })
    db.missions[0].status = "in_progress"
    db.missions[0].selected_student_id = S2
    expect((await getClientConversation({ missionId: M1, studentId: S1 })).conversation).toMatchObject({ state: "closed", canWrite: false })
  })

  it("ne renvoie que l'identité publique de l'étudiant", async () => {
    const { conversation } = await getClientConversation({ missionId: M1, studentId: S1 })
    expect(conversation.student).toEqual({ id: S1, name: "Awa K.", avatarUrl: null })
    expect(reads("profiles")[0].columns).toBe("user_id, full_name, avatar_url")
    expect(conversation.userId).toBe(CLIENT)
  })

  it("renvoie une erreur neutre quand une lecture échoue", async () => {
    failures["messages.select"] = "boom"
    const result = await getClientConversation({ missionId: M1, studentId: S1 })
    expect(result).toEqual({ error: "Impossible de charger vos messages. Veuillez réessayer." })
  })
})

// ─── Envoi ──────────────────────────────────────────────────────────────────────────────────────────────────

const send = (over) => sendClientMessage({ missionId: M1, studentId: S1, type: "text", content: "Bonjour Awa", ...over })
const inserts = () => log.filter((q) => q.op === "insert")

describe("sendClientMessage : texte", () => {
  it("insère le message avec l'expéditeur de la session et l'étudiant de la paire", async () => {
    const result = await send()
    expect(result.success).toBe(true)
    expect(result.message).toMatchObject({ mine: true, type: "text", content: "Bonjour Awa" })
    expect(inserts()).toHaveLength(1)
    expect(inserts()[0].payload).toMatchObject({
      mission_id: M1,
      sender_id: CLIENT,
      receiver_id: S1,
      content: "Bonjour Awa",
      type: "text",
      media_url: null,
      read: false,
    })
  })

  it("ignore l'expéditeur et le destinataire passés dans la requête", async () => {
    await send({ sender_id: STRANGER, senderId: STRANGER, receiver_id: STRANGER, receiverId: STRANGER })
    expect(inserts()[0].payload.sender_id).toBe(CLIENT)
    expect(inserts()[0].payload.receiver_id).toBe(S1)
  })

  it("supprime les espaces autour du texte et garde les retours à la ligne", async () => {
    await send({ content: "  Ligne 1\nLigne 2  " })
    expect(inserts()[0].payload.content).toBe("Ligne 1\nLigne 2")
  })

  it("enregistre un contenu HTML tel quel (jamais interprété, l'affichage l'échappe)", async () => {
    await send({ content: '<img src=x onerror="alert(1)"> https://exemple.test' })
    expect(inserts()[0].payload.content).toBe('<img src=x onerror="alert(1)"> https://exemple.test')
  })

  it("refuse un texte vide, trop long, avec caractère de contrôle ou d'un type inconnu", async () => {
    const invalid = "Votre message n'est pas valide. Vérifiez son contenu et sa longueur."
    expect(await send({ content: "   " })).toEqual({ error: invalid })
    expect(await send({ content: undefined })).toEqual({ error: invalid })
    expect(await send({ content: "a".repeat(2001) })).toEqual({ error: invalid })
    expect(await send({ content: "bon\u0000jour" })).toEqual({ error: invalid })
    expect(await send({ type: "video" })).toEqual({ error: invalid })
    expect(await send({ content: 42 })).toEqual({ error: invalid })
    expect(inserts()).toHaveLength(0)
  })

  it("accepte exactement 2000 caractères", async () => {
    expect((await send({ content: "a".repeat(2000) })).success).toBe(true)
  })
})

describe("sendClientMessage : destinataire et mission", () => {
  const unavailable = { error: "Cette conversation n'est pas disponible." }

  it("refuse un étudiant sans lien avec la mission (destinataire tiers)", async () => {
    expect(await send({ studentId: STRANGER })).toEqual(unavailable)
    expect(inserts()).toHaveLength(0)
  })

  it("refuse la mission d'un autre client, même avec un candidat valide de cette mission", async () => {
    expect(await send({ missionId: M_OTHER, studentId: S1 })).toEqual(unavailable)
    expect(inserts()).toHaveLength(0)
  })

  it("refuse un étudiant candidat à une autre mission que celle de l'URL", async () => {
    expect(await send({ missionId: M2, studentId: S1 })).toEqual(unavailable)
    expect(inserts()).toHaveLength(0)
  })

  it("refuse des identifiants mal formés", async () => {
    const invalid = "Votre message n'est pas valide. Vérifiez son contenu et sa longueur."
    expect(await send({ missionId: "x" })).toEqual({ error: invalid })
    expect(await send({ studentId: `${S1}' or 1=1` })).toEqual({ error: invalid })
    expect(inserts()).toHaveLength(0)
  })

  it("refuse l'écriture dans une conversation en lecture seule", async () => {
    const readonly = { error: "Cette conversation est en lecture seule." }
    db.missions[1].status = "done"
    expect(await send({ missionId: M2, studentId: S2 })).toEqual(readonly)
    db.applications[0].status = "rejected"
    expect(await send()).toEqual(readonly)
    expect(inserts()).toHaveLength(0)
  })

  it("limite le débit : 20 messages par minute au plus", async () => {
    const recent = new Date(Date.now() - 5000).toISOString()
    db.messages = Array.from({ length: 20 }, (_, i) => row({ id: `r${i}`, sender_id: CLIENT, receiver_id: S1, created_at: recent }))
    expect(await send()).toEqual({ error: "Vous envoyez des messages trop vite. Patientez un instant avant de réessayer." })
    expect(inserts()).toHaveLength(0)
    db.messages = db.messages.slice(0, 19)
    expect((await send()).success).toBe(true)
  })

  it("renvoie une erreur neutre quand l'insertion échoue", async () => {
    failures["messages.insert"] = "duplicate key value violates unique constraint messages_pkey"
    const result = await send()
    expect(result).toEqual({ error: "Votre message n'a pas pu être envoyé. Veuillez réessayer." })
    expect(JSON.stringify(result)).not.toContain("duplicate")
  })
})

describe("sendClientMessage : pièces jointes", () => {
  const refused = { error: "Ce fichier n'est pas accepté. Choisissez une image ou un message vocal de 10 Mo au plus." }

  it("accepte une image du dossier de l'expéditeur et reconstruit l'adresse publique côté serveur", async () => {
    const result = await send({ type: "image", content: "ignoré", mediaPath: `${CLIENT}/1699-abc.jpg`, mediaUrl: "https://evil.test/x.png" })
    expect(result.success).toBe(true)
    const payload = inserts()[0].payload
    expect(payload.media_url).toBe(`${ORIGIN}/storage/v1/object/public/message-media/${CLIENT}/1699-abc.jpg`)
    expect(payload.content).toBe("Image")
    expect(payload.type).toBe("image")
    expect(result.message.mediaUrl).toBe(payload.media_url)
  })

  it("accepte un message vocal et une adresse publique du projet pour un fichier du dossier de l'expéditeur", async () => {
    expect((await send({ type: "voice", mediaPath: `${CLIENT}/note.webm` })).success).toBe(true)
    const url = `${ORIGIN}/storage/v1/object/public/message-media/${CLIENT}/photo.png`
    expect((await send({ type: "image", mediaPath: url })).success).toBe(true)
    expect(inserts()[1].payload.media_url).toBe(url)
  })

  it("refuse un chemin hors du dossier de l'utilisateur", async () => {
    expect(await send({ type: "image", mediaPath: `${OTHER_CLIENT}/a.jpg` })).toEqual(refused)
    expect(await send({ type: "image", mediaPath: `${S1}/a.jpg` })).toEqual(refused)
    expect(await send({ type: "image", mediaPath: "a.jpg" })).toEqual(refused)
    expect(await send({ type: "image", mediaPath: `${CLIENT}/../${OTHER_CLIENT}/a.jpg` })).toEqual(refused)
    expect(await send({ type: "image", mediaPath: `${CLIENT}/%2e%2e/a.jpg` })).toEqual(refused)
    expect(await send({ type: "image", mediaPath: `${CLIENT}//a.jpg` })).toEqual(refused)
    expect(inserts()).toHaveLength(0)
  })

  it("refuse l'adresse d'un autre projet ou d'un autre compartiment", async () => {
    expect(await send({ type: "image", mediaPath: `https://evil.test/storage/v1/object/public/message-media/${CLIENT}/a.jpg` })).toEqual(refused)
    expect(await send({ type: "image", mediaPath: `${ORIGIN}/storage/v1/object/public/avatars/${CLIENT}/a.jpg` })).toEqual(refused)
    expect(await send({ type: "image", mediaPath: "javascript:alert(1)" })).toEqual(refused)
    expect(inserts()).toHaveLength(0)
  })

  it("refuse un fichier absent, d'un type non accepté ou qui ne correspond pas au type du message", async () => {
    expect(await send({ type: "image" })).toEqual(refused)
    expect(await send({ type: "image", mediaPath: `${CLIENT}/script.html` })).toEqual(refused)
    expect(await send({ type: "image", mediaPath: `${CLIENT}/note.webm` })).toEqual(refused)
    expect(await send({ type: "voice", mediaPath: `${CLIENT}/photo.jpg` })).toEqual(refused)
    expect(await send({ type: "voice", mediaPath: `${CLIENT}/noext` })).toEqual(refused)
    expect(inserts()).toHaveLength(0)
  })

  it("accepte une position valide et refuse des coordonnées hors bornes", async () => {
    const result = await send({ type: "location", lat: 6.37, lng: 2.39 })
    expect(result.success).toBe(true)
    expect(inserts()[0].payload).toMatchObject({ type: "location", location_lat: 6.37, location_lng: 2.39, content: "Position partagée" })
    const invalid = "Votre message n'est pas valide. Vérifiez son contenu et sa longueur."
    expect(await send({ type: "location", lat: 91, lng: 2 })).toEqual({ error: invalid })
    expect(await send({ type: "location", lat: 6, lng: 181 })).toEqual({ error: invalid })
    expect(await send({ type: "location", lat: "6", lng: 2 })).toEqual({ error: invalid })
    expect(await send({ type: "location" })).toEqual({ error: invalid })
    expect(inserts()).toHaveLength(1)
  })
})

// ─── Marquer comme lu ───────────────────────────────────────────────────────────────────────────────────────

describe("markClientConversationRead", () => {
  const unread = (id) => db.messages.find((m) => m.id === id).read === false

  it("ne marque comme lus que les messages reçus de cette conversation", async () => {
    expect(await markClientConversationRead({ missionId: M1, studentId: S1 })).toEqual({ success: true })
    expect(unread("a1")).toBe(false)
    // Autre étudiant de la même mission, autre mission du même étudiant, autres expéditeurs : intacts.
    expect(unread("b1")).toBe(true)
    expect(unread("b2")).toBe(true)
    expect(unread("c1")).toBe(true)
    expect(unread("z1")).toBe(true)
    expect(unread("z2")).toBe(true)
  })

  it("cible la mission, le destinataire (la session) et l'expéditeur, et ne modifie que la colonne read", async () => {
    await markClientConversationRead({ missionId: M1, studentId: S1 })
    const update = log.find((q) => q.op === "update")
    expect(update.payload).toEqual({ read: true })
    expect(update.filters).toEqual(
      expect.arrayContaining([["eq", "mission_id", M1], ["eq", "receiver_id", CLIENT], ["eq", "sender_id", S1], ["eq", "read", false]]),
    )
  })

  it("refuse un étudiant sans lien, la mission d'un autre client et un étudiant absent, sans mise à jour", async () => {
    const unavailable = { error: "Cette conversation n'est pas disponible." }
    expect(await markClientConversationRead({ missionId: M1, studentId: STRANGER })).toEqual(unavailable)
    expect(await markClientConversationRead({ missionId: M_OTHER, studentId: S1 })).toEqual(unavailable)
    expect(await markClientConversationRead({ missionId: M1 })).toEqual(unavailable)
    expect(await markClientConversationRead({ missionId: "x", studentId: S1 })).toEqual(unavailable)
    expect(log.filter((q) => q.op === "update")).toHaveLength(0)
    expect(unread("z1")).toBe(true)
  })

  it("renvoie une erreur neutre quand la mise à jour échoue", async () => {
    failures["messages.update"] = "permission denied for table messages"
    const result = await markClientConversationRead({ missionId: M1, studentId: S1 })
    expect(result).toEqual({ error: "Impossible de charger vos messages. Veuillez réessayer." })
  })
})

// ─── Espace étudiant ────────────────────────────────────────────────────────────────────────────────────────
// Une conversation est (mission, étudiant = session) ; l'interlocuteur est le client de la mission, déduit en base.

const STUDENT = "33333333-3333-4333-8333-333333333331"
const STUDENT_2 = "33333333-3333-4333-8333-333333333332"
const MA = "44444444-4444-4444-8444-444444444441"
const MB = "44444444-4444-4444-8444-444444444442"
const MC = "44444444-4444-4444-8444-444444444443"
const MD = "44444444-4444-4444-8444-444444444444"
const ME = "44444444-4444-4444-8444-444444444445"

function seedStudent() {
  db = {
    missions: [
      { id: MA, client_id: CLIENT, title: "Traduire un flyer", status: "open", selected_student_id: null },
      { id: MB, client_id: CLIENT, title: "Cours de maths", status: "in_progress", selected_student_id: STUDENT },
      { id: MC, client_id: OTHER_CLIENT, title: "Mission sans candidature", status: "open", selected_student_id: null },
      { id: MD, client_id: CLIENT, title: "Mission d'un autre candidat", status: "open", selected_student_id: null },
      { id: ME, client_id: OTHER_CLIENT, title: "Saisie terminée", status: "done", selected_student_id: STUDENT },
    ],
    applications: [
      { mission_id: MA, student_id: STUDENT, status: "pending" },
      { mission_id: MB, student_id: STUDENT, status: "accepted" },
      { mission_id: MD, student_id: STUDENT_2, status: "pending" },
      { mission_id: ME, student_id: STUDENT, status: "accepted" },
    ],
    profiles: [
      { user_id: CLIENT, full_name: "Marc Dossou", avatar_url: null },
      { user_id: OTHER_CLIENT, full_name: "Rosine Houngbédji", avatar_url: null },
      { user_id: STRANGER, full_name: "Intrus Inconnu", avatar_url: null },
    ],
    messages: [
      row({ id: "s1", mission_id: MA, sender_id: CLIENT, receiver_id: STUDENT, content: "Bonjour de Marc", created_at: "2026-10-13T08:00:00Z" }),
      row({ id: "s2", mission_id: MA, sender_id: STUDENT, receiver_id: CLIENT, content: "Ma réponse", read: true, created_at: "2026-10-13T08:05:00Z" }),
      row({ id: "s3", mission_id: MB, sender_id: CLIENT, receiver_id: STUDENT, content: "Premier sur MB", created_at: "2026-10-13T09:00:00Z" }),
      row({ id: "s3b", mission_id: MB, sender_id: CLIENT, receiver_id: STUDENT, content: "Deuxième sur MB", created_at: "2026-10-13T09:10:00Z" }),
      row({ id: "s4", mission_id: MC, sender_id: OTHER_CLIENT, receiver_id: STUDENT, content: "Message sans candidature", created_at: "2026-10-13T11:00:00Z" }),
      row({ id: "s5", mission_id: MA, sender_id: STRANGER, receiver_id: STUDENT, content: "Intrus sur MA", created_at: "2026-10-13T11:30:00Z" }),
      row({ id: "s6", mission_id: ME, sender_id: OTHER_CLIENT, receiver_id: STUDENT, content: "Merci pour la mission", created_at: "2026-10-12T10:00:00Z", read: true }),
      row({ id: "s7", mission_id: MD, sender_id: STUDENT_2, receiver_id: CLIENT, content: "Autre étudiant", created_at: "2026-10-13T12:00:00Z" }),
    ],
  }
}

describe("espace étudiant", () => {
  beforeEach(() => {
    seedStudent()
    requireRole.mockResolvedValue({ supabase: makeSupabase(), user: { id: STUDENT }, role: "student", profile: {} })
  })

  const studentInserts = () => log.filter((q) => q.op === "insert")
  const sendS = (over) => sendStudentMessage({ missionId: MA, type: "text", content: "Bonjour Marc", ...over })
  const unavailableS = { error: "Cette conversation n'est pas disponible." }
  const invalidS = { error: "Votre message n'est pas valide. Vérifiez son contenu et sa longueur." }

  describe("garde de rôle", () => {
    const calls = {
      getStudentConversations: () => getStudentConversations(),
      getStudentConversation: () => getStudentConversation({ missionId: MA }),
      sendStudentMessage: () => sendS(),
      markStudentConversationRead: () => markStudentConversationRead({ missionId: MA }),
    }

    for (const [name, call] of Object.entries(calls)) {
      it(`${name} exige le rôle étudiant et ne touche à aucune table quand l'accès est refusé`, async () => {
        requireRole.mockResolvedValueOnce({ error: "Vous n'avez pas les droits pour effectuer cette action." })
        const result = await call()
        expect(requireRole).toHaveBeenCalledWith(["student"])
        expect(result).toEqual({ error: "Vous n'avez pas les droits pour effectuer cette action." })
        expect(log).toEqual([])
      })

      it(`${name} appelle requireRole avant tout accès aux données`, async () => {
        let readsBeforeRole = -1
        requireRole.mockImplementationOnce(async () => {
          readsBeforeRole = log.length
          return { supabase: makeSupabase(), user: { id: STUDENT }, role: "student", profile: {} }
        })
        await call()
        expect(readsBeforeRole).toBe(0)
      })
    }
  })

  describe("getStudentConversations", () => {
    it("donne deux conversations distinctes pour deux missions du même client", async () => {
      const { conversations } = await getStudentConversations()
      const withMarc = conversations.filter((c) => c.name === "Marc D.")
      expect(withMarc.map((c) => c.missionId).sort()).toEqual([MA, MB].sort())
      expect(new Set(withMarc.map((c) => c.key)).size).toBe(2)
      const a = withMarc.find((c) => c.missionId === MA)
      const b = withMarc.find((c) => c.missionId === MB)
      expect(a.preview).toBe("Vous : Ma réponse")
      expect(a.unreadCount).toBe(1)
      expect(b.preview).toBe("Deuxième sur MB")
      expect(b.unreadCount).toBe(2)
    })

    it("vouvoie l'aperçu d'un message envoyé (« Vous : »)", async () => {
      const { conversations } = await getStudentConversations()
      const a = conversations.find((c) => c.missionId === MA)
      expect(a.preview).toBe("Vous : Ma réponse")
      expect(JSON.stringify(conversations)).not.toContain("Toi :")
    })

    it("ignore les messages d'un compte sans candidature ni lien légitime", async () => {
      const { conversations } = await getStudentConversations()
      const missionIds = conversations.map((c) => c.missionId)
      // MC : aucune candidature ; MD : une autre candidate ; STRANGER n'est pas le client de MA.
      expect(missionIds).not.toContain(MC)
      expect(missionIds).not.toContain(MD)
      const json = JSON.stringify(conversations)
      expect(json).not.toContain("Message sans candidature")
      expect(json).not.toContain("Intrus")
      const a = conversations.find((c) => c.missionId === MA)
      expect(a.unreadCount).toBe(1)
    })

    it("garde une mission terminée où l'étudiant est retenu", async () => {
      const { conversations } = await getStudentConversations()
      const e = conversations.find((c) => c.missionId === ME)
      expect(e).toMatchObject({ name: "Rosine H.", state: "done" })
    })

    it("ne lit que les candidatures de la session, pour les missions des messages", async () => {
      await getStudentConversations()
      const appRead = reads("applications")[0]
      expect(appRead.filters).toEqual(expect.arrayContaining([["eq", "student_id", STUDENT]]))
      const inMissions = appRead.filters.find(([kind, col]) => kind === "in" && col === "mission_id")
      expect(inMissions[2]).not.toContain("x")
    })

    it("lit des colonnes explicites et ne renvoie que des champs publics (nom court, avatar)", async () => {
      const result = await getStudentConversations()
      for (const q of log) expect(q.columns).not.toContain("*")
      expect(reads("profiles")[0].columns).toBe("user_id, full_name, avatar_url")
      expect(JSON.stringify(result)).not.toContain("Dossou")
      expect(Object.keys(result.conversations[0]).sort()).toEqual(
        ["avatarUrl", "key", "lastAt", "missionId", "missionTitle", "name", "preview", "state", "unreadCount"].sort(),
      )
    })

    it("trie les conversations de la plus récente à la plus ancienne", async () => {
      const { conversations } = await getStudentConversations()
      const dates = conversations.map((c) => c.lastAt)
      expect([...dates].sort().reverse()).toEqual(dates)
    })

    it("renvoie une liste vide sans message", async () => {
      db.messages = []
      expect(await getStudentConversations()).toEqual({ conversations: [] })
    })

    it("renvoie une erreur neutre vouvoyée quand la lecture échoue, sans texte SQL", async () => {
      failures["messages.select"] = 'relation "messages" does not exist'
      const result = await getStudentConversations()
      expect(result).toEqual({ error: "Impossible de charger vos messages. Veuillez réessayer." })
      failures["messages.select"] = undefined
      failures["applications.select"] = "boom sql"
      expect(await getStudentConversations()).toEqual({ error: "Impossible de charger vos messages. Veuillez réessayer." })
    })
  })

  describe("getStudentConversation", () => {
    it("n'affiche que les messages de la paire (mission, étudiant de la session, client de la mission)", async () => {
      const { conversation } = await getStudentConversation({ missionId: MA })
      expect(conversation.messages.map((m) => m.id)).toEqual(["s1", "s2"])
      expect(conversation.messages.map((m) => m.mine)).toEqual([false, true])
      expect(conversation).toMatchObject({ userId: STUDENT, clientId: CLIENT, state: "candidate", canWrite: true })
      expect(conversation.client.name).toBe("Marc D.")
      const mb = await getStudentConversation({ missionId: MB })
      expect(mb.conversation.messages.map((m) => m.id)).toEqual(["s3", "s3b"])
    })

    it("filtre la lecture par mission et par paire dans la requête, avec des identifiants validés", async () => {
      await getStudentConversation({ missionId: MA })
      const q = reads("messages")[0]
      expect(q.filters).toEqual(expect.arrayContaining([["eq", "mission_id", MA]]))
      expect(q.ors[0]).toBe(
        `and(sender_id.eq.${STUDENT},receiver_id.eq.${CLIENT}),and(sender_id.eq.${CLIENT},receiver_id.eq.${STUDENT})`,
      )
    })

    it("écarte les lignes d'une autre paire même si la lecture les renvoyait", async () => {
      db.messages.push(row({ id: "intrus", mission_id: MA, sender_id: STRANGER, receiver_id: STUDENT, created_at: "2026-10-13T12:30:00Z" }))
      const base = makeSupabase()
      requireRole.mockResolvedValue({
        supabase: {
          ...base,
          from: (table) => {
            const b = base.from(table)
            if (table !== "messages") return b
            return { ...b, or: () => b }
          },
        },
        user: { id: STUDENT },
        role: "student",
        profile: {},
      })
      const { conversation } = await getStudentConversation({ missionId: MA })
      expect(conversation.messages.map((m) => m.id)).not.toContain("intrus")
    })

    it("renvoie notFound sans candidature ni sélection, pour une mission inconnue ou un identifiant mal formé", async () => {
      expect(await getStudentConversation({ missionId: MC })).toEqual({ notFound: true })
      expect(await getStudentConversation({ missionId: MD })).toEqual({ notFound: true })
      expect(await getStudentConversation({ missionId: "44444444-4444-4444-8444-4444444444ff" })).toEqual({ notFound: true })
      expect(await getStudentConversation({ missionId: "x" })).toEqual({ notFound: true })
      expect(await getStudentConversation({ missionId: `${MA}' or 1=1` })).toEqual({ notFound: true })
      expect(await getStudentConversation({})).toEqual({ notFound: true })
    })

    it("ignore tout identifiant d'interlocuteur passé dans l'entrée", async () => {
      const { conversation } = await getStudentConversation({ missionId: MA, studentId: STRANGER, clientId: STRANGER, receiverId: STRANGER })
      expect(conversation.clientId).toBe(CLIENT)
      expect(conversation.messages.map((m) => m.id)).toEqual(["s1", "s2"])
    })

    it("donne le droit d'écriture selon l'état : en lecture seule pour terminée, refusée ou autre retenu", async () => {
      expect((await getStudentConversation({ missionId: ME })).conversation).toMatchObject({ state: "done", canWrite: false })
      db.applications[0].status = "rejected"
      expect((await getStudentConversation({ missionId: MA })).conversation).toMatchObject({ state: "rejected", canWrite: false })
      db.missions[1].selected_student_id = STUDENT_2
      db.applications[1].status = "rejected"
      expect((await getStudentConversation({ missionId: MB })).conversation).toMatchObject({ state: "closed", canWrite: false })
    })

    it("ne renvoie que l'identité publique du client et renvoie une erreur neutre si la lecture échoue", async () => {
      const result = await getStudentConversation({ missionId: MA })
      expect(JSON.stringify(result)).not.toContain("Dossou")
      expect(reads("profiles")[0].columns).toBe("user_id, full_name, avatar_url")
      failures["messages.select"] = "relation messages"
      expect(await getStudentConversation({ missionId: MA })).toEqual({
        error: "Impossible de charger vos messages. Veuillez réessayer.",
      })
    })
  })

  describe("sendStudentMessage : texte et destinataire", () => {
    it("insère le message avec l'expéditeur de la session et le client de la mission comme destinataire", async () => {
      const result = await sendS()
      expect(result.success).toBe(true)
      expect(result.message).toMatchObject({ mine: true, type: "text", content: "Bonjour Marc" })
      expect(studentInserts()).toHaveLength(1)
      expect(studentInserts()[0].payload).toMatchObject({
        mission_id: MA,
        sender_id: STUDENT,
        receiver_id: CLIENT,
        content: "Bonjour Marc",
        type: "text",
        media_url: null,
        read: false,
      })
    })

    it("ignore un destinataire ou un expéditeur forgé dans l'entrée", async () => {
      await sendS({
        sender_id: STRANGER, senderId: STRANGER,
        receiver_id: STRANGER, receiverId: STRANGER,
        studentId: STRANGER, clientId: STRANGER, to: STRANGER,
      })
      expect(studentInserts()).toHaveLength(1)
      expect(studentInserts()[0].payload.sender_id).toBe(STUDENT)
      expect(studentInserts()[0].payload.receiver_id).toBe(CLIENT)
    })

    it("écrit au client de CHAQUE mission, y compris deux missions du même client", async () => {
      await sendS({ missionId: MB })
      await sendS({ missionId: ME })
      expect(studentInserts().map((q) => [q.payload.mission_id, q.payload.receiver_id])).toEqual([[MB, CLIENT]])
    })

    it("refuse une mission sans candidature de l'étudiant (destinataire tiers), sans insertion", async () => {
      expect(await sendS({ missionId: MC })).toEqual(unavailableS)
      expect(await sendS({ missionId: MD })).toEqual(unavailableS)
      expect(studentInserts()).toHaveLength(0)
    })

    it("refuse une mission inexistante ou un identifiant mal formé", async () => {
      expect(await sendS({ missionId: "44444444-4444-4444-8444-4444444444ff" })).toEqual(unavailableS)
      expect(await sendS({ missionId: "x" })).toEqual(invalidS)
      expect(await sendS({ missionId: `${MA}' or 1=1` })).toEqual(invalidS)
      expect(await sendStudentMessage(undefined)).toEqual(invalidS)
      expect(studentInserts()).toHaveLength(0)
    })

    it("refuse l'écriture dans une conversation en lecture seule", async () => {
      const readonly = { error: "Cette conversation est en lecture seule." }
      expect(await sendS({ missionId: ME })).toEqual(readonly)
      db.applications[0].status = "rejected"
      expect(await sendS()).toEqual(readonly)
      expect(studentInserts()).toHaveLength(0)
    })

    it("supprime les espaces autour du texte et enregistre le HTML tel quel (jamais interprété)", async () => {
      await sendS({ content: "  Ligne 1\nLigne 2  " })
      expect(studentInserts()[0].payload.content).toBe("Ligne 1\nLigne 2")
      await sendS({ content: '<img src=x onerror="alert(1)">' })
      expect(studentInserts()[1].payload.content).toBe('<img src=x onerror="alert(1)">')
    })

    it("refuse un texte vide, trop long, avec caractère de contrôle ou d'un type inconnu ; accepte 2000 caractères", async () => {
      expect(await sendS({ content: "   " })).toEqual(invalidS)
      expect(await sendS({ content: undefined })).toEqual(invalidS)
      expect(await sendS({ content: "a".repeat(2001) })).toEqual(invalidS)
      expect(await sendS({ content: "bon\u0000jour" })).toEqual(invalidS)
      expect(await sendS({ type: "video" })).toEqual(invalidS)
      expect(await sendS({ content: 42 })).toEqual(invalidS)
      expect(studentInserts()).toHaveLength(0)
      expect((await sendS({ content: "a".repeat(2000) })).success).toBe(true)
    })

    it("limite le débit : 20 messages par minute au plus, compté sur l'expéditeur", async () => {
      const recent = new Date(Date.now() - 5000).toISOString()
      db.messages = Array.from({ length: 20 }, (_, i) => row({ id: `r${i}`, mission_id: MA, sender_id: STUDENT, receiver_id: CLIENT, created_at: recent }))
      expect(await sendS()).toEqual({ error: "Vous envoyez des messages trop vite. Patientez un instant avant de réessayer." })
      expect(studentInserts()).toHaveLength(0)
      const count = reads("messages").find((q) => q.head)
      expect(count.filters).toEqual(expect.arrayContaining([["eq", "sender_id", STUDENT]]))
      db.messages = db.messages.slice(0, 19)
      expect((await sendS()).success).toBe(true)
    })

    it("renvoie une erreur neutre vouvoyée quand l'insertion ou le comptage échoue", async () => {
      failures["messages.insert"] = "duplicate key value violates unique constraint messages_pkey"
      const result = await sendS()
      expect(result).toEqual({ error: "Votre message n'a pas pu être envoyé. Veuillez réessayer." })
      expect(JSON.stringify(result)).not.toContain("duplicate")
      failures["messages.insert"] = undefined
      failures["messages.select"] = "boom"
      expect(await sendS()).toEqual({ error: "Votre message n'a pas pu être envoyé. Veuillez réessayer." })
    })
  })

  describe("sendStudentMessage : pièces jointes et position", () => {
    const refused = { error: "Ce fichier n'est pas accepté. Choisissez une image ou un message vocal de 10 Mo au plus." }

    it("accepte une image du dossier de l'expéditeur et reconstruit l'adresse publique côté serveur", async () => {
      const result = await sendS({ type: "image", content: "ignoré", mediaPath: `${STUDENT}/1699-abc.jpg`, mediaUrl: "https://evil.test/x.png" })
      expect(result.success).toBe(true)
      const payload = studentInserts()[0].payload
      expect(payload.media_url).toBe(`${ORIGIN}/storage/v1/object/public/message-media/${STUDENT}/1699-abc.jpg`)
      expect(payload).toMatchObject({ content: "Image", type: "image", receiver_id: CLIENT, sender_id: STUDENT })
    })

    it("accepte un message vocal du dossier de l'expéditeur", async () => {
      expect((await sendS({ type: "voice", mediaPath: `${STUDENT}/note.webm` })).success).toBe(true)
      expect(studentInserts()[0].payload).toMatchObject({ type: "voice", content: "Message vocal" })
    })

    it("refuse un chemin hors du dossier de l'étudiant (celui du client, d'un autre étudiant, traversée)", async () => {
      expect(await sendS({ type: "image", mediaPath: `${CLIENT}/a.jpg` })).toEqual(refused)
      expect(await sendS({ type: "image", mediaPath: `${STUDENT_2}/a.jpg` })).toEqual(refused)
      expect(await sendS({ type: "image", mediaPath: "a.jpg" })).toEqual(refused)
      expect(await sendS({ type: "image", mediaPath: `${STUDENT}/../${STUDENT_2}/a.jpg` })).toEqual(refused)
      expect(await sendS({ type: "image", mediaPath: `${STUDENT}/%2e%2e/a.jpg` })).toEqual(refused)
      expect(await sendS({ type: "image", mediaPath: `${STUDENT}//a.jpg` })).toEqual(refused)
      expect(studentInserts()).toHaveLength(0)
    })

    it("refuse l'adresse d'un autre projet ou compartiment, ou un schéma dangereux", async () => {
      expect(await sendS({ type: "image", mediaPath: `https://evil.test/storage/v1/object/public/message-media/${STUDENT}/a.jpg` })).toEqual(refused)
      expect(await sendS({ type: "image", mediaPath: `${ORIGIN}/storage/v1/object/public/avatars/${STUDENT}/a.jpg` })).toEqual(refused)
      expect(await sendS({ type: "image", mediaPath: "javascript:alert(1)" })).toEqual(refused)
      expect(studentInserts()).toHaveLength(0)
    })

    it("refuse un fichier absent, d'un type non accepté ou incohérent avec le type du message", async () => {
      expect(await sendS({ type: "image" })).toEqual(refused)
      expect(await sendS({ type: "image", mediaPath: `${STUDENT}/script.html` })).toEqual(refused)
      expect(await sendS({ type: "image", mediaPath: `${STUDENT}/note.webm` })).toEqual(refused)
      expect(await sendS({ type: "voice", mediaPath: `${STUDENT}/photo.jpg` })).toEqual(refused)
      expect(await sendS({ type: "voice", mediaPath: `${STUDENT}/noext` })).toEqual(refused)
      expect(studentInserts()).toHaveLength(0)
    })

    it("accepte une position valide et refuse des coordonnées hors bornes", async () => {
      expect((await sendS({ type: "location", lat: 6.37, lng: 2.39 })).success).toBe(true)
      expect(studentInserts()[0].payload).toMatchObject({ type: "location", location_lat: 6.37, location_lng: 2.39, content: "Position partagée" })
      expect(await sendS({ type: "location", lat: 91, lng: 2 })).toEqual(invalidS)
      expect(await sendS({ type: "location", lat: 6, lng: 181 })).toEqual(invalidS)
      expect(await sendS({ type: "location", lat: "6", lng: 2 })).toEqual(invalidS)
      expect(await sendS({ type: "location" })).toEqual(invalidS)
      expect(studentInserts()).toHaveLength(1)
    })
  })

  describe("markStudentConversationRead", () => {
    const unread = (id) => db.messages.find((m) => m.id === id).read === false

    it("ne marque comme lus que les messages reçus du client dans cette mission", async () => {
      expect(await markStudentConversationRead({ missionId: MA })).toEqual({ success: true })
      expect(unread("s1")).toBe(false)
      // Autre mission du même client, autre expéditeur sur la même mission, autre client : intacts.
      expect(unread("s3")).toBe(true)
      expect(unread("s3b")).toBe(true)
      expect(unread("s5")).toBe(true)
      expect(unread("s4")).toBe(true)
    })

    it("cible la mission, le destinataire (la session) et le client déduit, et ne modifie que la colonne read", async () => {
      await markStudentConversationRead({ missionId: MA, studentId: STRANGER, senderId: STRANGER })
      const update = log.find((q) => q.op === "update")
      expect(update.payload).toEqual({ read: true })
      expect(update.filters).toEqual(
        expect.arrayContaining([["eq", "mission_id", MA], ["eq", "receiver_id", STUDENT], ["eq", "sender_id", CLIENT], ["eq", "read", false]]),
      )
    })

    it("refuse une mission sans lien, inexistante ou mal formée, sans mise à jour", async () => {
      expect(await markStudentConversationRead({ missionId: MC })).toEqual(unavailableS)
      expect(await markStudentConversationRead({ missionId: MD })).toEqual(unavailableS)
      expect(await markStudentConversationRead({ missionId: "x" })).toEqual(unavailableS)
      expect(await markStudentConversationRead({})).toEqual(unavailableS)
      expect(log.filter((q) => q.op === "update")).toHaveLength(0)
      expect(unread("s4")).toBe(true)
    })

    it("renvoie une erreur neutre vouvoyée quand la mise à jour échoue", async () => {
      failures["messages.update"] = "permission denied for table messages"
      const result = await markStudentConversationRead({ missionId: MA })
      expect(result).toEqual({ error: "Impossible de charger vos messages. Veuillez réessayer." })
    })
  })
})
