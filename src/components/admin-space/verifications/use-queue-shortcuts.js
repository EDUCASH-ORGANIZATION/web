// @ds-screen RD-ADMIN-01
"use client"

import { useEffect, useRef } from "react"
import { shortcutAction } from "@/lib/admin-space/queue-shortcuts"

/**
 * Raccourcis de la file : flèches (dossier précédent ou suivant), V et R (ouvrent la confirmation de validation
 * ou de refus). Inactifs pendant une saisie, une liste déroulante ou un dialogue ouvert.
 * @param {{
 *   enabled?: boolean, allowed?: string[], dialogOpen?: boolean,
 *   onPrev?: () => void, onNext?: () => void, onApprove?: () => void, onReject?: () => void,
 * }} options
 */
export function useQueueShortcuts({ enabled = true, allowed = [], dialogOpen = false, onPrev, onNext, onApprove, onReject }) {
  const latest = useRef({})
  useEffect(() => {
    latest.current = { allowed, dialogOpen, onPrev, onNext, onApprove, onReject }
  })

  useEffect(() => {
    if (!enabled) return undefined
    const handlers = { prev: "onPrev", next: "onNext", approve: "onApprove", reject: "onReject" }
    const onKeyDown = (event) => {
      const current = latest.current
      const action = shortcutAction({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        target: event.target,
        body: document.body,
        dialogOpen: current.dialogOpen,
        allowed: current.allowed,
      })
      const run = action ? current[handlers[action]] : null
      if (!run) return
      event.preventDefault()
      run()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [enabled])
}
