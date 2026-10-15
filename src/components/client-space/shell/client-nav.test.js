import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import path from "node:path"
import { CLIENT_NAV } from "./client-nav.js"

describe("CLIENT_NAV : notifications", () => {
  it("la cloche pointe vers la page des notifications de l'espace client, qui existe", () => {
    expect(CLIENT_NAV.notifications).toEqual({ space: "client", href: "/client/notifications" })
    expect(existsSync(path.join(process.cwd(), "src/app/(client)/client/notifications/page.js"))).toBe(true)
  })
})
