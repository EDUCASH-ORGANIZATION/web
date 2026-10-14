// Page /profile/verify : seul un badge valable renvoie au profil. Un badge expiré ou à renouveler
// (is_verified reste à vrai) doit pouvoir renvoyer sa carte ici. L'action réelle est exécutée (rôle et
// service role simulés) : aucune colonne privée ne doit sortir dans le rendu.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = { user: { id: "u1" }, auth: { user: { id: "u1" } }, profile: null, studentProfile: null }
const redirect = vi.fn((to) => {
  throw new Error(`REDIRECT:${to}`)
})

vi.mock("next/navigation", () => ({
  redirect: (to) => redirect(to),
  unstable_rethrow: (e) => {
    throw e
  },
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("@/lib/actions/auth.actions", () => ({ getCurrentUser: async () => state.user }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: async () => state.auth, requireUser: async () => state.auth }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: table === "profiles" ? state.profile : state.studentProfile, error: null }),
        }),
      }),
    }),
  }),
}))
vi.mock("@/components/student-space/verify/card-dropzone", () => ({ CardDropzone: () => <p>zone d&apos;envoi</p> }))

import ProfileVerifyPage from "./page"

const plus = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

beforeEach(() => {
  redirect.mockClear()
  state.user = { id: "u1" }
  state.auth = { user: { id: "u1" } }
  state.profile = { is_verified: false }
  state.studentProfile = null
})

describe("/profile/verify", () => {
  it("visiteur non connecté : redirige vers la connexion", async () => {
    state.user = null
    state.auth = { error: "refus" }
    await expect(ProfileVerifyPage()).rejects.toThrow("REDIRECT:/auth/login")
  })

  it("connecté mais refusé ou profil illisible : état d'échec, ni redirection ni faux statut", async () => {
    state.auth = { error: "refus" }
    const html = renderToStaticMarkup(await ProfileVerifyPage())
    expect(redirect).not.toHaveBeenCalled()
    expect(html).toContain("Impossible de charger votre vérification")
    expect(html).not.toContain("Statut actuel")
  })

  it("badge valable : retour au profil", async () => {
    state.profile = { is_verified: true, verified_until: plus(200) }
    await expect(ProfileVerifyPage()).rejects.toThrow(/^REDIRECT:\/profile$/)
  })

  it.each([
    ["badge expiré", { is_verified: true, verified_until: plus(-5) }],
    ["badge à renouveler", { is_verified: true, verified_until: plus(10) }],
    ["date illisible", { is_verified: true, verified_until: "pas une date" }],
    ["carte refusée", { is_verified: false, rejection_reason: "floue" }],
    ["carte jamais envoyée", { is_verified: false }],
  ])("%s : la page de dépôt s'affiche sans redirection", async (_name, profile) => {
    state.profile = profile
    const html = renderToStaticMarkup(await ProfileVerifyPage())
    expect(redirect).not.toHaveBeenCalled()
    expect(html).toContain("zone d&#x27;envoi")
  })

  it("carte en cours d'examen : statut sans zone d'envoi, sans redirection", async () => {
    state.studentProfile = { card_url: "u1/chemin-secret.jpg" }
    const html = renderToStaticMarkup(await ProfileVerifyPage())
    expect(redirect).not.toHaveBeenCalled()
    expect(html).toContain("Votre carte est en cours d&#x27;examen")
    expect(html).not.toContain("zone d&#x27;envoi")
  })

  it("n'expose ni le chemin de la carte ni la date de dépôt brute", async () => {
    state.profile = { is_verified: false, verification_submitted_at: "2026-10-07T21:14:09.123Z" }
    state.studentProfile = { card_url: "u1/chemin-secret.jpg" }
    const html = renderToStaticMarkup(await ProfileVerifyPage())
    expect(html).not.toContain("chemin-secret")
    expect(html).not.toContain("2026-10-07T21")
  })
})
