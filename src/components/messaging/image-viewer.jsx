"use client"

// Visionneuse commune de la messagerie (client et étudiant) : une photo reçue (preuve d'une demande de paiement
// d'achats ou image d'une bulle) s'ouvre en grand au clic, pour la lire. Les adresses sont signées à courte durée
// de vie : si la photo ne se charge plus dans la visionneuse, un message l'explique et `onError` permet à la vue de
// renouveler l'adresse. La boîte est rendue dans <body> : une bulle ou une carte peut avoir un ancêtre qui casserait
// le positionnement fixe du voile (voir app-ui/modal).

import { useState } from "react"
import { createPortal } from "react-dom"
import { Modal } from "@/components/app-ui/modal"

export const VIEWER_ERROR_TEXT = "Photo indisponible, actualisez la conversation"

function ViewerBody({ url, caption, onError }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <p className="viewer2__error">{VIEWER_ERROR_TEXT}</p>
  return (
    <>
      {/* Adresse signée à courte durée de vie : jamais next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="viewer2__img"
        src={url}
        alt={caption}
        onError={() => {
          setBroken(true)
          onError?.()
        }}
      />
      <a className="link2" href={url} target="_blank" rel="noopener noreferrer">
        Ouvrir dans un nouvel onglet
      </a>
    </>
  )
}

/** Photo en grand dans une boîte de dialogue ; `caption` (nature de la photo) sert de titre et de texte alternatif. */
export function ImageViewer({ url, caption, onClose, onError }) {
  return createPortal(
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={caption}
      footer={
        <button type="button" className="btn btn--soft" onClick={onClose}>
          Fermer
        </button>
      }
    >
      <ViewerBody key={url} url={url} caption={caption} onError={onError} />
    </Modal>,
    document.body,
  )
}

/**
 * Enveloppe cliquable d'une vignette : un vrai bouton (`label` = « Agrandir la photo du ticket ») qui ouvre la
 * visionneuse. Sans `url`, la vignette n'est pas cliquable : les enfants sont rendus tels quels.
 */
export function Enlargeable({ url, caption, label, onError, children }) {
  const [open, setOpen] = useState(false)
  if (!url) return children
  return (
    <>
      <button type="button" className="zoom-btn2" aria-label={label} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? <ImageViewer url={url} caption={caption} onClose={() => setOpen(false)} onError={onError} /> : null}
    </>
  )
}

export default Enlargeable
