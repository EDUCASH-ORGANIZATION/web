"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

// Décision pure : faut-il remonter en haut de page après un changement d'adresse ?
// Oui pour une navigation vers une AUTRE page (chemin différent) sans ancre. Non au premier affichage
// (rechargement : le navigateur restaure la position), non pour un retour ou une avance de l'historique
// (position restaurée par le navigateur), non pour un lien d'ancre (HashScroll ou Next défilent vers la cible).
export function shouldScrollToTop({ previousPath, path, hash, poppedBack }) {
  if (previousPath === null || previousPath === path) return false
  if (hash) return false
  return !poppedBack
}

// Chemin visé par le dernier popstate (bouton retour ou avance du navigateur). Comparé au chemin affiché, il
// distingue un retour d'historique d'une navigation par lien, même si un retour sur le même chemin (simple
// fragment) a eu lieu plus tôt : il ne vaut que pour le chemin qu'il désigne.
let poppedPath = null

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    poppedPath = window.location.pathname
  })
}

// Cause racine corrigée ici : quand la page visée a un loading.js, Next n'exécute aucun défilement vers le haut.
// Le squelette s'affiche, le navigateur borne seulement la position à la hauteur du squelette, puis le vrai
// contenu arrive sans que la page ne remonte : on atterrit à une position arbitraire. Ce composant, monté dans
// le layout racine, remonte en haut à chaque changement de chemin par lien (voir shouldScrollToTop).
export function RouteScroll() {
  const pathname = usePathname()
  const previous = useRef(null)

  useEffect(() => {
    const poppedBack = poppedPath === pathname
    poppedPath = null
    const move = shouldScrollToTop({
      previousPath: previous.current,
      path: pathname,
      hash: window.location.hash,
      poppedBack,
    })
    previous.current = pathname
    if (move) window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname])

  return null
}
