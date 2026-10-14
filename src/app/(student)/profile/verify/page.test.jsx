// Page /profile/verify : seul un badge valable renvoie au profil. Un badge expiré ou à renouveler
// (is_verified reste à vrai) doit pouvoir renvoyer sa carte ici.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = { user: { id: "u1" }, profile: null, studentProfile: null }
const redirect = vi.fn((to) => {
  throw new Error(`REDIRECT:${to}`)
})

vi.mock("next/navigation", () => ({ redirect: (to) => redirect(to) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("@/lib/actions/auth.actions", () => ({ getCurrentUser: async () => state.user }))
vi.mock("@/lib/actions/profile.actions", () => ({
  getMyProfile: async () => ({ profile: state.profile }),
  getMyStudentProfile: async () => ({ studentProfile: state.studentProfile }),
}))
vi.mock("@/components/profile/card-upload-form", () => ({ CardUploadForm: () => <p>formulaire carte</p> }))

import ProfileVerifyPage from "./page"

const plus = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

beforeEach(() => {
  redirect.mockClear()
  state.user = { id: "u1" }
  state.profile = { is_verified: false }
  state.studentProfile = null
})

describe("/profile/verify", () => {
  it("visiteur non connecté : redirige vers la connexion", async () => {
    state.user = null
    await expect(ProfileVerifyPage()).rejects.toThrow("REDIRECT:/auth/login")
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
    expect(html).toContain("formulaire carte")
  })

  it("n'expose aucune colonne privée dans le rendu", async () => {
    state.profile = { is_verified: false, rejection_reason: "motif secret" }
    state.studentProfile = { card_url: "u1/chemin-secret.jpg" }
    const html = renderToStaticMarkup(await ProfileVerifyPage())
    expect(html).not.toContain("motif secret")
    expect(html).not.toContain("chemin-secret")
  })
})
