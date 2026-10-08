"use client"

import { useEffect, useRef } from "react"

export const FOCUSABLE =
  'a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])'

// Éléments réellement focusables d'un conteneur : le sélecteur seul retient aussi des éléments
// masqués (display:none, [hidden], [inert]) sur lesquels focus() échoue sans bruit.
export function focusableIn(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && !el.closest("[hidden],[inert]"),
  )
}

// Index suivant pour Tab (ou Maj+Tab avec `backward`) dans une liste de `count` éléments, en boucle.
// `at` vaut -1 quand le focus n'est sur aucun d'eux.
export function nextFocusIndex(count, at, backward) {
  if (count === 0) return -1
  if (at === -1) return backward ? count - 1 : 0
  return (at + (backward ? -1 : 1) + count) % count
}

// Installe le piège de focus sur `doc` et renvoie la fonction de nettoyage.
export function trapFocus({ doc, getContainer, initialFocus, returnTarget, onClose }) {
  const previousOverflow = doc.body.style.overflow
  doc.body.style.overflow = "hidden"
  ;(initialFocus ?? focusableIn(getContainer())[0])?.focus()

  function onKeyDown(e) {
    if (e.key === "Escape") {
      onClose()
      return
    }
    if (e.key !== "Tab") return
    const items = focusableIn(getContainer())
    if (items.length === 0) return
    // Le Tab natif est toujours remplacé : WebKit ne place pas les liens dans l'ordre de tabulation,
    // le focus est donc calculé sur la liste des éléments focusables de la boîte.
    e.preventDefault()
    items[nextFocusIndex(items.length, items.indexOf(doc.activeElement), e.shiftKey)].focus()
  }
  doc.addEventListener("keydown", onKeyDown)

  return () => {
    doc.removeEventListener("keydown", onKeyDown)
    doc.body.style.overflow = previousOverflow
    returnTarget?.focus()
  }
}

// Gestion du focus d'une boîte de dialogue modale (menu mobile, feuille de filtres) :
// focus initial dans la boîte, Tab et Maj+Tab bouclent (calculés, pas natifs), Échap ferme, la page derrière
// ne défile plus, et le focus retourne au déclencheur à la fermeture.
export function useModalFocus({ active = true, containerRef, initialFocusRef, returnFocusRef, onClose }) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!active) return undefined
    return trapFocus({
      doc: document,
      getContainer: () => containerRef.current,
      initialFocus: initialFocusRef?.current,
      returnTarget: returnFocusRef?.current,
      onClose: () => onCloseRef.current?.(),
    })
  }, [active, containerRef, initialFocusRef, returnFocusRef])
}
