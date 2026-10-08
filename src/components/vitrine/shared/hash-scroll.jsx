"use client"

import { useEffect } from "react"
import Link from "next/link"

// Identifiant ciblé par un fragment d'URL ("#etapes", "#caf%C3%A9"), décodé ; "" si absent ou invalide.
export function hashTargetId(hash) {
  if (!hash || hash === "#") return ""
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  try {
    return decodeURIComponent(raw)
  } catch {
    return ""
  }
}

// Sépare un lien en chemin et fragment : "/#etapes" -> { path: "/", hash: "#etapes" }, "#x" -> { path: "", hash: "#x" }.
export function splitHref(href) {
  const at = href.indexOf("#")
  if (at === -1) return { path: href, hash: "" }
  return { path: href.slice(0, at), hash: href.slice(at) }
}

// Vrai si le lien porte une ancre et vise la page affichée (chemin identique ou lien "#x" seul).
export function isSamePageAnchor(href, pathname) {
  const { path, hash } = splitHref(href)
  if (!hashTargetId(hash)) return false
  if (path.includes("?")) return false
  return path === "" || path === pathname
}

// Fait défiler jusqu'à la cible du fragment ; scrollIntoView respecte le scroll-padding-top de l'en-tête fixe.
// Renvoie l'élément trouvé, ou null.
export function scrollToHash(hash, doc = document, prepare) {
  const id = hashTargetId(hash)
  if (!id) return null
  const target = doc.getElementById(id)
  if (!target) return null
  prepare?.(target)
  target.scrollIntoView({ block: "start" })
  return target
}

// Défile vers l'ancre de l'URL au montage et à chaque changement de fragment.
// Next cherche la cible au montage du squelette de chargement (loading.js), où elle n'existe pas encore,
// puis oublie l'ancre : quand le vrai contenu arrive, personne ne défile. Ce composant, monté dans le
// contenu de la page, reprend la main une fois la section présente. `prepare` reçoit la cible avant le défilement.
export function HashScroll({ prepare }) {
  useEffect(() => {
    let frame = 0
    const run = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => scrollToHash(window.location.hash, document, prepare))
    }
    run()
    window.addEventListener("hashchange", run)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("hashchange", run)
    }
  }, [prepare])
  return null
}

function plainLeftClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

// Lien vers une ancre. Vers une autre page, Next gère la navigation (HashScroll prend le relais sur l'accueil).
// Vers la page affichée, Next ne défile pas quand le fragment est déjà dans l'URL : on défile nous-mêmes
// et on met l'URL à jour par l'API history.
export function AnchorLink({ href, onClick, ...props }) {
  function handleClick(event) {
    onClick?.(event)
    if (event.defaultPrevented || !plainLeftClick(event)) return
    if (!isSamePageAnchor(href, window.location.pathname)) return
    const { hash } = splitHref(href)
    if (!scrollToHash(hash)) return
    event.preventDefault()
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`)
    }
  }
  return <Link href={href} onClick={handleClick} {...props} />
}
