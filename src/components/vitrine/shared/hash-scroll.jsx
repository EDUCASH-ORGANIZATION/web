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

// Donne le focus à la cible d'une ancre, comme le fait un navigateur pour un fragment natif : une section n'est
// pas focusable, on lui pose tabindex -1 (focus programmatique seulement, hors ordre de tabulation).
// Le défilement a déjà eu lieu : preventScroll évite un second saut.
export function focusTarget(target) {
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
  target.focus({ preventScroll: true })
}

// Fait défiler jusqu'à la cible du fragment ; scrollIntoView respecte le scroll-padding-top de l'en-tête fixe.
// `prepare` reçoit la cible avant le défilement. Renvoie l'élément trouvé, ou null.
export function scrollToHash(hash, doc = document, prepare) {
  const id = hashTargetId(hash)
  if (!id) return null
  const target = doc.getElementById(id)
  if (!target) return null
  prepare?.(target)
  target.scrollIntoView({ block: "start" })
  return target
}

// Marge sous laquelle la page est considérée "en haut" : au-delà, le navigateur a restauré une position
// (retour arrière, rechargement) qu'un défilement au montage écraserait.
const TOP_TOLERANCE = 4

// Un clic sur un lien d'ancre vers une autre page marque la navigation : à l'arrivée, la page peut encore porter
// la position de défilement de la page quittée, et HashScroll doit défiler quand même. Un retour arrière ou un
// rechargement ne passent pas par un clic : leur position restaurée est respectée.
const NAVIGATION_TTL = 10000
let navigationAt = 0

function consumeNavigation() {
  const recent = Date.now() - navigationAt < NAVIGATION_TTL
  navigationAt = 0
  return recent
}

// Au montage : défile si la page est en haut ou si on arrive par un clic d'ancre. Sinon (position restaurée),
// ne défile pas ; si la cible est déjà en haut de l'écran (fragment honoré par le navigateur), y place le focus.
function mountScroll(prepare, arrivedByClick) {
  const hash = window.location.hash
  if (arrivedByClick || window.scrollY <= TOP_TOLERANCE) {
    const target = scrollToHash(hash, document, prepare)
    if (target) focusTarget(target)
    return
  }
  const id = hashTargetId(hash)
  const target = id ? document.getElementById(id) : null
  if (!target) return
  const { top } = target.getBoundingClientRect()
  if (top >= 0 && top < window.innerHeight / 2) focusTarget(target)
}

// Défile vers l'ancre de l'URL au montage et à chaque changement de fragment, puis y place le focus.
// Next cherche la cible au montage du squelette de chargement (loading.js), où elle n'existe pas encore,
// puis oublie l'ancre : quand le vrai contenu arrive, personne ne défile. Ce composant, monté dans le
// contenu de la page, reprend la main une fois la section présente. Au montage, il ne défile pas par-dessus
// une position restaurée (voir mountScroll) ; hashchange reste inconditionnel.
export function HashScroll({ prepare }) {
  useEffect(() => {
    let frame = 0
    const arrivedByClick = consumeNavigation()
    const run = (atMount) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (atMount) {
          mountScroll(prepare, arrivedByClick)
          return
        }
        const target = scrollToHash(window.location.hash, document, prepare)
        if (target) focusTarget(target)
      })
    }
    const onHashChange = () => run(false)
    run(true)
    window.addEventListener("hashchange", onHashChange)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("hashchange", onHashChange)
    }
  }, [prepare])
  return null
}

// Clic gauche simple : ni touche modificatrice, ni cible autre que la fenêtre courante, ni téléchargement.
export function plainLeftClick({ button, metaKey, ctrlKey, shiftKey, altKey, target, download }) {
  if (button !== 0 || metaKey || ctrlKey || shiftKey || altKey) return false
  if (download) return false
  return !target || target === "_self"
}

// Décision pure pour un clic sur un lien d'ancre. `click` décrit l'évènement, `location` la page affichée
// ({ pathname, hash }), `hasTarget` dit si la cible existe dans le document.
// Renvoie { prevent, push } : prevent annule la navigation de Next (on défile nous-mêmes), push demande
// d'ajouter l'entrée d'historique (inutile si le fragment est déjà dans l'URL).
export function anchorClickAction(click, href, location, hasTarget) {
  const none = { prevent: false, push: false }
  if (click.defaultPrevented || !plainLeftClick(click)) return none
  if (!isSamePageAnchor(href, location.pathname)) return none
  if (!hasTarget) return none
  const { hash } = splitHref(href)
  return { prevent: true, push: location.hash !== hash }
}

// Lien vers une ancre. Vers une autre page, Next gère la navigation (HashScroll prend le relais sur l'accueil).
// Vers la page affichée, Next ne défile pas quand le fragment est déjà dans l'URL : on défile nous-mêmes,
// on met l'URL à jour par l'API history et on déplace le focus sur la cible.
export function AnchorLink({ href, onClick, ...props }) {
  function handleClick(event) {
    onClick?.(event)
    const { hash } = splitHref(href)
    const link = event.currentTarget
    const click = {
      button: event.button,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      defaultPrevented: event.defaultPrevented,
      target: link.getAttribute("target"),
      download: link.hasAttribute("download"),
    }
    const action = anchorClickAction(click, href, window.location, !!document.getElementById(hashTargetId(hash)))
    if (!action.prevent) {
      if (!click.defaultPrevented && plainLeftClick(click) && hashTargetId(hash)) navigationAt = Date.now()
      return
    }
    const target = scrollToHash(hash)
    event.preventDefault()
    // Choix assumé : la query string est conservée (le lien "#x" reste sur la même page, filtres compris).
    if (action.push) {
      window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`)
    }
    // Après la fermeture éventuelle d'un menu modal (onClick), qui rend le focus à son déclencheur.
    requestAnimationFrame(() => focusTarget(target))
  }
  return <Link href={href} onClick={handleClick} {...props} />
}
