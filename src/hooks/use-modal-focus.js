"use client"

import { useEffect, useRef } from "react"

const FOCUSABLE = "a[href], button:not([disabled]), select:not([disabled]), input:not([disabled])"

// Gestion du focus d'une boîte de dialogue modale (menu mobile, feuille de filtres) :
// focus initial dans la boîte, Tab et Maj+Tab bouclent, Échap ferme, la page derrière
// ne défile plus, et le focus retourne au déclencheur à la fermeture.
export function useModalFocus({ active = true, containerRef, initialFocusRef, returnFocusRef, onClose }) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!active) return undefined
    const returnTarget = returnFocusRef?.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const container = containerRef.current
    const first = container?.querySelector(FOCUSABLE)
    ;(initialFocusRef?.current ?? first)?.focus()

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onCloseRef.current?.()
        return
      }
      if (e.key !== "Tab" || !containerRef.current) return
      const items = containerRef.current.querySelectorAll(FOCUSABLE)
      if (items.length === 0) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      returnTarget?.focus()
    }
  }, [active, containerRef, initialFocusRef, returnFocusRef])
}
