import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Vérification indépendante RD-SEC-03b : requireRole RÉEL (session, profil, rôle, suspension), client de
// session simulé avec une règle de lecture du stockage (participants du message), service role interdit.

const state = vi.hoisted(() => ({ supabase: null, serviceCalls: 0 }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.supabase }))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    state.serviceCalls += 1
    throw new Error("service role interdit pour la signature des médias")
  },
}))

import {
  getClientConversation,
  getClientMessageMedia,
  getStudentConversation,
  getStudentMessageMedia,
} from "@/lib/actions/message.actions"
import { mediaPathOf, safeSignedMediaUrl, toMessage } from "@/lib/client-space/conversations"

const ORIGIN = "https://example.supabase.co"
const CLIENT = "00000000-0000-4000-8000-000000000001"
const OTHER_CLIENT = "00000000-0000-4000-8000-000000000002"
const STUDENT = "22222222-2222-4222-8222-222222222221"
const STRANGER = "22222222-2222-4222-8222-222222222229"
const M1 = "11111111-1111-4111-8111-111111111111"
const M_OTHER = "11111111-1111-4111-8111-111111111119"
const ID = (n) => `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`
const pub = (uid, name) => `${ORIGIN}/storage/v1/object/public/message-media/${uid}/${name}`
const signedUrl = (path) => `${ORIGIN}/storage/v1/object/sign/message-media/${path}?token=t`

let db
let signCalls
let session // { id } | null
let profile // profil de la session
let signedOverride // remplace l'adresse renvoyée par le stockage (stockage hostile)

function msg(over) {
  return {
    id: ID(1),
    mission_id: M1,
    sender_id: STUDENT,
    receiver_id: CLIENT,
    content: "Image",
    type: "image",
    media_url: pub(STUDENT, "a.png"),
    location_lat: null,
    location_lng: null,
    read: false,
    created_at: "2026-10-13T08:00:00Z",
    ...over,
  }
}

function makeSupabase() {
  const from = (table) => {
    const filters = []
    const ors = []
    const b = {
      select: () => b,
      eq: (c, v) => (filters.push((r) => r[c] === v), b),
      in: (c, v) => (filters.push((r) => v.includes(r[c])), b),
      gte: () => b,
      or: (expr) => (ors.push(expr), b),
      order: () => b,
      limit: () => b,
      maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      then: (ok, ko) => Promise.resolve({ data: run(), error: null, count: run().length }).then(ok, ko),
    }
    const run = () =>
      (db[table] ?? []).filter(
        (r) =>
          filters.every((f) => f(r)) &&
          ors.every((expr) =>
            expr.split(/,(?![^(]*\))/).some((cond) => {
              const parts = cond.startsWith("and(") ? cond.slice(4, -1).split(",") : [cond]
              return parts.every((p) => {
                const [col, , ...rest] = p.split(".")
                return String(r[col]) === rest.join(".")
              })
            }),
          ),
      )
    return b
  }
  return {
    auth: {
      getUser: async () => (session ? { data: { user: session }, error: null } : { data: { user: null }, error: { message: "no session" } }),
    },
    from: (table) => {
      if (table === "profiles") {
        const b = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: profile, error: null }) }
        return b
      }
      return from(table)
    },
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `${ORIGIN}/storage/v1/object/public/${bucket}/${path}` } }),
        // Règle de lecture : seul un participant du message portant ce chemin obtient une signature.
        createSignedUrls: async (paths, ttl) => {
          signCalls.push({ bucket, paths, ttl })
          return {
            error: null,
            data: paths.map((path) => {
              const allowed = db.messages.some(
                (m) =>
                  (m.sender_id === session?.id || m.receiver_id === session?.id) &&
                  typeof m.media_url === "string" &&
                  m.media_url.includes(`/message-media/${path}`),
              )
              if (!allowed || bucket !== "message-media") return { path, signedUrl: null, error: "Object not found" }
              return { path, error: null, signedUrl: signedOverride ?? signedUrl(path) }
            }),
          }
        },
      }),
    },
  }
}

function seed() {
  db = {
    missions: [
      { id: M1, client_id: CLIENT, title: "M", status: "open", selected_student_id: null },
      { id: M_OTHER, client_id: OTHER_CLIENT, title: "Autre", status: "open", selected_student_id: null },
    ],
    applications: [{ mission_id: M1, student_id: STUDENT, status: "pending" }],
    profiles: [{ user_id: STUDENT, full_name: "Awa", avatar_url: null }],
    messages: [msg({})],
  }
}

function as(id, role, extra = {}) {
  session = { id }
  profile = { role, full_name: "X", city: "Cotonou", is_suspended: false, ...extra }
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN)
  state.serviceCalls = 0
  signCalls = []
  signedOverride = undefined
  seed()
  state.supabase = makeSupabase()
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const askClient = (over) => getClientMessageMedia({ missionId: M1, studentId: STUDENT, messageIds: [ID(1)], ...over })
const askStudent = (over) => getStudentMessageMedia({ missionId: M1, messageIds: [ID(1)], ...over })

describe("authentification et rôle (requireRole réel)", () => {
  it("client non connecté : refus, aucune signature", async () => {
    session = null
    expect(await askClient()).toEqual({ error: expect.stringMatching(/connecté/) })
    expect(await askStudent()).toEqual({ error: expect.stringMatching(/connecté/) })
    expect(signCalls).toEqual([])
  })

  it("étudiant appelant l'action client et client appelant l'action étudiant : refus", async () => {
    as(STUDENT, "student")
    expect(await askClient()).toEqual({ error: expect.stringMatching(/droits/) })
    as(CLIENT, "client")
    expect(await askStudent()).toEqual({ error: expect.stringMatching(/droits/) })
    expect(signCalls).toEqual([])
  })

  it("compte suspendu : refus des deux actions de signature et des lectures de conversation", async () => {
    as(CLIENT, "client", { is_suspended: true })
    expect(await askClient()).toEqual({ error: expect.stringMatching(/droits/) })
    expect(await getClientConversation({ missionId: M1, studentId: STUDENT })).toEqual({ error: expect.stringMatching(/droits/) })
    as(STUDENT, "student", { is_suspended: true })
    expect(await askStudent()).toEqual({ error: expect.stringMatching(/droits/) })
    expect(await getStudentConversation({ missionId: M1 })).toEqual({ error: expect.stringMatching(/droits/) })
    expect(signCalls).toEqual([])
  })

  it("admin ou profil sans rôle : refus", async () => {
    as(CLIENT, "admin")
    expect(await askClient()).toEqual({ error: expect.stringMatching(/droits/) })
    session = { id: CLIENT }
    profile = null
    expect(await askClient()).toEqual({ error: expect.stringMatching(/droits/) })
    expect(signCalls).toEqual([])
  })
})

describe("signature : périmètre", () => {
  it("le client de la paire obtient une signature de 3600 s du bucket message-media, jamais le service role", async () => {
    as(CLIENT, "client")
    const out = await askClient()
    expect(out).toEqual({ media: { [ID(1)]: signedUrl(`${STUDENT}/a.png`) } })
    expect(signCalls).toEqual([{ bucket: "message-media", paths: [`${STUDENT}/a.png`], ttl: 3600 }])
    expect(state.serviceCalls).toBe(0)
  })

  it("un client sans lien avec la mission (autre client, même identifiants) n'obtient rien", async () => {
    as(OTHER_CLIENT, "client")
    expect(await askClient()).toEqual({ error: expect.stringMatching(/pas disponible/) })
    expect(signCalls).toEqual([])
  })

  it("mission d'un autre client : refus ; message d'une autre mission de la même paire : absent", async () => {
    as(CLIENT, "client")
    expect(await askClient({ missionId: M_OTHER })).toEqual({ error: expect.stringMatching(/pas disponible/) })
    db.messages.push(msg({ id: ID(2), mission_id: M_OTHER, media_url: pub(STUDENT, "b.png") }))
    const out = await askClient({ messageIds: [ID(1), ID(2)] })
    expect(Object.keys(out.media)).toEqual([ID(1)])
    expect(signCalls[0].paths).toEqual([`${STUDENT}/a.png`])
  })

  it("message d'un autre expéditeur (hors paire) dans la même mission : absent, jamais signé", async () => {
    as(CLIENT, "client")
    db.messages.push(msg({ id: ID(3), sender_id: STRANGER, media_url: pub(STRANGER, "z.png") }))
    db.messages.push(msg({ id: ID(4), sender_id: STRANGER, receiver_id: OTHER_CLIENT, media_url: pub(STRANGER, "y.png") }))
    const out = await askClient({ messageIds: [ID(3), ID(4)] })
    expect(out).toEqual({ media: {} })
    expect(signCalls).toEqual([])
  })

  it("l'étudiant sans candidature ne peut pas demander de signature", async () => {
    as(STRANGER, "student")
    expect(await askStudent()).toEqual({ error: expect.stringMatching(/pas disponible/) })
    expect(signCalls).toEqual([])
  })

  it("entrées invalides : plus de 50 ids, non uuid, vide, objet, injection de filtre", async () => {
    as(CLIENT, "client")
    const bad = [
      Array.from({ length: 51 }, (_, i) => ID(i + 1)),
      ["../../etc/passwd"],
      [ID(1) + ",or(1=1)"],
      [],
      "pas-un-tableau",
      [{ id: ID(1) }],
      [null],
    ]
    for (const messageIds of bad) {
      expect(await askClient({ messageIds })).toEqual({ error: expect.stringMatching(/pas valide/) })
    }
    expect(await askClient({ studentId: "not-a-uuid" })).toEqual({ error: expect.stringMatching(/pas valide/) })
    expect(await askClient({ missionId: undefined })).toEqual({ error: expect.stringMatching(/pas disponible|pas valide/) })
    expect(signCalls).toEqual([])
  })
})

describe("media_url hostile en base : jamais signé, jamais renvoyé tel quel", () => {
  const hostile = {
    externe: "https://evil.example/storage/v1/object/public/message-media/" + STUDENT + "/a.png",
    externeHttp: "http://example.supabase.co/../evil",
    schemaJs: "javascript:alert(1)",
    data: "data:text/html;base64,PHNjcmlwdD4=",
    point: pub(STUDENT, "../" + CLIENT + "/secret.png"),
    pointEncode: pub(STUDENT, "%2e%2e/" + CLIENT + "/secret.png"),
    pointEncodeMaj: pub(STUDENT, "%2E%2E%2F" + CLIENT + "/secret.png"),
    antislash: pub(STUDENT, "..\\" + CLIENT + "/secret.png"),
    autreDossier: pub(CLIENT, "secret.png"),
    dossierTiers: pub(STRANGER, "secret.png"),
    autreBucket: `${ORIGIN}/storage/v1/object/public/avatars/${STUDENT}/a.png`,
    autreBucketSigne: `${ORIGIN}/storage/v1/object/sign/documents/${STUDENT}/a.png?token=t`,
    cheminBrutAutre: `${CLIENT}/a.png`,
    dossierSeul: pub(STUDENT, ""),
    vide: "",
    nul: null,
    nombre: 42,
    objet: { url: pub(STUDENT, "a.png") },
    userinfo: `https://evil.example@example.supabase.co.evil.example/storage/v1/object/public/message-media/${STUDENT}/a.png`,
    sousDomaine: `https://example.supabase.co.evil.example/storage/v1/object/public/message-media/${STUDENT}/a.png`,
  }

  for (const [name, value] of Object.entries(hostile)) {
    it(`${name} : null, aucune signature, aucune adresse brute`, async () => {
      as(CLIENT, "client")
      db.messages[0].media_url = value
      const out = await askClient()
      expect(out).toEqual({ media: { [ID(1)]: null } })
      const conv = await getClientConversation({ missionId: M1, studentId: STUDENT })
      const m = conv.conversation.messages.find((x) => x.id === ID(1))
      expect(m.mediaUrl).toBeNull()
      expect(m.mediaPath).toBeNull()
      expect(signCalls).toEqual([])
      expect(JSON.stringify([out, conv])).not.toContain("evil.example")
      expect(JSON.stringify([out, conv])).not.toContain("/object/public/")
    })
  }

  it("ligne de type texte ou position portant un media_url : aucun média, aucune signature", async () => {
    as(CLIENT, "client")
    db.messages[0].type = "text"
    expect(await askClient()).toEqual({ media: {} })
    db.messages[0].type = "location"
    expect(await askClient()).toEqual({ media: {} })
    const conv = await getClientConversation({ missionId: M1, studentId: STUDENT })
    expect(conv.conversation.messages.every((m) => m.mediaUrl === null && m.mediaPath === null)).toBe(true)
    expect(signCalls).toEqual([])
  })

  it("URL signée déjà expirée en base : ré-signée depuis le chemin, le jeton périmé n'est jamais renvoyé", async () => {
    as(CLIENT, "client")
    db.messages[0].media_url = `${ORIGIN}/storage/v1/object/sign/message-media/${STUDENT}/a.png?token=EXPIRE`
    const out = await askClient()
    expect(out.media[ID(1)]).toBe(signedUrl(`${STUDENT}/a.png`))
    expect(JSON.stringify(out)).not.toContain("EXPIRE")
    expect(signCalls[0].paths).toEqual([`${STUDENT}/a.png`])
  })

  it("le chemin signé vient de la ligne, jamais de l'entrée : un chemin dans messageIds est refusé", async () => {
    as(CLIENT, "client")
    const out = await askClient({ messageIds: [`${CLIENT}/secret.png`] })
    expect(out).toEqual({ error: expect.stringMatching(/pas valide/) })
    expect(signCalls).toEqual([])
  })
})

describe("stockage hostile ou défaillant : aucune adresse non signée n'est renvoyée", () => {
  const bad = {
    publique: `${ORIGIN}/storage/v1/object/public/message-media/${STUDENT}/a.png`,
    externe: `https://evil.example/storage/v1/object/sign/message-media/${STUDENT}/a.png?token=t`,
    autreBucket: `${ORIGIN}/storage/v1/object/sign/avatars/${STUDENT}/a.png?token=t`,
    traversee: `${ORIGIN}/storage/v1/object/sign/message-media/../avatars/x.png?token=t`,
    traverseeEncodee: `${ORIGIN}/storage/v1/object/sign/message-media/%2e%2e/avatars/x.png?token=t`,
    racine: `${ORIGIN}/storage/v1/object/sign/message-media/`,
    schema: "javascript:alert(1)",
    vide: "",
  }
  for (const [name, value] of Object.entries(bad)) {
    it(`signedUrl ${name} : null`, async () => {
      as(CLIENT, "client")
      signedOverride = value
      expect(await askClient()).toEqual({ media: { [ID(1)]: null } })
      const conv = await getClientConversation({ missionId: M1, studentId: STUDENT })
      expect(conv.conversation.messages[0].mediaUrl).toBeNull()
    })
  }

  it("la signature est refusée par la règle de lecture (non participant) : null", async () => {
    as(CLIENT, "client")
    db.messages[0].receiver_id = OTHER_CLIENT // le message n'est plus lisible par la session côté stockage
    db.messages[0].sender_id = STUDENT
    // la lecture de table (RLS simulée absente) renvoie la ligne mais isPairRow l'écarte : rien n'est signé
    expect(await askClient()).toEqual({ media: {} })
    expect(signCalls).toEqual([])
  })
})

describe("safeSignedMediaUrl / mediaPathOf / toMessage (unitaire)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN))

  it("n'accepte que /object/sign/message-media/ du projet", () => {
    const ok = `${ORIGIN}/storage/v1/object/sign/message-media/${STUDENT}/a.png?token=abc`
    expect(safeSignedMediaUrl(ok)).toBe(ok)
    for (const v of [
      `${ORIGIN}/storage/v1/object/public/message-media/${STUDENT}/a.png`,
      `${ORIGIN}/storage/v1/object/authenticated/message-media/${STUDENT}/a.png`,
      `${ORIGIN}/storage/v1/object/sign/avatars/${STUDENT}/a.png?token=abc`,
      `${ORIGIN}/storage/v1/object/sign/message-mediaX/${STUDENT}/a.png?token=abc`,
      `${ORIGIN}:8443/storage/v1/object/sign/message-media/${STUDENT}/a.png?token=abc`,
      `ftp://example.supabase.co/storage/v1/object/sign/message-media/${STUDENT}/a.png`,
      `//example.supabase.co/storage/v1/object/sign/message-media/${STUDENT}/a.png`,
      undefined,
      null,
      {},
    ]) {
      expect(safeSignedMediaUrl(v), String(v)).toBeNull()
    }
  })

  it("un segment %2E%2E est normalisé par le parseur d'URL : le résultat reste sous /object/sign/message-media/ du projet", () => {
    const out = safeSignedMediaUrl(`${ORIGIN}/storage/v1/object/sign/message-media/${STUDENT}/%2E%2E/x.png?token=abc`)
    expect(out === null || out.startsWith(`${ORIGIN}/storage/v1/object/sign/message-media/`)).toBe(true)
  })

  it("sans NEXT_PUBLIC_SUPABASE_URL valide : tout est refusé (fail-closed)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(safeSignedMediaUrl(`${ORIGIN}/storage/v1/object/sign/message-media/${STUDENT}/a.png?token=abc`)).toBeNull()
    expect(mediaPathOf(pub(STUDENT, "a.png"), STUDENT)).toBeNull()
  })

  it("mediaPathOf exige le dossier de l'expéditeur et accepte public, signée et chemin brut (compatibilité bucket public ou privé)", () => {
    expect(mediaPathOf(pub(STUDENT, "a.png"), STUDENT)).toBe(`${STUDENT}/a.png`)
    expect(mediaPathOf(signedUrl(`${STUDENT}/a.png`), STUDENT)).toBe(`${STUDENT}/a.png`)
    expect(mediaPathOf(`${STUDENT}/a.png`, STUDENT)).toBe(`${STUDENT}/a.png`)
    expect(mediaPathOf(pub(STUDENT, "a.png"), CLIENT)).toBeNull()
    expect(mediaPathOf(pub(STUDENT, "a.png"), undefined)).toBeNull()
  })

  it("toMessage ne copie jamais media_url dans mediaUrl, même si elle ressemble à une adresse signée valide", () => {
    const row = msg({ media_url: signedUrl(`${STUDENT}/a.png`) })
    const m = toMessage(row, CLIENT)
    expect(m.mediaUrl).toBeNull()
    expect(m.mediaPath).toBe(`${STUDENT}/a.png`)
    expect(JSON.stringify(m)).not.toContain("token=")
  })
})

describe("compatibilité avant le script 62 (compartiment encore public)", () => {
  it("la logique ne lit jamais l'état public du compartiment et ne sert jamais l'adresse publique", async () => {
    as(CLIENT, "client")
    const conv = await getClientConversation({ missionId: M1, studentId: STUDENT })
    expect(conv.conversation.messages[0].mediaUrl).toBe(signedUrl(`${STUDENT}/a.png`))
    // une ligne ancienne (URL publique en base) et une ligne nouvelle (même format) : même résultat
    expect(JSON.stringify(conv)).not.toContain("/object/public/")
  })
})
