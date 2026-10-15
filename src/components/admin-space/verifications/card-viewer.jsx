// @ds-screen RD-ADMIN-01
"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"

export const ZOOM_STEPS = [100, 150, 200, 300]

/** Pas de zoom suivant ou précédent, borné aux paliers. */
export function nextZoom(current, direction) {
  const at = Math.max(0, ZOOM_STEPS.indexOf(current))
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, at + direction))]
}

/** Rotation suivante par 90 degrés. */
export function nextRotation(current) {
  return (current + 90) % 360
}

/** Plein écran disponible : API présente et autorisée (absente sur Safari iPhone, où le bouton est masqué). */
export function fullscreenSupported(doc, element) {
  return Boolean(doc?.fullscreenEnabled && typeof element?.requestFullscreen === "function")
}

/**
 * Passe la visionneuse (barre d'outils et scène) en plein écran, sans ouvrir d'onglet ni placer l'URL signée dans
 * l'historique. Un refus du navigateur (geste non reconnu, réglage) laisse simplement la carte dans la page.
 */
export function enterFullscreen(element) {
  if (typeof element?.requestFullscreen !== "function") return
  Promise.resolve(element.requestFullscreen()).catch(() => {})
}

/**
 * Quitte le plein écran s'il est actif (avant d'ouvrir une confirmation, qui sinon resterait cachée derrière
 * l'élément plein écran). Sans plein écran actif ou sans API, ne fait rien ; un refus du navigateur est ignoré.
 */
export function leaveFullscreen(doc) {
  if (!doc?.fullscreenElement || typeof doc.exitFullscreen !== "function") return
  Promise.resolve(doc.exitFullscreen()).catch(() => {})
}

function Missing({ text }) {
  const router = useRouter()
  return (
    <div className="a2-note a2-note--alerte" role="status">
      <Icon name="i-alert-triangle" className="ic" />
      <span>
        {text}{" "}
        <button type="button" className="link" onClick={() => router.refresh()}>
          Recharger
        </button>
      </span>
    </div>
  )
}

/**
 * Carte de l'étudiant : image (zoom de 100 à 300 %, rotation par 90 degrés, plein écran) ou PDF ouvert dans un nouvel
 * onglet. Planche v1 (« Carte pivotée », audit 18) : plus d'ouverture de l'image dans un nouvel onglet.
 * `cardView` vient du serveur : `{ kind: "image" | "pdf" | "none", url }`. Le zoom et la rotation passent par des
 * attributs `data-*` lus par la feuille de style, jamais par un style local.
 */
export function CardViewer({ cardView, name }) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [failed, setFailed] = useState(false)
  const [canFullscreen, setCanFullscreen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const viewerRef = useRef(null)
  const fullscreenButtonRef = useRef(null)

  // Détection après montage seulement : le rendu serveur et le premier rendu client restent identiques.
  useEffect(() => {
    setCanFullscreen(fullscreenSupported(document, viewerRef.current))
  }, [cardView?.kind, failed])

  // Suit l'entrée et la sortie (bouton, Échap, décision V ou R) pour le libellé du bouton. À la sortie, le focus
  // revient au bouton, sauf s'il est déjà ailleurs dans la page (confirmation ouverte par V ou R).
  useEffect(() => {
    if (typeof document === "undefined" || typeof document.addEventListener !== "function") return undefined
    const doc = document
    let wasActive = false
    const onChange = () => {
      const viewer = viewerRef.current
      const active = Boolean(viewer) && doc.fullscreenElement === viewer
      setIsFullscreen(active)
      if (wasActive && !active) {
        const focused = doc.activeElement
        if (!focused || focused === doc.body || viewer?.contains?.(focused)) fullscreenButtonRef.current?.focus?.()
      }
      wasActive = active
    }
    doc.addEventListener("fullscreenchange", onChange)
    return () => doc.removeEventListener("fullscreenchange", onChange)
  }, [])

  if (!cardView || cardView.kind === "none" || !cardView.url) {
    return <Missing text="La carte n'est pas disponible : elle n'a pas été envoyée ou le lien a expiré." />
  }

  // Écart assumé avec la planche v1 : un PDF ne peut pas s'afficher dans l'image, il garde son lien d'ouverture.
  if (cardView.kind === "pdf") {
    return (
      <div className="ad-viewer">
        <div className="ad-viewer__tools">
          <a className="btn btn--secondary btn--sm" href={cardView.url} target="_blank" rel="noopener noreferrer">
            <Icon name="i-external" />
            Ouvrir le PDF
          </a>
          <span>La carte est un document PDF.</span>
        </div>
      </div>
    )
  }

  if (failed) return <Missing text="La carte n'a pas pu s'afficher." />

  // L'élément plein écran est la visionneuse entière : zoom, rotation et sortie restent accessibles.
  return (
    <div className="ad-viewer a2-02-viewer" ref={viewerRef}>
      <div className="ad-viewer__tools a2-02-tools">
        <button
          type="button"
          className="btn-icon btn-icon--sm"
          aria-label="Zoom arrière"
          disabled={zoom === ZOOM_STEPS[0]}
          onClick={() => setZoom(nextZoom(zoom, -1))}
        >
          <Icon name="i-minus" />
        </button>
        <button
          type="button"
          className="btn-icon btn-icon--sm"
          aria-label="Zoom avant"
          disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
          onClick={() => setZoom(nextZoom(zoom, 1))}
        >
          <Icon name="i-zoom-in" />
        </button>
        <button
          type="button"
          className="btn-icon btn-icon--sm"
          aria-label="Pivoter de 90 degrés"
          onClick={() => setRotation(nextRotation(rotation))}
        >
          <Icon name="i-rotate" />
        </button>
        {/* Le sprite n'a pas d'icône d'agrandissement : i-external pour entrer, i-x pour sortir. */}
        {canFullscreen ? (
          <button
            type="button"
            className="btn-icon btn-icon--sm"
            ref={fullscreenButtonRef}
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            aria-pressed={isFullscreen}
            onClick={() => (isFullscreen ? leaveFullscreen(document) : enterFullscreen(viewerRef.current))}
          >
            <Icon name={isFullscreen ? "i-x" : "i-external"} />
          </button>
        ) : null}
        <span aria-live="polite">Zoom {zoom} %</span>
      </div>
      <div className="a2-02-stage">
        {/* Image signée hébergée hors du domaine : next/image exigerait une liste de domaines et la réécrirait. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="a2-02-img"
          src={cardView.url}
          alt={`Carte étudiante de ${name}`}
          data-zoom={zoom}
          data-rot={rotation}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  )
}

export default CardViewer
