"use client"

import { useId } from "react"
import { CloseButton, scrimClickHandler, useDialogBehavior, useIsCompact } from "./modal"

const cx = (...parts) => parts.filter(Boolean).join(" ")

function DrawerOpen({ onClose, title, footer, initialFocusRef, children }) {
  const titleId = `${useId()}-title`
  const compact = useIsCompact()
  const containerRef = useDialogBehavior({ onClose, initialFocusRef })

  return (
    <div className="scrim scrim--right ds-scrim-fixed" onClick={scrimClickHandler(onClose)}>
      <aside
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("drawer", compact && "ds-drawer--full")}
      >
        <div className="drawer__head">
          <h2 id={titleId} className="modal__title">{title}</h2>
          <CloseButton onClose={onClose} />
        </div>
        <div className="drawer__body">{children}</div>
        {footer ? <div className="drawer__foot">{footer}</div> : null}
      </aside>
    </div>
  )
}

// Panneau latéral droit, plein écran sous 1024 px. Mêmes garanties de focus que Modal.
export function Drawer({ open, onClose, title, footer, initialFocusRef, children }) {
  if (!open) return null
  return (
    <DrawerOpen onClose={onClose} title={title} footer={footer} initialFocusRef={initialFocusRef}>
      {children}
    </DrawerOpen>
  )
}

export default Drawer
