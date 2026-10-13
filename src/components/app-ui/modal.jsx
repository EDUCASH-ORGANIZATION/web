"use client"

import { useEffect, useId, useRef, useSyncExternalStore } from "react"
import { Icon } from "@/components/design/icon"
import { useModalFocus } from "@/hooks/use-modal-focus"
import { COMPACT_MEDIA_QUERY } from "./interactive-logic"

const cx = (...parts) => parts.filter(Boolean).join(" ")

function subscribeCompact(onChange) {
  const query = window.matchMedia(COMPACT_MEDIA_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

// Vrai sous 1024 px. Faux au rendu serveur et à l'hydratation : les boîtes sont fermées au premier rendu.
export function useIsCompact() {
  return useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_MEDIA_QUERY).matches,
    () => false,
  )
}

// Piège de focus, Échap et retour du focus communs à Modal et Drawer.
export function useDialogBehavior({ onClose, initialFocusRef }) {
  const containerRef = useRef(null)
  const returnFocusRef = useRef(null)
  // Déclaré avant useModalFocus : l'élément qui avait le focus à l'ouverture est mémorisé avant le déplacement du focus.
  useEffect(() => {
    returnFocusRef.current = document.activeElement
  }, [])
  useModalFocus({ containerRef, initialFocusRef, returnFocusRef, onClose })
  return containerRef
}

// Un clic sur le voile (et non dans la boîte) ferme.
export function scrimClickHandler(onClose) {
  return (e) => {
    if (e.target === e.currentTarget) onClose()
  }
}

export function CloseButton({ onClose }) {
  return (
    <button type="button" className="btn-icon btn-icon--sm btn-icon--plain" aria-label="Fermer" onClick={onClose}>
      <Icon name="i-x" />
    </button>
  )
}

function ModalOpen({ onClose, title, description, footer, size, tone, initialFocusRef, children }) {
  const uid = useId()
  const titleId = `${uid}-title`
  const descriptionId = `${uid}-desc`
  const compact = useIsCompact()
  const containerRef = useDialogBehavior({ onClose, initialFocusRef })

  return (
    <div className={cx("scrim ds-scrim-fixed", compact && "scrim--bottom")} onClick={scrimClickHandler(onClose)}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cx(
          compact ? "sheet" : "modal",
          !compact && size === "sm" && "modal--sm",
          !compact && size === "lg" && "modal--lg",
          !compact && tone === "danger" && "modal--danger",
        )}
      >
        {compact ? <div className="sheet__grip" aria-hidden="true" /> : null}
        <div className="modal__head">
          <div>
            <h2 id={titleId} className="modal__title">{title}</h2>
            {description ? <p id={descriptionId} className="modal__sub">{description}</p> : null}
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  )
}

// Boîte de dialogue : modale centrée en bureau, feuille du bas sous 1024 px.
// size : "sm" | "md" | "lg" ; tone : "default" | "danger" (bordure rouge, bureau).
export function Modal({ open, onClose, title, description, footer, size = "md", tone = "default", initialFocusRef, children }) {
  if (!open) return null
  return (
    <ModalOpen
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      size={size}
      tone={tone}
      initialFocusRef={initialFocusRef}
    >
      {children}
    </ModalOpen>
  )
}

export default Modal
