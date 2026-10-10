import { describe, it, expect } from "vitest"
import { shouldMarkPagination } from "./pagination-link"

const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, target: null, download: false }

describe("shouldMarkPagination", () => {
  it("marque un clic gauche simple vers une autre page", () => {
    expect(shouldMarkPagination(click, false)).toBe(true)
  })

  it("ne marque pas le lien de la page courante", () => {
    expect(shouldMarkPagination(click, true)).toBe(false)
  })

  it("ne marque pas un clic annulé, un autre bouton ou une touche modificatrice", () => {
    expect(shouldMarkPagination({ ...click, defaultPrevented: true }, false)).toBe(false)
    expect(shouldMarkPagination({ ...click, button: 1 }, false)).toBe(false)
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
      expect(shouldMarkPagination({ ...click, [key]: true }, false)).toBe(false)
    }
  })
})
