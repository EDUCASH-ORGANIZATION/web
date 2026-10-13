import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { existsSync } from "node:fs"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))

const pages = {
  "mission": () => import("./missions/[id]/not-found"),
  "conversation": () => import("./messages/[missionId]/not-found"),
  "avis": () => import("./review/[missionId]/not-found"),
}

describe.each(Object.keys(pages))("not-found client : %s", (name) => {
  it("un seul h1, vouvoiement, lien de retour interne", async () => {
    const { default: NotFound } = await pages[name]()
    const html = renderToStaticMarkup(<NotFound />)
    expect(html.match(/<h1[ >]/g)).toHaveLength(1)
    expect(html).toContain("votre compte")
    expect(html).not.toMatch(/\b(tu|ton|ta|tes)\b/i)
    expect(html).toMatch(/href="\/client\//)
  })
})

describe("404 des segments dynamiques client", () => {
  it("aucun loading.js dans ces segments ni dans leurs parents (le statut deviendrait 200)", () => {
    const dirs = [
      "src/app/(client)",
      "src/app/(client)/client",
      "src/app/(client)/client/missions",
      "src/app/(client)/client/missions/[id]",
      "src/app/(client)/client/messages",
      "src/app/(client)/client/messages/[missionId]",
      "src/app/(client)/client/review",
      "src/app/(client)/client/review/[missionId]",
    ]
    expect(dirs.filter((d) => existsSync(`${d}/loading.js`))).toEqual([])
  })
})
