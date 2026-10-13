"use client"

// Modal et Drawer : pas de portail. Le voile est en `position: fixed` dans l'arbre où le composant est
// rendu ; un ancêtre avec `transform`, `filter` ou `contain` casserait ce positionnement (le voile
// ne couvrirait plus la fenêtre). Ne placez donc pas une Modal dans un <form> (les boutons de la boîte
// le soumettraient), un <p> (HTML invalide) ni un `.item2` (transform possible) : rendez-la à côté.
// Les dialogues empilés (Drawer puis ConfirmDialog) partagent une pile au niveau du module : seul celui
// du dessus traite Échap et le piège de focus.

import { useEffect, useId, useRef, useSyncExternalStore } from "react"
import { Icon } from "@/components/design/icon"
import { trapFocus } from "@/hooks/use-modal-focus"
import { COMPACT_MEDIA_QUERY, createDialogStack, createScrimGuard, gateDocument } from "./interactive-logic"

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

// Pile des dialogues ouverts, au niveau du module (un seul document).
const dialogs = createDialogStack()

// Piège de focus, Échap et retour du focus communs à Modal et Drawer. Seul le dialogue du dessus
// de la pile traite Échap et Tab ; à la fermeture, celui du dessous reprend la main.
export function useDialogBehavior({ onClose, initialFocusRef }) {
  const containerRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const token = useId()
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    const returnTarget = document.activeElement
    dialogs.push(token)
    const cleanup = trapFocus({
      doc: gateDocument(document, () => dialogs.isTop(token)),
      getContainer: () => containerRef.current,
      initialFocus: initialFocusRef?.current,
      returnTarget,
      onClose: () => onCloseRef.current?.(),
    })
    return () => {
      cleanup()
      dialogs.remove(token)
    }
  }, [token, initialFocusRef])
  return containerRef
}

// Poignées du voile : ferme seulement si l'appui et le clic sont tous deux sur le voile (pas dans la boîte).
export function useScrimClose(onClose) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const guardRef = useRef(null)
  if (guardRef.current === null) guardRef.current = createScrimGuard(() => onCloseRef.current?.())
  return guardRef.current
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
  const scrim = useScrimClose(onClose)

  return (
    <div className={cx("scrim ds-scrim-fixed", compact && "scrim--bottom")} onPointerDown={scrim.onPointerDown} onClick={scrim.onClick}>
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
