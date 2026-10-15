import { describe, it, expect, vi, beforeEach } from "vitest"

const getPublishPage = vi.fn()

vi.mock("@/lib/actions/client-publish.actions", () => ({ getPublishPage }))
vi.mock("@/components/client-space/publish/publish-wizard", () => ({ PublishWizard: function PublishWizard() { return null } }))
vi.mock("@/components/client-space/publish/publish-paused-view", () => ({ PublishPausedView: function PublishPausedView() { return null } }))

const { default: NewMissionPage } = await import("./page")

const ID = "3f2b8c1e-9a4d-4e6b-8c2a-1d5f7e9b0a3c"
const EMPTY = { type: "", title: "", description: "", city: "", budget: null, urgency: "low", deadline: "", avecAchats: false, estimationAchats: null }
const props = (tree) => tree.props

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PAYMENTS_ENABLED", "true")
  getPublishPage.mockResolvedValue({ data: { available: 10000, duplicate: null } })
})

describe("NewMissionPage, paiements ouverts", () => {
  it("rend l'assistant avec le solde, la date du Bénin et un départ vide", async () => {
    const tree = await NewMissionPage({ searchParams: Promise.resolve({}) })
    expect(tree.type.name).toBe("PublishWizard")
    expect(props(tree).initial).toEqual(EMPTY)
    expect(props(tree).available).toBe(10000)
    expect(props(tree).today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(props(tree).duplicateId).toBe("")
    expect(getPublishPage).toHaveBeenCalledWith({ duplicate: "" })
  })

  it("transmet le préremplissage valide (besoin, ville, type)", async () => {
    const tree = await NewMissionPage({
      searchParams: Promise.resolve({ besoin: "Faire le marché", ville: "Porto-Novo", type: "Livraison" }),
    })
    expect(props(tree).initial).toEqual({ ...EMPTY, title: "Faire le marché", city: "Porto-Novo", type: "Livraison" })
  })

  it("ignore les valeurs invalides ou inconnues", async () => {
    const tree = await NewMissionPage({
      searchParams: Promise.resolve({ ville: "Paris", type: "Inconnu", budget: "999999", deadline: "2020-01-01", status: "done" }),
    })
    expect(props(tree).initial).toEqual(EMPTY)
  })

  it("borne le titre du préremplissage à 80 caractères", async () => {
    const tree = await NewMissionPage({ searchParams: Promise.resolve({ besoin: "a".repeat(500) }) })
    expect(props(tree).initial.title).toHaveLength(80)
  })

  it("préremplit depuis la mission dupliquée du client, l'échéance reste vide", async () => {
    getPublishPage.mockResolvedValue({
      data: {
        available: 3000,
        duplicate: { title: "Traduire un flyer", description: "d".repeat(60), type: "Traduction", city: "Cotonou", budget: 8000, urgency: "high" },
      },
    })
    const tree = await NewMissionPage({ searchParams: Promise.resolve({ duplicate: ID }) })
    expect(getPublishPage).toHaveBeenCalledWith({ duplicate: ID })
    expect(props(tree).initial).toEqual({
      type: "Traduction",
      title: "Traduire un flyer",
      description: "d".repeat(60),
      city: "Cotonou",
      budget: 8000,
      urgency: "high",
      deadline: "",
      avecAchats: false,
      estimationAchats: null,
    })
    expect(props(tree).duplicateId).toBe(ID)
    expect(props(tree).available).toBe(3000)
  })

  it("un duplicate d'un autre client (action : null) est ignoré", async () => {
    const tree = await NewMissionPage({ searchParams: Promise.resolve({ duplicate: ID, besoin: "Garder" }) })
    expect(props(tree).initial).toEqual({ ...EMPTY, title: "Garder" })
    expect(props(tree).duplicateId).toBe("")
  })

  it("un identifiant invalide n'est jamais transmis à l'action", async () => {
    await NewMissionPage({ searchParams: Promise.resolve({ duplicate: "1; drop table missions" }) })
    expect(getPublishPage).toHaveBeenCalledWith({ duplicate: "" })
  })

  it("relance l'état de l'assistant quand le préremplissage change (clé)", async () => {
    const a = await NewMissionPage({ searchParams: Promise.resolve({ besoin: "A" }) })
    const b = await NewMissionPage({ searchParams: Promise.resolve({ besoin: "B" }) })
    expect(a.key).not.toBe(b.key)
  })

  it("transmet l'erreur de chargement à la vue, sans perdre le préremplissage", async () => {
    getPublishPage.mockResolvedValue({ error: "Impossible de charger la publication de mission." })
    const tree = await NewMissionPage({ searchParams: Promise.resolve({ besoin: "Garder" }) })
    expect(props(tree).error).toBe("Impossible de charger la publication de mission.")
    expect(props(tree).available).toBeNull()
    expect(props(tree).initial.title).toBe("Garder")
  })

  it("accepte des paramètres multiples (premier retenu) et l'absence de paramètres", async () => {
    const tree = await NewMissionPage({ searchParams: Promise.resolve({ ville: ["Cotonou", "Paris"] }) })
    expect(props(tree).initial.city).toBe("Cotonou")
    const none = await NewMissionPage({ searchParams: Promise.resolve(undefined) })
    expect(props(none).initial).toEqual(EMPTY)
  })
})

describe("NewMissionPage, paiements coupés", () => {
  beforeEach(() => vi.stubEnv("PAYMENTS_ENABLED", "false"))

  it("affiche la publication en pause sans lire de données ni montrer l'assistant", async () => {
    const tree = await NewMissionPage({ searchParams: Promise.resolve({}) })
    expect(tree.type.name).toBe("PublishPausedView")
    expect(getPublishPage).not.toHaveBeenCalled()
    expect(props(tree).resumeHref).toBeUndefined()
  })

  it("garde le lien de reprise du préremplissage pour la réouverture", async () => {
    const tree = await NewMissionPage({
      searchParams: Promise.resolve({ besoin: "Faire le marché", ville: "Cotonou", type: "Livraison" }),
    })
    expect(props(tree).resumeHref).toBe("/client/missions/new?besoin=Faire+le+march%C3%A9&ville=Cotonou&type=Livraison")
  })

  it("garde aussi le lien d'une duplication, sans lire la mission", async () => {
    const tree = await NewMissionPage({ searchParams: Promise.resolve({ duplicate: ID }) })
    expect(props(tree).resumeHref).toBe(`/client/missions/new?duplicate=${ID}`)
    expect(getPublishPage).not.toHaveBeenCalled()
  })

  it("ne propose pas de reprise pour un préremplissage invalide", async () => {
    const tree = await NewMissionPage({ searchParams: Promise.resolve({ ville: "Paris", duplicate: "x" }) })
    expect(props(tree).resumeHref).toBeUndefined()
  })

  it("le drapeau est faux par défaut", async () => {
    vi.unstubAllEnvs()
    delete process.env.PAYMENTS_ENABLED
    const tree = await NewMissionPage({ searchParams: Promise.resolve({}) })
    expect(tree.type.name).toBe("PublishPausedView")
    expect(getPublishPage).not.toHaveBeenCalled()
  })

  it.each(["1", "TRUE", "yes", ""])("le drapeau %j ne suffit pas à ouvrir la publication", async (value) => {
    vi.stubEnv("PAYMENTS_ENABLED", value)
    const tree = await NewMissionPage({ searchParams: Promise.resolve({}) })
    expect(tree.type.name).toBe("PublishPausedView")
  })
})
