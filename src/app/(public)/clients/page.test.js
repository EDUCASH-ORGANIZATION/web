// Le rôle est lu côté serveur : on vérifie le lien de publication selon le visiteur.
import { describe, it, expect, vi, beforeEach } from "vitest"

let user = null
let role = null

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: role ? { role } : null, error: null }) }) }),
    }),
  }),
}))
vi.mock("@/components/vitrine/shared/vitrine-page", () => ({ VitrinePage: ({ children }) => children }))

const { default: ClientsPage } = await import("./page.js")

async function publishHref() {
  const tree = await ClientsPage()
  return tree.props.children[0].props.publishHref
}

describe("ClientsPage", () => {
  beforeEach(() => {
    user = null
    role = null
  })

  it("oriente un visiteur vers l'inscription client", async () => {
    expect(await publishHref()).toBe("/auth/register?role=client")
  })

  it("oriente un client connecté vers la publication", async () => {
    user = { id: "u1" }
    role = "client"
    expect(await publishHref()).toBe("/client/missions/new")
  })

  it("n'envoie pas un étudiant vers la publication", async () => {
    user = { id: "u2" }
    role = "student"
    expect(await publishHref()).toBe("/auth/register?role=client")
  })
})
