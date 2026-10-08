import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Faq } from "./faq"

const ITEMS = [
  { id: "achats", question: "Mission avec achats ?", answer: "Oui, en trois temps." },
  { id: "retrait", question: "Comment retirer ?", answer: <b>Par MoMo</b> },
]

describe("Faq", () => {
  it("rend un <details> avec l'id de chaque question", () => {
    const html = renderToStaticMarkup(<Faq items={ITEMS} />)
    expect(html).toContain('<details id="achats" class="v-faq__item">')
    expect(html).toContain('<details id="retrait" class="v-faq__item">')
  })

  it("rend un summary.v-faq__q par question, avec l'icone plus", () => {
    const html = renderToStaticMarkup(<Faq items={ITEMS} />)
    expect(html.match(/<summary class="v-faq__q">/g)).toHaveLength(2)
    expect(html).toContain("#i-plus")
  })

  it("utilise h3 par défaut et respecte headingLevel", () => {
    expect(renderToStaticMarkup(<Faq items={ITEMS} />)).toContain("<h3")
    const html = renderToStaticMarkup(<Faq items={ITEMS} headingLevel={2} />)
    expect(html).toContain("<h2")
    expect(html).not.toContain("<h3")
  })

  it("accepte une réponse chaîne ou ReactNode", () => {
    const html = renderToStaticMarkup(<Faq items={ITEMS} />)
    expect(html).toContain('<div class="v-faq__a">Oui, en trois temps.</div>')
    expect(html).toContain("<b>Par MoMo</b>")
  })

  it("ne rend aucun details ouvert par défaut", () => {
    expect(renderToStaticMarkup(<Faq items={ITEMS} />)).not.toContain(" open")
  })
})
