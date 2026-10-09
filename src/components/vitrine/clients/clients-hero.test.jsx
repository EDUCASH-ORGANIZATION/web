import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal()), preload: vi.fn() }))

const { ClientsHero } = await import("./clients-hero")

const html = renderToStaticMarkup(<ClientsHero publishHref="/client/missions/new" />)
const visual = html.slice(html.indexOf('class="v05-visual"'))

describe("ClientsHero visuel", () => {
  it("l'aplat citron contient le picture, et la carte vient après", () => {
    const flat = visual.indexOf('class="photo-ph"')
    const picture = visual.indexOf('<picture class="v-hero__picture">')
    const recap = visual.indexOf("v05-recap")
    expect(flat).toBeGreaterThan(-1)
    expect(picture).toBeGreaterThan(flat)
    expect(recap).toBeGreaterThan(picture)
  })

  it("la source réservée aux écrans larges et le pixel de repli", () => {
    expect(visual).toContain('media="(min-width: 1024px)"')
    expect(visual).toContain('srcSet="/images/clients/portrait-client.webp"')
    expect(visual).toContain('src="data:image/gif;base64,')
    expect(visual).toContain('width="562"')
    expect(visual).toContain('height="920"')
    expect(visual).toContain('alt=""')
  })

  it("garde la carte d'exemple et la pastille tournante, sans le gribouillis", () => {
    expect(visual).toContain("Exemple de mission")
    expect(visual).toContain("#roundel")
    expect(visual).not.toContain("#sc-burst")
  })

  it("le visuel est masqué aux lecteurs d'écran", () => {
    expect(html).toContain('class="v05-visual" aria-hidden="true"')
  })
})
