import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal()), preload: vi.fn() }))
vi.mock("@/components/design/select", () => ({
  Select: ({ id, name }) => <select id={id} name={name} />,
}))

const { HomeHero } = await import("./home-hero")

const html = renderToStaticMarkup(<HomeHero live={false} openMissions={0} role={null} />)
const visual = html.slice(html.indexOf('class="v-hero__visual"'))

describe("HomeHero visuel", () => {
  it("l'aplat citron contient le picture, et le push vient après", () => {
    const flat = visual.indexOf('class="photo-ph"')
    const picture = visual.indexOf('<picture class="v-hero__picture">')
    const push = visual.indexOf("v-hero__push")
    expect(flat).toBeGreaterThan(-1)
    expect(picture).toBeGreaterThan(flat)
    expect(push).toBeGreaterThan(picture)
  })

  it("la source réservée aux écrans larges et le pixel de repli", () => {
    expect(visual).toContain('media="(min-width: 1024px)"')
    expect(visual).toContain('srcSet="/images/hero/portrait-hero.webp"')
    expect(visual).toContain('src="data:image/gif;base64,')
    expect(visual).toContain('width="644"')
    expect(visual).toContain('height="1100"')
  })

  it("garde le push, la carte, la pastille tournante et l'étincelle", () => {
    expect(visual).toContain("v-hero__push")
    expect(visual).toContain("v-hero__card")
    expect(visual).toContain("En séquestre")
    expect(visual).toContain("#roundel")
    expect(visual).toContain("#sc-burst")
  })

  it("n'utilise plus la mascotte du sprite", () => {
    expect(html).not.toContain("#av-1")
  })
})
