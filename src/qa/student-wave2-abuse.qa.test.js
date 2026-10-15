// QA indépendante RD-STUDENT-01 (recette finale) : tests d'abus des actions étudiant, actions RÉELLES (requireRole,
// getMyProfile, verificationFromRows réels) sur une base en mémoire inscriptible (fake-supabase-rw).
// Couvre : isolation entre étudiants (candidatures, portefeuille, messages, avis), mission d'un autre étudiant retenu
// (aucune fuite), candidature (6 statuts, échéance, appel direct), envoi de message vers un destinataire forgé, avis
// (non terminée, autre étudiant, double envoi simultané), saisie hostile, chemins de fichiers hostiles.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { makeRW } from "./fixtures/fake-supabase-rw"

const ctx = { db: {}, writes: [], log: [], user: null, unique: {}, yield: false }
const fake = () => makeRW(ctx)

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  redirect: (to) => { throw new Error(`REDIRECT:${to}`) },
  unstable_rethrow: () => {},
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => fake() }))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn(async () => ({})) }))
vi.mock("@/lib/actions/auth.actions", () => ({ getCurrentUser: async () => ctx.user }))

import { apply } from "@/lib/actions/application.actions"
import { getStudentApplicationsView } from "@/lib/actions/student-applications.actions"
import { getStudentWallet, getStudentWalletMore } from "@/lib/actions/student-wallet.actions"
import { getWallet, getWalletTransactions, initiateWithdrawal } from "@/lib/actions/wallet.actions"
import { getStudentConversations, getStudentConversation, sendStudentMessage, markStudentConversationRead } from "@/lib/actions/message.actions"
import { createStudentReview, getStudentReviewPage } from "@/lib/actions/review.actions"
import { getStudentMissionDetail } from "@/lib/actions/student-mission-detail.actions"
import { saveStudentCardUrl, updateStudentProfile } from "@/lib/actions/profile.actions"
import { saveStudentProfile } from "@/lib/actions/student-profile.actions"
import { getStudentExplore } from "@/lib/actions/student-explore.actions"

const id = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`
const S1 = id(1), S2 = id(2), CL = id(3), CL2 = id(4)
const M_OPEN = id(10), M_PROG1 = id(11), M_PROG2 = id(12), M_DONE1 = id(13), M_DONE2 = id(14), M_CANC = id(15), M_FOREIGN_OPEN = id(16), M_NOAPP = id(17), M_OVERDUE = id(18), M_OWN = id(19)
const SECRET = "TITRE-SECRET-AUTRE-ETUDIANT"
const plus = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)
const iso = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60_000).toISOString()

function seed() {
  ctx.user = { id: S1, user_metadata: { role: "student" } }
  ctx.writes = []
  ctx.log = []
  ctx.yield = false
  ctx.unique = { reviews: ["mission_id", "reviewer_id"], applications: ["mission_id", "student_id"] }
  ctx.db = {
    profiles: [
      { user_id: S1, role: "student", full_name: "Awa Kpossou", city: "Cotonou", is_suspended: false, is_verified: true, verified_until: plus(200), phone: "+22997000001", rejection_reason: null, avatar_url: null },
      { user_id: S2, role: "student", full_name: "Boris Tokpa", city: "Cotonou", is_suspended: false, is_verified: true, verified_until: plus(200), phone: "+22997000002", rejection_reason: null },
      { user_id: CL, role: "client", full_name: "Mawuli Agbessi", city: "Cotonou", is_suspended: false, phone: "+22997111111", avatar_url: "https://evil.example/pixel.gif" },
      { user_id: CL2, role: "client", full_name: "Nadège Koura", city: "Cotonou", is_suspended: false, phone: "+22997222222", avatar_url: null },
    ],
    student_profiles: [{ user_id: S1, card_url: `${S1}/card.jpg`, school: "UAC", skills: [] }, { user_id: S2, card_url: `${S2}/card.jpg` }],
    missions: [
      { id: M_OPEN, title: "Cours de maths", description: "d", type: "Cours particuliers", city: "Cotonou", budget: 10000, urgency: "low", deadline: plus(20), status: "open", client_id: CL, selected_student_id: null, created_at: iso(500), updated_at: iso(500) },
      { id: M_PROG1, title: "Mission en cours S1", description: "d", type: "Saisie", city: "Cotonou", budget: 20000, deadline: null, status: "in_progress", client_id: CL, selected_student_id: S1, created_at: iso(900), updated_at: iso(300) },
      { id: M_PROG2, title: SECRET, description: "DESCRIPTION-SECRETE", type: "Saisie", city: "Porto-Novo", budget: 77777, deadline: null, status: "in_progress", client_id: CL2, selected_student_id: S2, created_at: iso(900), updated_at: iso(300) },
      { id: M_DONE1, title: "Terminée S1", description: "d", type: "Traduction", city: "Cotonou", budget: 8000, deadline: null, status: "done", client_id: CL, selected_student_id: S1, created_at: iso(5000), updated_at: iso(1000) },
      { id: M_DONE2, title: SECRET + "-DONE", description: "d", type: "Traduction", city: "Cotonou", budget: 55555, deadline: null, status: "done", client_id: CL2, selected_student_id: S2, created_at: iso(5000), updated_at: iso(1000) },
      { id: M_CANC, title: "Annulée S1", description: "d", type: "Autre", city: "Cotonou", budget: 5000, deadline: null, status: "cancelled", client_id: CL, selected_student_id: S1, created_at: iso(5000), updated_at: iso(1000) },
      { id: M_FOREIGN_OPEN, title: "Ouverte autre client", description: "d", type: "Saisie", city: "Cotonou", budget: 6000, deadline: plus(10), status: "open", client_id: CL2, selected_student_id: null, created_at: iso(500), updated_at: iso(500) },
      { id: M_NOAPP, title: "Sans lien avec S1", description: "d", type: "Autre", city: "Cotonou", budget: 6000, deadline: plus(10), status: "open", client_id: CL2, selected_student_id: null, created_at: iso(500), updated_at: iso(500) },
      { id: M_OVERDUE, title: "Échéance dépassée", description: "d", type: "Saisie", city: "Cotonou", budget: 6000, deadline: plus(-1), status: "open", client_id: CL2, selected_student_id: null, created_at: iso(500), updated_at: iso(500) },
      { id: M_OWN, title: "Mission publiée par S1", description: "d", type: "Saisie", city: "Cotonou", budget: 6000, deadline: plus(10), status: "open", client_id: S1, selected_student_id: null, created_at: iso(500), updated_at: iso(500) },
    ],
    applications: [
      { id: id(100), mission_id: M_OPEN, student_id: S1, status: "pending", message: "Bonjour", created_at: iso(60), updated_at: iso(60) },
      { id: id(101), mission_id: M_PROG1, student_id: S1, status: "accepted", message: "Bonjour", created_at: iso(900), updated_at: iso(300) },
      { id: id(102), mission_id: M_PROG2, student_id: S2, status: "accepted", message: "MOTIVATION-SECRETE-S2", created_at: iso(900), updated_at: iso(300) },
      { id: id(103), mission_id: M_DONE1, student_id: S1, status: "accepted", message: "m", created_at: iso(5000), updated_at: iso(1000) },
      { id: id(104), mission_id: M_DONE2, student_id: S2, status: "accepted", message: "m", created_at: iso(5000), updated_at: iso(1000) },
      { id: id(105), mission_id: M_CANC, student_id: S1, status: "accepted", message: "m", created_at: iso(5000), updated_at: iso(1000) },
      { id: id(106), mission_id: M_FOREIGN_OPEN, student_id: S2, status: "pending", message: "m", created_at: iso(500), updated_at: iso(500) },
    ],
    wallets: [{ user_id: S1, balance: 47000, reserved: 0 }, { user_id: S2, balance: 999999, reserved: 0 }, { user_id: CL, balance: 5, reserved: 0 }],
    wallet_transactions: [
      { id: id(200), user_id: S1, type: "release", amount: 7040, mission_id: M_DONE1, created_at: iso(1000), status: "completed" },
      { id: id(201), user_id: S2, type: "release", amount: 48888, mission_id: M_DONE2, created_at: iso(1000), status: "completed" },
      { id: id(202), user_id: CL, type: "escrow", amount: -8000, mission_id: M_DONE1, created_at: iso(1000), status: "completed" },
      { id: id(203), user_id: CL, type: "commission", amount: 960, mission_id: M_DONE1, created_at: iso(1000), status: "completed" },
    ],
    messages: [
      { id: id(300), mission_id: M_PROG1, sender_id: CL, receiver_id: S1, content: "Bonjour S1", type: "text", read: false, created_at: iso(30) },
      { id: id(301), mission_id: M_PROG1, sender_id: S1, receiver_id: CL, content: "Réponse S1", type: "text", read: true, created_at: iso(20) },
      { id: id(302), mission_id: M_PROG2, sender_id: CL2, receiver_id: S2, content: "MESSAGE-SECRET-S2", type: "text", read: false, created_at: iso(10) },
      // Message forgé : un tiers (S2) écrit à S1 sur la mission de S1 (la politique de base le laisse passer).
      { id: id(303), mission_id: M_PROG1, sender_id: S2, receiver_id: S1, content: "MESSAGE-FORGE-TIERS", type: "text", read: false, created_at: iso(5) },
      // Message du client CL2 vers S1 sur une mission de CL (interlocuteur qui n'est pas le client de la mission).
      { id: id(304), mission_id: M_PROG1, sender_id: CL2, receiver_id: S1, content: "MESSAGE-FORGE-CLIENT2", type: "text", read: false, created_at: iso(4) },
      { id: id(305), mission_id: M_DONE1, sender_id: CL, receiver_id: S1, content: "Autre mission, non lu", type: "text", read: false, created_at: iso(3) },
    ],
    reviews: [{ id: id(400), mission_id: M_DONE2, reviewer_id: S2, reviewed_id: CL2, rating: 5, comment: "AVIS-SECRET-S2", created_at: iso(500) }],
  }
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  seed()
})

const dump = (v) => JSON.stringify(v)
const asRole = (role, extra = {}) => {
  ctx.db.profiles.find((p) => p.user_id === S1).role = role
  Object.assign(ctx.db.profiles.find((p) => p.user_id === S1), extra)
}

describe("garde de rôle commune : toute action étudiant refuse client, suspendu, sans session", () => {
  const calls = {
    applications: () => getStudentApplicationsView({}),
    wallet: () => getStudentWallet({}),
    conversations: () => getStudentConversations(),
    conversation: () => getStudentConversation({ missionId: M_PROG1 }),
    send: () => sendStudentMessage({ missionId: M_PROG1, type: "text", content: "x" }),
    read: () => markStudentConversationRead({ missionId: M_PROG1 }),
    review: () => createStudentReview({ missionId: M_DONE1, rating: 5 }),
    reviewPage: () => getStudentReviewPage(M_DONE1),
    detail: () => getStudentMissionDetail(M_OPEN),
    apply: () => apply({ missionId: M_OPEN, message: "x" }),
    explore: () => getStudentExplore({}),
  }
  const refused = (name, r) => {
    const s = dump(r)
    if (name === "reviewPage" || name === "detail") return expect(r).toBeNull()
    if (name === "conversation") return expect(r.error ?? r.notFound).toBeTruthy()
    expect(r.error, `${name}: ${s}`).toBeTruthy()
  }
  for (const [name, call] of Object.entries(calls)) {
    it(`${name} : un client est refusé, sans lecture ni écriture de données`, async () => {
      asRole("client")
      const before = ctx.writes.length
      const r = await call()
      refused(name, r)
      expect(ctx.writes.length).toBe(before)
      expect(dump(r)).not.toContain("Bonjour S1")
    })
    it(`${name} : un compte suspendu est refusé`, async () => {
      asRole("student", { is_suspended: true })
      refused(name, await call())
    })
    it(`${name} : sans session, refusé`, async () => {
      ctx.user = null
      refused(name, await call())
    })
    it(`${name} : user_metadata forgé (role=student) sur un profil client est refusé`, async () => {
      asRole("client")
      ctx.user = { id: S1, user_metadata: { role: "student" }, app_metadata: { role: "student" } }
      refused(name, await call())
    })
  }
})

describe("isolation : candidatures", () => {
  it("l'étudiant 1 ne voit jamais les candidatures, titres ni messages de motivation de l'étudiant 2", async () => {
    for (const onglet of [undefined, "en-attente", "en-cours", "terminees", "non-retenues", "zzz", ["en-cours"], { a: 1 }, "' or 1=1 --", "__proto__"]) {
      const r = await getStudentApplicationsView({ onglet })
      expect(r.error).toBeUndefined()
      const s = dump(r)
      expect(s).not.toContain(SECRET)
      expect(s).not.toContain("MOTIVATION-SECRETE-S2")
      expect(s).not.toContain("77777")
    }
  })
  it("compteurs et total ne comptent que l'étudiant de la session", async () => {
    const r = await getStudentApplicationsView({})
    expect(r.data.total).toBe(4)
    expect(Object.values(r.data.counts).reduce((a, b) => a + b, 0)).toBe(4)
  })
  it("une lecture filtre toujours sur student_id = session", async () => {
    await getStudentApplicationsView({})
    const reads = ctx.log.filter((q) => q.table === "applications")
    expect(reads.length).toBeGreaterThan(0)
    for (const q of reads) expect(q.filters.some(([k, c, v]) => k === "eq" && c === "student_id" && v === S1)).toBe(true)
  })
  it("ne renvoie aucune colonne privée du client (téléphone, avatar externe) ni d'identifiant de client", async () => {
    const s = dump(await getStudentApplicationsView({ onglet: "en-cours" }))
    expect(s).not.toContain("+22997111111")
    expect(s).not.toContain("evil.example")
    expect(s).not.toContain(CL)
  })
  it("lecture en échec : message neutre, aucun détail SQL", async () => {
    ctx.failures = { "applications:select": "relation \"applications\" does not exist" }
    const r = await getStudentApplicationsView({})
    ctx.failures = undefined
    expect(r.error).toBe("Impossible de charger vos candidatures.")
    expect(dump(r)).not.toContain("relation")
  })
})

describe("isolation : portefeuille", () => {
  it("le solde et l'historique sont ceux de la session, jamais ceux d'un autre étudiant", async () => {
    const r = await getStudentWallet({})
    expect(r.data.wallet.available).toBe(47000)
    const s = dump(r)
    expect(s).not.toContain("48888")
    expect(s).not.toContain("999999")
    expect(r.data.gains.total).toBe(7040)
  })
  it("getWallet et getWalletTransactions refusent l'identifiant d'un autre utilisateur", async () => {
    expect((await getWallet(S2)).error).toBeTruthy()
    expect((await getWalletTransactions(S2)).error).toBeTruthy()
    expect((await getWallet(CL)).error).toBeTruthy()
    const own = await getWallet(S1)
    expect(own.available).toBe(47000)
  })
  it("filtre hostile et offset hostile : aucune fuite, aucune exception", async () => {
    for (const filtre of ["zzz", "' or 1=1", ["retraits"], { $ne: 1 }, "__proto__", "a".repeat(5000)]) {
      const r = await getStudentWallet({ filtre })
      expect(r.error).toBeUndefined()
      expect(dump(r)).not.toContain("48888")
    }
    for (const offset of [-5, 1.5, "10", NaN, Infinity, 1e12, null, {}]) {
      const r = await getStudentWalletMore({ filtre: "tout", offset })
      expect(dump(r)).not.toContain("48888")
    }
  })
  it("le grand livre d'une mission ne lit que les lignes release de l'étudiant (pas escrow ni commission du client)", async () => {
    const d = await getStudentMissionDetail(M_DONE1)
    expect(d.ledger).toEqual([{ type: "release", amount: 7040, createdAt: expect.any(String) }])
  })
  it("retrait : un montant supérieur au disponible est refusé avant tout appel réseau", async () => {
    const r = await initiateWithdrawal({ amount: 10_000_000, phone: "0197000001", operator: "mtn" })
    expect(r.error).toBeTruthy()
    expect(r.success).toBeUndefined()
  })
})

describe("isolation : messages", () => {
  it("la liste ne contient que les paires légitimes : ni message d'un tiers, ni message d'une autre mission", async () => {
    const r = await getStudentConversations()
    expect(r.error).toBeUndefined()
    const s = dump(r)
    expect(s).not.toContain("MESSAGE-SECRET-S2")
    expect(s).not.toContain("MESSAGE-FORGE-TIERS")
    expect(s).not.toContain("MESSAGE-FORGE-CLIENT2")
    expect(s).not.toContain(SECRET)
    expect(s).not.toContain("+22997111111")
    expect(s).not.toContain("evil.example")
    expect(r.conversations.map((c) => c.missionId).sort()).toEqual([M_DONE1, M_PROG1].sort())
  })
  it("le compteur de non lus de la liste ignore les messages forgés", async () => {
    const r = await getStudentConversations()
    const c = r.conversations.find((x) => x.missionId === M_PROG1)
    expect(c.unreadCount).toBe(1)
  })
  it("conversation d'une mission d'un autre étudiant, inexistante, mal formée ou piégée : introuvable sans fuite", async () => {
    for (const missionId of [M_PROG2, M_DONE2, M_NOAPP, M_FOREIGN_OPEN, id(999), "zzz", "", null, undefined, "' or 1=1", { x: 1 }, [M_PROG1]]) {
      const r = await getStudentConversation({ missionId })
      expect(r.notFound, dump(missionId)).toBe(true)
      expect(dump(r)).not.toContain("SECRET")
    }
  })
  it("la conversation d'une mission retenue ne renvoie que la paire (étudiant, client de la mission), lignes forgées exclues", async () => {
    const r = await getStudentConversation({ missionId: M_PROG1 })
    const s = dump(r)
    expect(s).toContain("Bonjour S1")
    expect(s).toContain("Réponse S1")
    expect(s).not.toContain("MESSAGE-FORGE-TIERS")
    expect(s).not.toContain("MESSAGE-FORGE-CLIENT2")
    expect(s).not.toContain(S2)
    expect(r.conversation.canWrite).toBe(true)
  })
  it("l'avatar externe du client n'est jamais renvoyé (pixel de suivi)", async () => {
    const r = await getStudentConversation({ missionId: M_PROG1 })
    expect(r.conversation.client.avatarUrl).toBeNull()
  })
  it("un passage de la requête avec un autre studentId / clientId / receiver dans l'entrée est ignoré", async () => {
    const r = await getStudentConversation({ missionId: M_PROG2, studentId: S2, clientId: CL2, other: CL2 })
    expect(r.notFound).toBe(true)
  })
})

describe("envoi de message : destinataire forgé et contenus hostiles", () => {
  it("le destinataire est le client de la mission, quel que soit receiver_id/sender_id/studentId fournis", async () => {
    const r = await sendStudentMessage({ missionId: M_PROG1, type: "text", content: "Bonjour", receiver_id: S2, receiverId: S2, sender_id: S2, studentId: S2, clientId: CL2, to: CL2 })
    expect(r.success).toBe(true)
    const row = ctx.db.messages.at(-1)
    expect(row.receiver_id).toBe(CL)
    expect(row.sender_id).toBe(S1)
    expect(row.mission_id).toBe(M_PROG1)
  })
  it("mission d'un autre étudiant, d'un autre client, sans candidature : refus, aucune écriture", async () => {
    const before = ctx.db.messages.length
    for (const missionId of [M_PROG2, M_DONE2, M_NOAPP, M_FOREIGN_OPEN, id(999)]) {
      const r = await sendStudentMessage({ missionId, type: "text", content: "salut", receiver_id: CL2 })
      expect(r.error, missionId).toBeTruthy()
    }
    expect(ctx.db.messages.length).toBe(before)
  })
  it("conversations en lecture seule (annulée, terminée, mission attribuée à un autre) : refus", async () => {
    ctx.db.applications.push({ id: id(120), mission_id: M_PROG2, student_id: S1, status: "pending", message: "m", created_at: iso(1), updated_at: iso(1) })
    const before = ctx.db.messages.length
    for (const missionId of [M_CANC, M_DONE1, M_PROG2]) {
      const r = await sendStudentMessage({ missionId, type: "text", content: "salut" })
      expect(r.error, missionId).toBeTruthy()
    }
    expect(ctx.db.messages.length).toBe(before)
  })
  it("candidature refusée sur mission ouverte : lecture seule", async () => {
    ctx.db.applications.find((a) => a.id === id(100)).status = "rejected"
    const r = await sendStudentMessage({ missionId: M_OPEN, type: "text", content: "salut" })
    expect(r.error).toBeTruthy()
  })
  it("texte vide, espaces, caractères de contrôle, 2001 caractères, non-chaîne : refusés", async () => {
    const bad = ["", "   ", "a\u0000b", "a\u0007b", "x".repeat(2001), 42, null, { toString: () => "x" }, ["x"]]
    for (const content of bad) {
      const r = await sendStudentMessage({ missionId: M_PROG1, type: "text", content })
      expect(r.error, dump(content)).toBeTruthy()
    }
    expect(ctx.writes.filter((w) => w.table === "messages")).toHaveLength(0)
  })
  it("texte hostile (balises, injection, sauts de ligne, emoji) : stocké littéralement et renvoyé tel quel, jamais interprété", async () => {
    const text = "<script>alert(1)</script>\n' OR 1=1; --\n😀 %s ${x} {{7*7}}"
    const r = await sendStudentMessage({ missionId: M_PROG1, type: "text", content: text })
    expect(r.success).toBe(true)
    expect(r.message.content).toBe(text.trim())
  })
  it("type inconnu, missionId piégé, entrée nulle : refusés", async () => {
    for (const input of [null, undefined, "x", [], {}, { missionId: M_PROG1, type: "video", content: "x" }, { missionId: "zzz", type: "text", content: "x" }, { missionId: M_PROG1, type: "__proto__", content: "x" }]) {
      const r = await sendStudentMessage(input)
      expect(r.error).toBeTruthy()
    }
  })
  it("position : coordonnées hors bornes, NaN, chaînes, infinies refusées ; valeurs valides acceptées", async () => {
    for (const [lat, lng] of [[91, 0], [-91, 0], [0, 181], [0, -181], [NaN, 0], [Infinity, 0], ["6.37", "2.39"], [null, null], [undefined, 2]]) {
      const r = await sendStudentMessage({ missionId: M_PROG1, type: "location", lat, lng })
      expect(r.error, `${lat},${lng}`).toBeTruthy()
    }
    const ok = await sendStudentMessage({ missionId: M_PROG1, type: "location", lat: 6.3703, lng: 2.3912 })
    expect(ok.success).toBe(true)
  })
  it("chemins de médias hostiles : autre dossier, remontée, URL externe, schéma, encodage, mauvaise nature, bucket voisin", async () => {
    const hostile = [
      `${S2}/photo.png`, `${S1}/../${S2}/photo.png`, `${S1}/..%2F${S2}/p.png`, `${S1}/%2e%2e/p.png`, `/${S1}/photo.png`, `${S1}//photo.png`,
      `${S1}/`, S1, "photo.png", "https://evil.example/photo.png", "javascript:alert(1).png", "data:image/png;base64,AAAA",
      `https://example.supabase.co/storage/v1/object/public/message-media/${S2}/photo.png`,
      `https://example.supabase.co/storage/v1/object/public/avatars/${S1}/photo.png`,
      `https://example.supabase.co.evil.example/storage/v1/object/public/message-media/${S1}/photo.png`,
      `${S1}/photo.png?x=1`, `${S1}/photo.png#frag`, `${S1}\\..\\photo.png`, `${S1}/a\u0000.png`, `${S1}/photo.exe`, `${S1}/photo`, "x".repeat(400), 42, null, {}, [`${S1}/a.png`],
    ]
    for (const mediaPath of hostile) {
      const r = await sendStudentMessage({ missionId: M_PROG1, type: "image", mediaPath })
      expect(r.error, dump(mediaPath)).toBeTruthy()
      expect(r.success).toBeUndefined()
    }
    // Nature : une image déclarée vocale, un vocal déclaré image.
    expect((await sendStudentMessage({ missionId: M_PROG1, type: "voice", mediaPath: `${S1}/photo.png` })).error).toBeTruthy()
    expect((await sendStudentMessage({ missionId: M_PROG1, type: "image", mediaPath: `${S1}/note.webm` })).error).toBeTruthy()
    expect(ctx.writes.filter((w) => w.table === "messages")).toHaveLength(0)
  })
  it("média valide du dossier de l'expéditeur : l'adresse est reconstruite côté serveur (jamais reprise du navigateur)", async () => {
    const r = await sendStudentMessage({ missionId: M_PROG1, type: "image", mediaPath: `${S1}/photo.png`, mediaUrl: "https://evil.example/x.png", media_url: "https://evil.example/x.png" })
    expect(r.success).toBe(true)
    expect(ctx.db.messages.at(-1).media_url).toBe(`https://example.supabase.co/storage/v1/object/public/message-media/${S1}/photo.png`)
  })
  it("limite de débit : au plus 20 messages par minute, le 21e est refusé", async () => {
    for (let i = 0; i < 20; i++) ctx.db.messages.push({ id: id(500 + i), mission_id: M_PROG1, sender_id: S1, receiver_id: CL, content: "x", type: "text", read: false, created_at: iso(0.2) })
    const r = await sendStudentMessage({ missionId: M_PROG1, type: "text", content: "21e" })
    expect(r.error).toMatch(/trop vite/)
  })
  it("envois simultanés : documenté, le comptage n'est pas atomique (dépassement borné par le nombre d'envois parallèles)", async () => {
    ctx.yield = true
    for (let i = 0; i < 19; i++) ctx.db.messages.push({ id: id(600 + i), mission_id: M_PROG1, sender_id: S1, receiver_id: CL, content: "x", type: "text", read: false, created_at: iso(0.2) })
    const rs = await Promise.all(Array.from({ length: 5 }, (_, i) => sendStudentMessage({ missionId: M_PROG1, type: "text", content: `p${i}` })))
    const ok = rs.filter((r) => r.success).length
    expect(ok).toBeGreaterThanOrEqual(1)
    expect(ok).toBeLessThanOrEqual(5)
  })
})

describe("marquage lu", () => {
  it("ne marque que les messages reçus du client de CETTE mission", async () => {
    const r = await markStudentConversationRead({ missionId: M_PROG1 })
    expect(r.success).toBe(true)
    const byId = (n) => ctx.db.messages.find((m) => m.id === id(n))
    expect(byId(300).read).toBe(true)
    expect(byId(303).read).toBe(false) // forgé par un tiers
    expect(byId(304).read).toBe(false) // forgé par un autre client
    expect(byId(305).read).toBe(false) // autre mission
    expect(byId(302).read).toBe(false) // message d'un autre étudiant
  })
  it("mission d'un autre étudiant ou mal formée : refus, aucune écriture", async () => {
    for (const missionId of [M_PROG2, M_NOAPP, "zzz", null, undefined, { a: 1 }]) {
      const r = await markStudentConversationRead({ missionId })
      expect(r.error).toBeTruthy()
    }
    expect(ctx.writes.filter((w) => w.op === "update")).toHaveLength(0)
  })
  it("la seule colonne modifiée est `read`", async () => {
    await markStudentConversationRead({ missionId: M_PROG1 })
    const w = ctx.writes.filter((x) => x.op === "update")
    expect(w).toHaveLength(1)
    expect(Object.keys(w[0].payload)).toEqual(["read"])
  })
})

describe("avis du client (E13)", () => {
  it("avis sur une mission terminée dont l'étudiant est le retenu : enregistré, noté = client de la mission (reviewed_id forgé ignoré)", async () => {
    const r = await createStudentReview({ missionId: M_DONE1, rating: 4, comment: "Très bien", reviewedId: S2, reviewed_id: S2, reviewer_id: S2, reviewerId: S2 })
    expect(r.success).toBe(true)
    const row = ctx.db.reviews.at(-1)
    expect(row).toMatchObject({ mission_id: M_DONE1, reviewer_id: S1, reviewed_id: CL, rating: 4 })
  })
  it("mission non terminée (en cours, annulée, ouverte) : refus, aucune écriture", async () => {
    for (const missionId of [M_PROG1, M_CANC, M_OPEN]) {
      const r = await createStudentReview({ missionId, rating: 5 })
      expect(r.error, missionId).toBeTruthy()
    }
    expect(ctx.db.reviews).toHaveLength(1)
  })
  it("mission d'un autre étudiant, inexistante, mal formée : refus sans fuite d'existence", async () => {
    const messages = new Set()
    for (const missionId of [M_DONE2, M_PROG2, id(999), "zzz", null, undefined, {}, [M_DONE1]]) {
      const r = await createStudentReview({ missionId, rating: 5 })
      expect(r.error, dump(missionId)).toBeTruthy()
      messages.add(r.error)
    }
    expect(ctx.db.reviews).toHaveLength(1)
    // Une mission d'un autre étudiant répond comme une mission inexistante.
    expect((await createStudentReview({ missionId: M_DONE2, rating: 5 })).error).toBe((await createStudentReview({ missionId: id(999), rating: 5 })).error)
  })
  it("double envoi séquentiel : refusé, une seule ligne", async () => {
    expect((await createStudentReview({ missionId: M_DONE1, rating: 5 })).success).toBe(true)
    expect((await createStudentReview({ missionId: M_DONE1, rating: 1 })).error).toMatch(/déjà noté/)
    expect(ctx.db.reviews.filter((r) => r.reviewer_id === S1)).toHaveLength(1)
  })
  it("double envoi SIMULTANÉ : la contrainte d'unicité tranche, une seule ligne, l'autre appel reçoit « déjà noté »", async () => {
    ctx.yield = true
    const rs = await Promise.all([createStudentReview({ missionId: M_DONE1, rating: 5 }), createStudentReview({ missionId: M_DONE1, rating: 2 }), createStudentReview({ missionId: M_DONE1, rating: 3 })])
    expect(rs.filter((r) => r.success)).toHaveLength(1)
    expect(rs.filter((r) => r.error).every((r) => /déjà noté/.test(r.error))).toBe(true)
    expect(ctx.db.reviews.filter((r) => r.reviewer_id === S1)).toHaveLength(1)
  })
  it("notes invalides : 0, 6, 2.5, '5', NaN, Infinity, null, objet : refusées", async () => {
    for (const rating of [0, 6, -1, 2.5, "5", NaN, Infinity, null, undefined, {}, [5], true]) {
      const r = await createStudentReview({ missionId: M_DONE1, rating })
      expect(r.error, dump(rating)).toBeTruthy()
    }
    expect(ctx.db.reviews).toHaveLength(1)
  })
  it("commentaire hostile : > 300, caractères de contrôle, marques bidirectionnelles, non-chaîne : refusés ; balises et SQL : stockés littéralement", async () => {
    for (const comment of ["x".repeat(301), "a\u0000b", "a‮b", "a​b", "a\u0085b", 42, {}, ["x"], true]) {
      const r = await createStudentReview({ missionId: M_DONE1, rating: 5, comment })
      expect(r.error, dump(comment)).toBeTruthy()
    }
    expect(ctx.db.reviews).toHaveLength(1)
    const text = "<img src=x onerror=alert(1)> ' OR 1=1; -- {{7*7}}"
    const ok = await createStudentReview({ missionId: M_DONE1, rating: 5, comment: text })
    expect(ok.success).toBe(true)
    expect(ctx.db.reviews.at(-1).comment).toBe(text)
  })
  it("commentaire de 300 caractères exactement : accepté ; vide ou espaces : null", async () => {
    expect((await createStudentReview({ missionId: M_DONE1, rating: 5, comment: "é".repeat(300) })).success).toBe(true)
    seed()
    const r = await createStudentReview({ missionId: M_DONE1, rating: 5, comment: "   " })
    expect(r.success).toBe(true)
    expect(ctx.db.reviews.at(-1).comment).toBeNull()
  })
  it("la page d'avis : 404 (null) pour une mission d'un autre étudiant, inexistante, mal formée ; aucune fuite", async () => {
    for (const missionId of [M_DONE2, M_PROG2, id(999), "zzz", "", null, undefined, {}, "' or 1=1"]) {
      expect(await getStudentReviewPage(missionId), dump(missionId)).toBeNull()
    }
  })
  it("la page d'avis : états formulaire / déjà noté / non terminée, avec colonnes publiques seulement", async () => {
    expect((await getStudentReviewPage(M_DONE1)).state).toBe("form")
    expect((await getStudentReviewPage(M_PROG1)).state).toBe("not_done")
    await createStudentReview({ missionId: M_DONE1, rating: 3, comment: "ok" })
    const p = await getStudentReviewPage(M_DONE1)
    expect(p.state).toBe("already")
    expect(p.review.rating).toBe(3)
    expect(dump(p)).not.toContain("+22997111111")
    expect(dump(p)).not.toContain("AVIS-SECRET-S2")
    expect(dump(p)).not.toContain(CL)
  })
})

describe("détail de mission : aucune fuite d'une mission retenue par un autre", () => {
  it("mission en cours / terminée d'un autre étudiant : { state: 'closed', mission: { id } } et rien d'autre", async () => {
    for (const missionId of [M_PROG2, M_DONE2]) {
      const r = await getStudentMissionDetail(missionId)
      expect(r).toEqual({ state: "closed", mission: { id: missionId } })
      const s = dump(r)
      for (const leak of [SECRET, "DESCRIPTION-SECRETE", "77777", "55555", "MOTIVATION-SECRETE-S2", "48888", "AVIS-SECRET-S2", CL2, "Nadège"]) expect(s).not.toContain(leak)
    }
  })
  it("mission annulée sans lien : fermée sans détail", async () => {
    ctx.db.missions.find((m) => m.id === M_NOAPP).status = "cancelled"
    expect(await getStudentMissionDetail(M_NOAPP)).toEqual({ state: "closed", mission: { id: M_NOAPP } })
  })
  it("mission ouverte : détail sans téléphone ni identifiant de client ni candidature d'un autre étudiant", async () => {
    const r = await getStudentMissionDetail(M_FOREIGN_OPEN)
    expect(r.state).toBe("open")
    expect(r.application).toBeNull() // la candidature de S2 n'est pas celle de S1
    const s = dump(r)
    expect(s).not.toContain("+2299")
    expect(s).not.toContain(CL2)
    expect(s).not.toContain("client_id")
  })
  it("mission retenue de S1 : ledger et avis de S1 seulement", async () => {
    const r = await getStudentMissionDetail(M_DONE1)
    expect(r.state).toBe("selected")
    expect(r.isSelected).toBe(true)
    expect(r.review).toBeNull()
    expect(dump(r)).not.toContain("48888")
  })
  it("identifiants piégés ou absents : null", async () => {
    for (const x of [id(999), "zzz", "", null, undefined, {}, [M_OPEN], "' or 1=1 --", "../../etc/passwd"]) {
      expect(await getStudentMissionDetail(x), dump(x)).toBeNull()
    }
  })
  it("lecture en échec : erreur neutre, pas de détail SQL", async () => {
    ctx.failures = { "missions:select": "boom: relation missions" }
    await expect(getStudentMissionDetail(M_OPEN)).rejects.toThrow("Impossible de charger la mission.")
    ctx.failures = undefined
  })
})

describe("candidature : appel direct de apply et 6 statuts de vérification", () => {
  const plusD = plus
  const STATUS = {
    not_submitted: { p: { is_verified: false, verified_until: null }, card: null, ok: false },
    pending: { p: { is_verified: false, verified_until: null }, card: `${S1}/c.jpg`, ok: true },
    verified: { p: { is_verified: true, verified_until: plusD(200) }, card: `${S1}/c.jpg`, ok: true },
    expiring: { p: { is_verified: true, verified_until: plusD(5) }, card: `${S1}/c.jpg`, ok: true },
    expired: { p: { is_verified: true, verified_until: plusD(-1) }, card: `${S1}/c.jpg`, ok: false },
    rejected: { p: { is_verified: false, verified_until: null, rejection_reason: "Photo floue" }, card: `${S1}/c.jpg`, ok: false },
  }
  for (const [key, st] of Object.entries(STATUS)) {
    it(`statut ${key} : ${st.ok ? "candidature enregistrée" : "refusée, aucune insertion"} (appel direct, sans passer par l'interface)`, async () => {
      Object.assign(ctx.db.profiles.find((p) => p.user_id === S1), st.p)
      ctx.db.student_profiles.find((p) => p.user_id === S1).card_url = st.card
      const r = await apply({ missionId: M_FOREIGN_OPEN, message: "Bonjour, je suis disponible." })
      if (st.ok) { expect(r.success).toBe(true); expect(ctx.db.applications.some((a) => a.mission_id === M_FOREIGN_OPEN && a.student_id === S1)).toBe(true) }
      else {
        expect(r.error).toBeTruthy()
        expect(ctx.writes.filter((w) => w.table === "applications")).toHaveLength(0)
        expect(dump(r)).not.toContain("Photo floue")
      }
    })
  }
  it("échéance dépassée : refusée même pour un compte vérifié", async () => {
    const r = await apply({ missionId: M_OVERDUE, message: "Bonjour" })
    expect(r.error).toMatch(/échéance/)
    expect(ctx.writes.filter((w) => w.table === "applications")).toHaveLength(0)
  })
  it("échéance aujourd'hui : acceptée (dernier jour inclus)", async () => {
    ctx.db.missions.find((m) => m.id === M_NOAPP).deadline = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date())
    expect((await apply({ missionId: M_NOAPP, message: "Bonjour" })).success).toBe(true)
  })
  it("échéance illisible ou absente : ne bloque pas, ne plante pas", async () => {
    ctx.db.missions.find((m) => m.id === M_NOAPP).deadline = "pas-une-date"
    const r = await apply({ missionId: M_NOAPP, message: "Bonjour" })
    expect(typeof (r.success ?? r.error)).not.toBe("undefined")
  })
  it("mission non ouverte (en cours, terminée, annulée) : refusée", async () => {
    for (const missionId of [M_PROG2, M_DONE2, M_CANC]) {
      expect((await apply({ missionId, message: "Bonjour" })).error, missionId).toBeTruthy()
    }
    expect(ctx.writes.filter((w) => w.table === "applications")).toHaveLength(0)
  })
  it("sa propre mission, doublon, mission inconnue, id piégé : refusés", async () => {
    expect((await apply({ missionId: M_OWN, message: "Bonjour" })).error).toBeTruthy()
    expect((await apply({ missionId: M_OPEN, message: "Bonjour" })).error).toMatch(/déjà postulé/)
    for (const missionId of [id(999), "zzz", "", null, undefined, "' or 1=1", {}]) expect((await apply({ missionId, message: "Bonjour" })).error).toBeTruthy()
    expect(ctx.writes.filter((w) => w.table === "applications")).toHaveLength(0)
  })
  it("motivation hostile : vide, espaces, non-chaîne, 501 caractères : refusées ; balises/SQL : enregistrées littéralement", async () => {
    for (const message of ["", "   \n\t", null, undefined, 42, {}, ["x"], "x".repeat(501)]) {
      expect((await apply({ missionId: M_NOAPP, message })).error, dump(message)).toBeTruthy()
    }
    expect(ctx.writes.filter((w) => w.table === "applications")).toHaveLength(0)
    const hostile = "<script>alert(1)</script> ' OR 1=1; --"
    expect((await apply({ missionId: M_NOAPP, message: hostile })).success).toBe(true)
    expect(ctx.db.applications.at(-1).message).toBe(hostile)
  })
  it("motivation de 500 caractères exactement : acceptée", async () => {
    expect((await apply({ missionId: M_NOAPP, message: "é".repeat(500) })).success).toBe(true)
  })
  it("champs forgés (student_id, status, mission_id) ignorés : la ligne porte la session et « pending »", async () => {
    await apply({ missionId: M_NOAPP, message: "Bonjour", student_id: S2, studentId: S2, status: "accepted" })
    expect(ctx.db.applications.at(-1)).toMatchObject({ mission_id: M_NOAPP, student_id: S1, status: "pending" })
  })
  it("deux envois simultanés : documenté, une contrainte d'unicité en base doit trancher (ici : au plus une ligne)", async () => {
    ctx.yield = true
    const rs = await Promise.all([apply({ missionId: M_NOAPP, message: "a" }), apply({ missionId: M_NOAPP, message: "b" })])
    expect(ctx.db.applications.filter((a) => a.mission_id === M_NOAPP && a.student_id === S1)).toHaveLength(1)
    expect(rs.filter((r) => r.success).length).toBeGreaterThanOrEqual(1)
  })
})

describe("saisie hostile : recherche de l'explorateur", () => {
  const hostile = ["x%_,(a)*\\<b>", "%", "_", "\\", ",", ")", "(", "a,b.eq.1", "title.ilike.%", "'; DROP TABLE missions; --", "\u0000\u0001", "é".repeat(500), "😀".repeat(200), "*", "%25", "a%00b"]
  it("n'échoue jamais et n'injecte aucune condition dans or()", async () => {
    for (const q of hostile) {
      const r = await getStudentExplore({ q })
      expect(r.error, q).toBeUndefined()
      for (const query of ctx.log.filter((x) => x.table === "missions")) {
        for (const o of query.ors) {
          expect(o).not.toMatch(/DROP TABLE/)
        }
      }
    }
  })
  it("valeurs non chaînes (tableau, objet, nombre, null, prototype) : refusées en douceur", async () => {
    for (const q of [["a", "b"], { a: 1 }, 42, null, undefined, "__proto__"]) {
      const r = await getStudentExplore({ q, type: { x: 1 }, cities: [{}], budget: ["1-2"], sort: 7, page: "1e9" })
      expect(r.error).toBeUndefined()
    }
  })
  it("page absurde : bornée, sans erreur", async () => {
    for (const page of [-1, 0, 1e9, "99999999999999999999", NaN, Infinity, "abc"]) {
      const r = await getStudentExplore({ page })
      expect(r.error, dump(page)).toBeUndefined()
    }
  })
})

describe("chemins de fichiers hostiles : carte étudiante et photo de profil", () => {
  const hostileCard = [
    `${S2}/c.jpg`, `${S1}/../${S2}/c.jpg`, `${S1}/%2e%2e/c.jpg`, `/${S1}/c.jpg`, `${S1}//c.jpg`, `${S1}/`, "c.jpg", "https://evil.example/c.jpg", "javascript:alert(1)",
    `https://example.supabase.co/storage/v1/object/public/avatars/${S1}/c.jpg`, `https://example.supabase.co/storage/v1/object/public/student-cards/${S2}/c.jpg`,
    `https://example.supabase.co.evil.example/storage/v1/object/public/student-cards/${S1}/c.jpg`, `${S1}/c.jpg?token=1`, `${S1}\\c.jpg`, `${S1}/\u0000c.jpg`, 42, null, undefined, {}, [`${S1}/c.jpg`], "",
  ]
  it("carte : tout chemin hors du dossier de l'appelant ou hors du bucket est refusé, sans écriture", async () => {
    for (const p of hostileCard) {
      const r = await saveStudentCardUrl(p)
      expect(r.error, dump(p)).toBeTruthy()
    }
    expect(ctx.writes).toHaveLength(0)
  })
  it("carte valide : seul le chemin est stocké, le statut repasse en attente sans toucher role / is_suspended / verified_until", async () => {
    const r = await saveStudentCardUrl(`${S1}/nouvelle.png`)
    expect(r.success).toBe(true)
    const profileWrites = ctx.writes.filter((w) => w.table === "profiles")
    expect(profileWrites.map((w) => Object.keys(w.payload).sort())).toEqual([
      ["is_verified"],
      ["is_verified", "rejection_reason", "verification_submitted_at"],
    ])
    const payload = profileWrites.at(-1).payload
    expect(Object.keys(payload).sort()).toEqual(["is_verified", "rejection_reason", "verification_submitted_at"])
  })
  const hostileAvatar = [
    "https://evil.example/a.png", `https://example.supabase.co/storage/v1/object/public/avatars/${S2}/a.png`, `https://example.supabase.co/storage/v1/object/public/message-media/${S1}/a.png`,
    `https://example.supabase.co/storage/v1/object/public/avatars/${S1}/../${S2}/a.png`, `javascript:alert(1)`, `data:image/png;base64,AAAA`, `${S1}/a.png`,
    `https://example.supabase.co.evil.example/storage/v1/object/public/avatars/${S1}/a.png`, `https://example.supabase.co/storage/v1/object/sign/avatars/${S1}/a.png`,
  ]
  const valid = { fullName: "Awa Kpossou", city: "Cotonou", phone: "0197000001", bio: "", school: "", level: "", availability: "", skills: [] }
  it("photo : toute URL hors du dossier avatars/<session> du projet est refusée par saveStudentProfile, sans écriture de profil", async () => {
    for (const avatarUrl of hostileAvatar) {
      const r = await saveStudentProfile({ ...valid, avatarUrl })
      expect(r.error, avatarUrl).toBeTruthy()
    }
    expect(ctx.writes.filter((w) => w.table === "profiles")).toHaveLength(0)
  })
  it("photo valide : URL publique du dossier de l'étudiant acceptée, paramètres retirés", async () => {
    const url = `https://example.supabase.co/storage/v1/object/public/avatars/${S1}/avatar-1.png?t=123`
    const r = await saveStudentProfile({ ...valid, avatarUrl: url })
    expect(r.success).toBe(true)
    expect(ctx.db.profiles.find((p) => p.user_id === S1).avatar_url).toBe(`https://example.supabase.co/storage/v1/object/public/avatars/${S1}/avatar-1.png`)
  })
  it("saveStudentProfile : champs hostiles refusés côté serveur (téléphone, nom vide, ville hors liste, bio > bornes, compétences)", async () => {
    const bad = [
      { ...valid, phone: "12" }, { ...valid, phone: "abc" }, { ...valid, fullName: "   " }, { ...valid, fullName: "x".repeat(101) }, { ...valid, city: "Atlantis" },
      { ...valid, bio: "x".repeat(401) }, { ...valid, skills: Array.from({ length: 9 }, (_, i) => `s${i}`) }, { ...valid, skills: [42] }, { ...valid, fullName: "a‮b" },
      null, undefined, "x", [],
    ]
    for (const input of bad) {
      const r = await saveStudentProfile(input)
      expect(r.error, dump(input)).toBeTruthy()
    }
    expect(ctx.writes.filter((w) => w.table === "profiles")).toHaveLength(0)
  })
  it("saveStudentProfile : champs privilégiés forgés (role, is_verified, is_suspended, verified_until, user_id) jamais écrits", async () => {
    const r = await saveStudentProfile({ ...valid, role: "admin", is_verified: true, is_suspended: false, verified_until: "2099-01-01", user_id: S2, rating: 5 })
    expect(r.success).toBe(true)
    const payload = ctx.writes.find((w) => w.table === "profiles" && w.op === "update").payload
    expect(Object.keys(payload).sort()).toEqual(["bio", "city", "full_name", "phone"])
    expect(ctx.db.profiles.find((p) => p.user_id === S1).role).toBe("student")
    expect(ctx.db.profiles.find((p) => p.user_id === S2).full_name).toBe("Boris Tokpa")
  })
  it("updateStudentProfile, exportée comme action, valide elle-même : ville, téléphone, bio et compétences hostiles refusés sans écriture", async () => {
    const before = ctx.writes.length
    const r = await updateStudentProfile({ fullName: "Awa", city: "Atlantis", phone: "12", bio: "x".repeat(5000), skills: Array.from({ length: 500 }, (_, i) => `s${i}`) })
    expect(r.success).toBeUndefined()
    expect(r.error).toBe("Certains champs sont à corriger avant d'enregistrer.")
    expect(Object.keys(r.errors).sort()).toEqual(["bio", "city", "phone", "skills"])
    expect(ctx.writes.length).toBe(before)
  })
})
