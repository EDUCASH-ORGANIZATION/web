import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Toaster } from "./toaster"

describe("Toaster : pile de notifications", () => {
  const html = renderToStaticMarkup(<Toaster><p>contenu</p></Toaster>)
  const classes = html.match(/aria-live="polite" class="([^"]*)"/)[1].split(" ")

  it("sous 1024 px, la pile est relevée au-dessus de la capsule flottante (86 px + zone sûre + marge)", () => {
    expect(classes).toContain("bottom-[calc(86px+env(safe-area-inset-bottom)+1.5rem)]")
    expect(classes).not.toContain("bottom-20")
  })

  it("au bureau, le rendu ne change pas : bas 1.5rem, à droite", () => {
    for (const c of ["lg:bottom-6", "lg:left-auto", "lg:right-6", "lg:translate-x-0", "lg:px-0"]) expect(classes).toContain(c)
  })

  it("autres comportements conservés : région polie, au-dessus des menus, centrée, largeur max", () => {
    for (const c of ["fixed", "left-1/2", "-translate-x-1/2", "z-[100]", "max-w-sm"]) expect(classes).toContain(c)
  })
})
