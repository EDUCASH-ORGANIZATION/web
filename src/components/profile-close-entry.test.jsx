import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("next/image", () => ({ default: ({ src, className }) => <span data-image={src} className={className} /> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("@/components/app-ui/toast", () => ({ useAppToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/components/shared/supabase-provider", () => ({ useSupabase: () => ({ supabase: {} }) }))

const { ClientProfileView } = await import("./client-space/profile/profile-view")
const { StudentProfileView } = await import("./student-space/profile/profile-view")

const clientSummary = {
  identity: { userId: "u1", fullName: "Rosine H", companyName: null, city: "Cotonou", avatarUrl: null, phone: null, memberSince: "2026-04-02T10:00:00Z" },
  stats: { published: 1, active: 0, done: 0, cancelled: 0, totalSpent: 0, rating: null, reviewsCount: 0 },
  reviews: [],
}
const studentSummary = {
  identity: { userId: "u2", fullName: "Sèna A", city: "Cotonou", avatarUrl: null, bio: null, school: "UAC", level: "L2", skills: [], availability: "", memberSince: "2026-03-02T10:00:00Z" },
  verification: { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: 200, action: null, verifiedUntil: "2027-06-29" },
  stats: { done: 0, totalEarned: 0, rating: null, reviewsCount: 0 },
  reviews: [],
}

describe("point d'entrée Fermer mon compte en bas des profils", () => {
  it.each([
    ["client", () => renderToStaticMarkup(<ClientProfileView summary={clientSummary} logoutAction={() => {}} />), "/client/profile/close"],
    ["student", () => renderToStaticMarkup(<StudentProfileView summary={studentSummary} logoutAction={() => {}} />), "/profile/close"],
  ])("profil %s : la carte est présente, après la déconnexion, avec le bon lien", (_space, render, href) => {
    const html = render()
    expect(html).toContain('aria-label="Fermer mon compte"')
    expect(html).toContain(`href="${href}"`)
    expect(html.indexOf('aria-label="Fermer mon compte"')).toBeGreaterThan(html.indexOf("Se déconnecter"))
    expect(html).not.toMatch(/<form[^>]*>[^]*name="password"/)
  })
})
