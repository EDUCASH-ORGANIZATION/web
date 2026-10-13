import { describe, it, expect, vi, beforeEach } from "vitest"

const getClientMissionDetail = vi.fn()
const getCandidateProfile = vi.fn()
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND")
})

const unstable_rethrow = vi.fn()
vi.mock("next/navigation", () => ({ notFound, unstable_rethrow }))
vi.mock("@/lib/actions/client-mission-detail.actions", () => ({ getClientMissionDetail, getCandidateProfile }))
vi.mock("@/components/client-space/mission-detail/open-view", () => ({ MissionOpenView: () => null }))
vi.mock("@/components/client-space/mission-detail/followup-view", () => ({ MissionFollowupView: () => null }))
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal()), cache: (fn) => fn }))

const { default: Page, generateMetadata } = await import("./page")

const ID = "11111111-1111-4111-8111-111111111111"
const STUDENT = "22222222-2222-4222-8222-222222222222"
const detailOf = (status) => ({ mission: { id: ID, title: "Cours de maths", status } })
const props = (query = {}) => ({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve(query) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PAYMENTS_ENABLED", "")
})

describe("page détail de mission client", () => {
  it("renvoie 404 quand l'action ne renvoie rien (mission d'un autre client ou inexistante)", async () => {
    getClientMissionDetail.mockResolvedValue(null)
    await expect(Page(props())).rejects.toThrow("NEXT_NOT_FOUND")
    expect(getCandidateProfile).not.toHaveBeenCalled()
  })

  it("aiguille une mission ouverte vers MissionOpenView avec le candidat demandé et les drapeaux", async () => {
    getClientMissionDetail.mockResolvedValue(detailOf("open"))
    getCandidateProfile.mockResolvedValue({ studentId: STUDENT })
    const tree = await Page(props({ candidat: STUDENT, publiee: "1" }))
    expect(tree.type.name).toBe("MissionOpenView")
    expect(getCandidateProfile).toHaveBeenCalledWith(ID, STUDENT)
    expect(tree.props.candidate).toEqual({ studentId: STUDENT })
    expect(tree.props.flags).toEqual({ confirmer: false, publiee: true, paymentsEnabled: false })
  })

  it("n'appelle pas getCandidateProfile sans paramètre candidat exploitable", async () => {
    getClientMissionDetail.mockResolvedValue(detailOf("open"))
    const tree = await Page(props({ candidat: ["a", "b"] }))
    expect(getCandidateProfile).not.toHaveBeenCalled()
    expect(tree.props.candidate).toBeNull()
  })

  it("une erreur de lecture du candidat n'empêche pas le rendu : candidate null et candidateError", async () => {
    getClientMissionDetail.mockResolvedValue(detailOf("open"))
    getCandidateProfile.mockRejectedValue(new Error("boom"))
    const tree = await Page(props({ candidat: STUDENT }))
    expect(tree.type.name).toBe("MissionOpenView")
    expect(tree.props.candidate).toBeNull()
    expect(tree.props.flags).toEqual({ confirmer: false, publiee: false, paymentsEnabled: false, candidateError: true })
    expect(unstable_rethrow).toHaveBeenCalledTimes(1)
  })

  it("laisse passer les erreurs de contrôle de Next (unstable_rethrow relance)", async () => {
    getClientMissionDetail.mockResolvedValue(detailOf("open"))
    getCandidateProfile.mockRejectedValue(new Error("NEXT_REDIRECT"))
    unstable_rethrow.mockImplementationOnce((e) => { throw e })
    await expect(Page(props({ candidat: STUDENT }))).rejects.toThrow("NEXT_REDIRECT")
  })

  it.each(["in_progress", "done", "cancelled"])("aiguille le statut %s vers MissionFollowupView", async (status) => {
    getClientMissionDetail.mockResolvedValue(detailOf(status))
    const tree = await Page(props({ confirmer: "1", candidat: STUDENT }))
    expect(tree.type.name).toBe("MissionFollowupView")
    expect(tree.props.flags.confirmer).toBe(true)
    expect(getCandidateProfile).not.toHaveBeenCalled()
  })

  it("generateMetadata passe par l'action et reste neutre en cas de refus ou d'erreur", async () => {
    getClientMissionDetail.mockResolvedValue(detailOf("open"))
    expect(await generateMetadata(props())).toEqual({ title: "Cours de maths - EduCash" })
    getClientMissionDetail.mockResolvedValue(null)
    expect(await generateMetadata(props())).toEqual({ title: "Mission introuvable - EduCash" })
    getClientMissionDetail.mockRejectedValue(new Error("boom"))
    expect(await generateMetadata(props())).toEqual({ title: "Mission - EduCash" })
  })
})
