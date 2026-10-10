import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const preload = vi.fn()
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal()), preload: (...args) => preload(...args) }))

const { HERO_PHOTOS, HeroPhoto } = await import("./hero-photo")

beforeEach(() => preload.mockClear())

describe("HERO_PHOTOS", () => {
  it("décrit la photo client et la photo étudiante avec leurs dimensions", () => {
    expect(HERO_PHOTOS.client).toEqual({ src: "/images/clients/portrait-client.webp", width: 562, height: 920 })
    expect(HERO_PHOTOS.student).toEqual({ src: "/images/hero/portrait-hero.webp", width: 644, height: 1100 })
  })
})

describe("HeroPhoto", () => {
  it.each([
    ["client", "/images/clients/portrait-client.webp", "562", "920"],
    ["student", "/images/hero/portrait-hero.webp", "644", "1100"],
  ])("rend l'aplat, la source large, le pixel de repli (%s)", (key, src, width, height) => {
    const html = renderToStaticMarkup(<HeroPhoto photo={HERO_PHOTOS[key]} />)
    expect(html.indexOf('class="photo-ph"')).toBe(5)
    expect(html).toContain('<picture class="v-hero__picture">')
    expect(html).toContain('media="(min-width: 1024px)"')
    expect(html).toContain(`srcSet="${src}"`)
    expect(html).toContain('src="data:image/gif;base64,')
    expect(html).toContain(`width="${width}"`)
    expect(html).toContain(`height="${height}"`)
    expect(html).toContain('alt=""')
  })

  it("précharge limité au media, en priorité haute seulement avec priority", () => {
    const plain = renderToStaticMarkup(<HeroPhoto photo={HERO_PHOTOS.client} />)
    expect(preload).toHaveBeenLastCalledWith("/images/clients/portrait-client.webp", {
      as: "image",
      media: "(min-width: 1024px)",
    })
    expect(plain).not.toContain("fetchPriority")

    const high = renderToStaticMarkup(<HeroPhoto photo={HERO_PHOTOS.student} priority />)
    expect(preload).toHaveBeenLastCalledWith("/images/hero/portrait-hero.webp", {
      as: "image",
      media: "(min-width: 1024px)",
      fetchPriority: "high",
    })
    expect(high).toContain('fetchPriority="high"')
  })
})
