// QA croisée RD-DONE-01 (ST-14) : les quatre écrans de fin déclarée (E05, E07 côté étudiant ; C08, C13 côté client)
// rendus avec le même scénario (mission en cours, non déclarée, déclarée, colonne absente), plus des gardes
// sur les sources (aucun accès aux fonds côté étudiant, une seule écriture de completion_declared_at).
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { createElement } from "react"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => createElement("a", { href, ...rest }, children),
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => createElement("span", { "data-image": src, className }),
}))
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("@/lib/actions/application.actions", () => ({ apply: vi.fn() }))
vi.mock("@/lib/actions/mission.actions", () => ({ confirmMission: vi.fn() }))
vi.mock("@/lib/actions/mission-completion.actions", () => ({ declareMissionCompletion: vi.fn() }))
vi.mock("@/components/app-ui/toast", () => ({ useAppToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/lib/actions/message.actions", () => ({
  sendClientMessage: vi.fn(),
  markClientConversationRead: vi.fn(),
  getClientMessageMedia: vi.fn(async () => ({ media: {} })),
  sendStudentMessage: vi.fn(),
  markStudentConversationRead: vi.fn(),
  getStudentConversation: vi.fn(),
  getStudentMessageMedia: vi.fn(async () => ({ media: {} })),
}))
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: ({ initialMessages }) => ({ messages: initialMessages, append: vi.fn(), refreshMedia: vi.fn() }),
  useMessageMediaUpload: () => vi.fn(),
}))

const { MissionFollowupView: StudentFollowup } = await import("@/components/student-space/mission/followup-view")
const { MissionFollowupView: ClientFollowup } = await import("@/components/client-space/mission-detail/followup-view")
const { StudentConversationView } = await import("@/components/student-space/messages/conversation-view")
const { ConversationView: ClientConversation } = await import("@/components/client-space/messages/conversation-view")

const ROOT = join(process.cwd(), "src")
const DECLARED_AT = "2026-10-12T09:30:00+01:00"
const NOW = "2026-10-13T12:00:00Z"
const M1 = "11111111-1111-4111-8111-111111111111"
const S1 = "22222222-2222-4222-8222-222222222221"
const C1 = "33333333-3333-4333-8333-333333333331"

// Coordonnées fictives du client, dans des champs que les vues étudiant ne lisent pas.
const CLIENT_PRIVATE = { phone: "+22997001122", email: "rosine.secret@example.test", address: "Rue 123 Haie Vive", whatsapp: "+22997334455" }
const PRIVATE_NEEDLES = ["97001122", "97 00 11 22", "rosine.secret", "example.test", "Haie Vive", "97334455"]

const STATES = [
  ["non déclarée", { available: true, declaredAt: null }],
  ["déclarée", { available: true, declaredAt: DECLARED_AT }],
  ["colonne absente", { available: false, declaredAt: DECLARED_AT }],
]

const missionBase = {
  id: M1, title: "Cours de maths niveau 3e", description: "Deux soirs.", type: "Cours particuliers", city: "Cotonou",
  budget: 25000, urgency: "low", deadline: "2999-01-01", status: "in_progress", createdAt: "2026-09-30T10:14:00Z",
}
const RESERVE = { type: "reserve", amount: 25000, createdAt: "2026-10-02T10:14:00Z" }

function e05(completion) {
  const detail = {
    state: "selected",
    mission: missionBase,
    client: { name: "Rosine H.", avatarUrl: null, city: "Cotonou", rating: 4.8, missionsPublished: 3, isVerified: true, ...CLIENT_PRIVATE },
    application: { id: "a1", status: "accepted", message: "Hello", createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-02T18:02:00Z" },
    isSelected: true,
    verification: null,
    ledger: [],
    review: null,
    similar: [],
    completion,
  }
  return renderToStaticMarkup(createElement(StudentFollowup, { detail, flags: { postuler: false, terminer: false, paymentsEnabled: true } }))
}

function e07({ available, declaredAt }) {
  const conversation = {
    userId: S1, missionId: M1, clientId: C1, state: "in_progress", canWrite: true, messages: [],
    client: { id: C1, name: "Rosine H.", avatarUrl: null, ...CLIENT_PRIVATE },
    mission: { title: "Cours de maths", status: "in_progress", budget: 25000, net: 22000 },
    completionAvailable: available, completionDeclaredAt: declaredAt,
  }
  return renderToStaticMarkup(createElement(StudentConversationView, { conversation, now: NOW, paymentsEnabled: true }))
}

function c08(completion) {
  const detail = {
    mission: { ...missionBase, selectedStudentId: S1 },
    applications: [],
    selectedStudent: {
      id: S1, fullName: "Sèna Agossou", avatarUrl: null, city: "Cotonou", rating: 4.9, missionsDone: 23,
      isVerified: true, verifiedUntil: "2099-01-01", school: "IFRI", level: "Licence 2", skills: [],
    },
    ledger: [RESERVE],
    review: null,
    completion,
  }
  return renderToStaticMarkup(createElement(ClientFollowup, { detail, flags: { confirmer: false, publiee: false, paymentsEnabled: true } }))
}

function c13({ available, declaredAt }) {
  const conversation = {
    userId: C1, missionId: M1, studentId: S1, student: { id: S1, name: "Ulrich Z.", avatarUrl: null },
    mission: { title: "Cours de maths", status: "in_progress", budget: 25000, purchasesEstimate: 7450 },
    relation: "selected", state: "in_progress", canWrite: true, messages: [],
    completionAvailable: available, completionDeclaredAt: declaredAt,
  }
  return renderToStaticMarkup(createElement(ClientConversation, { conversation, now: NOW, paymentsEnabled: true }))
}

const text = (html) => html.replace(/<[^>]+>/g, " ").replaceAll("&#x27;", "'").replace(/[  \s]+/g, " ")
const STUDENT_SCREENS = { E05: e05, E07: e07 }
const CLIENT_SCREENS = { C08: c08, C13: c13 }
const SCREENS = { ...STUDENT_SCREENS, ...CLIENT_SCREENS }
const renders = (screens, completion) => Object.entries(screens).map(([name, fn]) => [name, fn(completion)])

describe("QA croisée : boutons et état « À confirmer »", () => {
  it.each(Object.keys(STUDENT_SCREENS))("%s : « J'ai terminé » seulement quand la fin n'est pas déclarée et la colonne présente", (name) => {
    const [undeclared, declared, absent] = STATES.map(([, c]) => text(STUDENT_SCREENS[name](c)))
    expect(undeclared).toContain("J'ai terminé")
    expect(declared).not.toContain("J'ai terminé")
    expect(absent).not.toContain("J'ai terminé")
  })

  it.each(Object.keys(CLIENT_SCREENS))("%s : jamais de bouton « J'ai terminé » côté client", (name) => {
    for (const [, completion] of STATES) expect(text(CLIENT_SCREENS[name](completion))).not.toContain("J'ai terminé")
  })

  it.each(Object.keys(SCREENS))("%s : « À confirmer » une fois déclarée, nulle part sinon", (name) => {
    const [undeclared, declared, absent] = STATES.map(([, c]) => text(SCREENS[name](c)))
    expect(declared).toContain("À confirmer")
    expect(undeclared).not.toContain("À confirmer")
    expect(absent).not.toContain("À confirmer")
  })

  it.each(Object.keys(CLIENT_SCREENS))("%s : « Confirmer la fin » dans les trois cas", (name) => {
    for (const [label, completion] of STATES) expect(text(CLIENT_SCREENS[name](completion)), label).toContain("Confirmer la fin")
  })
})

describe("QA croisée : garde-fous de contenu", () => {
  it.each(STATES)("côté client (%s) : aucun « vous touchez »", (_label, completion) => {
    for (const [name, html] of renders(CLIENT_SCREENS, completion)) {
      expect(text(html), name).not.toMatch(/vous touchez/i)
    }
  })

  it.each(STATES)("côté étudiant (%s) : aucune coordonnée du client", (_label, completion) => {
    for (const [name, html] of renders(STUDENT_SCREENS, completion)) {
      for (const needle of PRIVATE_NEEDLES) expect(html, `${name} ${needle}`).not.toContain(needle)
      expect(html, name).not.toMatch(/href="(tel|mailto|sms):/)
      expect(text(html), name).toContain("Rosine")
    }
  })

  it.each(STATES)("aucun délai chiffré, aucun versement automatique non nié (%s)", (_label, completion) => {
    for (const [name, html] of renders(SCREENS, completion)) {
      const t = text(html)
      expect(t, name).not.toMatch(/72\s?h|délai/i)
      for (const m of t.matchAll(/automatiquement/gi)) {
        const before = t.slice(Math.max(0, m.index - 40), m.index)
        expect(before, `${name} : « ${t.slice(Math.max(0, m.index - 60), m.index + 20)} »`).toMatch(/rien n'est (versé|libéré) $/i)
      }
    }
  })

  it.each(STATES)("aucun double point dans les textes rendus (%s)", (_label, completion) => {
    for (const [name, html] of renders(SCREENS, completion)) {
      expect(text(html), name).not.toContain("..")
    }
  })

  it.each(STATES)("aucun tiret cadratin ni demi-cadratin, vouvoiement (%s)", (_label, completion) => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    const tutoie = /(?<![\p{L}])(tu|toi|ton|ta|tes)(?![\p{L}])/iu
    for (const [name, html] of renders(SCREENS, completion)) {
      const t = text(html)
      expect(t, name).not.toMatch(dashes)
      expect(t, name).not.toMatch(tutoie)
    }
  })
})

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(js|jsx)$/.test(entry) && !/\.test\.(js|jsx)$/.test(entry) && !/\.test\.support\.js$/.test(entry)) out.push(full)
  }
  return out
}
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("QA croisée : sources", () => {
  const studentFiles = [
    ...sourceFiles(join(ROOT, "components/student-space/mission")),
    ...sourceFiles(join(ROOT, "components/student-space/messages")),
  ]

  it("les vues étudiant de fin de mission et de messagerie existent", () => {
    expect(studentFiles.length).toBeGreaterThan(10)
  })

  it("les sources étudiant n'importent ni portefeuille, ni client de service, ni callWalletRpc, ni confirmMission", () => {
    for (const file of studentFiles) {
      const code = stripComments(readFileSync(file, "utf8"))
      const rel = relative(ROOT, file)
      expect(code, rel).not.toMatch(/callWalletRpc|createServiceClient|confirmMission/)
      const imports = [...code.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1])
      for (const spec of imports) expect(spec, `${rel} importe ${spec}`).not.toMatch(/wallet|portefeuille|service-client|supabase\/service/i)
    }
  })

  it("seule l'action dédiée écrit completion_declared_at", () => {
    const allowed = join(ROOT, "lib/actions/mission-completion.actions.js")
    for (const file of sourceFiles(ROOT)) {
      if (file === allowed || file.startsWith(join(ROOT, "qa"))) continue
      const code = stripComments(readFileSync(file, "utf8"))
      const rel = relative(ROOT, file)
      expect(code, rel).not.toMatch(/completion_declared_at["']?\s*:/)
      expect(code, rel).not.toMatch(/\.(update|insert|upsert)\([^)]*completion_declared_at/)
    }
    expect(stripComments(readFileSync(allowed, "utf8"))).toMatch(/\.update\(\{ completion_declared_at:/)
  })
})
