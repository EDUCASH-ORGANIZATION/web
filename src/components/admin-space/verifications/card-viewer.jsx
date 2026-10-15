// @ds-screen RD-ADMIN-01
"use client"

import { useState } from "react"
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
 * Carte de l'étudiant : image (zoom de 100 à 300 %, rotation par 90 degrés) ou PDF ouvert dans un nouvel onglet.
 * `cardView` vient du serveur : `{ kind: "image" | "pdf" | "none", url }`. Le zoom et la rotation passent par des
 * attributs `data-*` lus par la feuille de style, jamais par un style local.
 */
export function CardViewer({ cardView, name }) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [failed, setFailed] = useState(false)

  if (!cardView || cardView.kind === "none" || !cardView.url) {
    return <Missing text="La carte n'est pas disponible : elle n'a pas été envoyée ou le lien a expiré." />
  }

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

  return (
    <div className="ad-viewer">
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
        <a
          className="btn-icon btn-icon--sm"
          href={cardView.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ouvrir la carte dans un nouvel onglet"
        >
          <Icon name="i-external" />
        </a>
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
