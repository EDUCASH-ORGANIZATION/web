"use client"

import { useLayoutEffect, useRef } from "react"
import { usePathname } from "next/navigation"

const MAIN_ID = "contenu"
const PAGINATION_TTL = 10000

// Les chemins sont comparés décodés des deux côtés (usePathname et window.location peuvent différer d'un
// pourcentage d'encodage).
export function normalizePath(path) {
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}

// Décision pure : faut-il remonter en haut de page après un changement d'adresse ?
// - Chemin différent : oui, sauf au premier affichage (rechargement : le navigateur restaure la position), pour
//   un retour ou une avance de l'historique (position restaurée) et pour un lien d'ancre (HashScroll et Next
//   défilent vers la cible). Limite assumée : `scroll: false` vers un AUTRE chemin est ignoré ici (aucun lien du
//   site ne s'en sert) ; si un jour il le faut, poser un marqueur de refus sur le modèle de markPagination.
// - Même chemin, recherche différente (filtres, pagination) : seulement si un clic de pagination l'a marqué.
//   Les filtres naviguent avec `scroll: false` et gardent leur position : ne jamais élargir à toute la query.
export function shouldScrollToTop({ previousPath, path, previousSearch = "", search = "", hash, poppedBack, paginated = false }) {
  if (previousPath === null || hash || poppedBack) return false
  if (previousPath !== path) return true
  return previousSearch !== search && paginated
}

// Chemin visé par le dernier popstate (bouton retour ou avance). Il ne vaut que pour ce chemin : un retour sur
// un simple fragment du même chemin n'empêche pas de remonter pour un lien vers un autre chemin.
let poppedPath = null

export function notePopped(path) {
  poppedPath = normalizePath(path)
}

// Lit puis remet à null : vrai une seule fois, seulement si le chemin affiché est celui visé par le popstate.
export function consumePopped(pathname) {
  const popped = poppedPath !== null && poppedPath === normalizePath(pathname)
  poppedPath = null
  return popped
}

// Un clic de pagination marque la navigation : à l'arrivée, seule la recherche change et la page doit remonter.
// Le marqueur expire, ne sert qu'une fois et tombe au premier popstate.
let paginationAt = null

export function markPagination(now = Date.now()) {
  paginationAt = now
}

export function consumePagination(now = Date.now()) {
  const at = paginationAt
  paginationAt = null
  return at !== null && now - at < PAGINATION_TTL
}

// Dernière interaction : clavier (Entrée sur un lien) ou pointeur. Sert à décider du focus après remontée.
let lastInputKeyboard = false

export function isKeyboardInput() {
  return lastInputKeyboard
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    notePopped(window.location.pathname)
    paginationAt = null
  })
  window.addEventListener("keydown", (event) => {
    if (["Enter", " ", "Tab"].includes(event.key)) lastInputKeyboard = true
  }, true)
  window.addEventListener("pointerdown", () => { lastInputKeyboard = false }, true)
}

// Corps de l'effet, sans React : `state` garde le dernier chemin et la dernière recherche vus. Renvoie vrai si la
// page a été remontée. Appelé deux fois de suite (double montage de StrictMode), il ne défile jamais au montage.
export function applyRouteScroll(state, { pathname, search, hash }, scrollTo) {
  const path = normalizePath(pathname)
  const move = shouldScrollToTop({
    previousPath: state.path,
    path,
    previousSearch: state.search,
    search,
    hash,
    poppedBack: consumePopped(pathname),
    paginated: consumePagination(),
  })
  state.path = path
  state.search = search
  if (move) scrollTo()
  return move
}

// Place le focus sur le contenu principal après une remontée, seulement si la navigation vient d'une activation au
// clavier ou si le focus est perdu (élément actif disparu avec l'ancienne page, ou retombé sur le body) : un clic
// qui garde le focus ailleurs ne déplace rien. Sans #contenu (pages à squelette de chargement, espaces
// connectés), on ne touche à rien.
export function focusMain(doc = document, keyboard = isKeyboardInput()) {
  const active = doc.activeElement
  const lost = !active || active === doc.body || !doc.contains(active)
  if (!keyboard && !lost) return false
  const main = doc.getElementById(MAIN_ID)
  if (!main) return false
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1")
  main.focus({ preventScroll: true })
  return true
}

// Cause racine corrigée ici : quand la page visée a un loading.js, Next n'exécute aucun défilement vers le haut.
// Le squelette s'affiche, le navigateur borne seulement la position à la hauteur du squelette, puis le vrai
// contenu arrive sans que la page ne remonte : on atterrit à une position arbitraire. Ce composant, monté dans
// le layout racine (sous Suspense, à cause de useSearchParams), remonte à chaque navigation par lien (voir
// shouldScrollToTop). useLayoutEffect évite une image à l'ancienne position.
export function RouteScroll({ search }) {
  const pathname = usePathname()
  const state = useRef({ path: null, search: "" })

  useLayoutEffect(() => {
    const moved = applyRouteScroll(
      state.current,
      { pathname, search, hash: window.location.hash },
      () => window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
    )
    if (moved) focusMain()
  }, [pathname, search])

  return null
}
