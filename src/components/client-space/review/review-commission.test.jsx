import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("@/lib/actions/review.actions", () => ({ createClientReview: vi.fn() }))
// Le taux varie : le libellé et le calcul doivent suivre la constante, jamais un « 12 » en dur.
vi.mock("@/lib/supabase/database.constants", async (importOriginal) => ({
  ...(await importOriginal()),
  COMMISSION_RATE: 0.2,
}))

const { formatAmount } = await import("@/lib/app/format")
const { ReviewView } = await import("./review-view")

const page = {
  state: "form",
  mission: { id: "m-1", title: "Garde d'enfants", budget: 10000, status: "done" },
  student: { id: "s-1", fullName: "Afiavi Dossou", avatarUrl: null },
  review: null,
  authorName: "Rosine Houngbédji",
}

describe("récapitulatif de la mission : taux de commission", () => {
  const html = renderToStaticMarkup(<ReviewView page={page} />)
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

  it("affiche le taux de la constante et non un 12 % figé", () => {
    expect(t).toContain("Commission 20 %")
    expect(t).not.toContain("Commission 12 %")
  })

  it("calcule la commission et la part de l'étudiant avec le même taux", () => {
    expect(html).toContain(formatAmount(2000, { sign: "debit" }))
    expect(html).toContain(formatAmount(8000))
    expect(t).toContain("Part de l&#x27;étudiant")
  })
})
