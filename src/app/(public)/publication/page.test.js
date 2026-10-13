import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const redirect = vi.fn((url) => {
  throw new Error(`redirect:${url}`)
})
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/components/vitrine/shared/vitrine-page", () => ({ VitrinePage: ({ children }) => children }))
vi.mock("@/components/vitrine/publish/publish-paused", () => ({ PublishPaused: () => null }))

const { default: PublicationPage, metadata } = await import("./page")

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllEnvs())

describe("page /publication", () => {
  it("paiements coupés : affiche l'écran de pause", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "false")
    const tree = await PublicationPage({ searchParams: Promise.resolve({}) })
    expect(tree.type.name).toBe("VitrinePage")
    expect(redirect).not.toHaveBeenCalled()
  })

  it("paiements ouverts : rejoint la publication en gardant le pré-remplissage valide", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true")
    await expect(
      PublicationPage({ searchParams: Promise.resolve({ besoin: "Faire le marché", ville: "Cotonou", type: "Inconnu" }) }),
    ).rejects.toThrow("redirect:/client/missions/new?besoin=Faire+le+march%C3%A9&ville=Cotonou")
  })

  it("paiements ouverts sans pré-remplissage : publication nue", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true")
    await expect(PublicationPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/client/missions/new")
  })

  it("n'est pas indexée", () => {
    expect(metadata.robots).toEqual({ index: false })
  })
})
