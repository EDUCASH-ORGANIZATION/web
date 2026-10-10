import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, ...rest }) => <img src={src} alt={alt} width={width} height={height} {...rest} />,
}))

const { PayerOperators, Payers } = await import("./payers")

describe("PayerOperators", () => {
  const html = renderToStaticMarkup(<PayerOperators />)

  it("liste MTN MoMo, Moov Money et Celtiis Cash avec leurs logos", () => {
    expect(html).toContain("MTN MoMo")
    expect(html).toContain("Moov Money")
    expect(html).toContain("Celtiis Cash")
    expect(html).toContain("/logos/operators/mtn.png")
    expect(html).toContain("/logos/operators/moov.png")
    expect(html).toContain("/logos/operators/celtiis.png")
  })

  it("n'affiche pas « Bientôt »", () => {
    expect(html).not.toMatch(/bient/i)
  })
})

describe("Payers", () => {
  it("ne nomme pas le prestataire de paiement", () => {
    const html = renderToStaticMarkup(<Payers withEscrow />)
    expect(html).not.toMatch(/fedapay/i)
  })

  it("affiche le lien séquestre seulement avec withEscrow", () => {
    expect(renderToStaticMarkup(<Payers />)).not.toContain("/aide#sequestre")
    expect(renderToStaticMarkup(<Payers withEscrow />)).toContain('href="/aide#sequestre"')
  })
})
