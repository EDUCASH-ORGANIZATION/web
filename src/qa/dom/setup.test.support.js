// Aide partagée des tests interactifs (environnement jsdom, activé fichier par fichier).
// Importer ce module en tête d'un test : il nettoie le DOM après chaque test et comble deux
// manques de jsdom dont les modales dépendent (matchMedia, mise en page pour getClientRects).
import { afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

// jsdom n'implémente pas matchMedia : bureau (la requête « compact » ne correspond pas).
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})

// jsdom ne calcule aucune mise en page : getClientRects() est toujours vide, ce qui ferait tenir tous
// les éléments pour masqués par le piège de focus. Les éléments rendus comptent ici comme visibles.
// Limite : tout élément attaché est tenu pour visible, donc un élément caché seulement par CSS
// (display:none via une classe) serait tenu pour focalisable. Le piège de focus écarte déjà [hidden]
// et [inert]. Ne pas tester la visibilité CSS en jsdom.
Element.prototype.getClientRects = function getClientRects() {
  return this.isConnected ? [{ width: 1, height: 1 }] : []
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.body.style.overflow = ""
})
