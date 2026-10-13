"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { useIsCompact } from "./modal"
import { addToast, removeToast, toastDuration } from "./interactive-logic"

const ToastContext = createContext(null)

const ICONS = { success: "i-check", error: "i-alert-circle", info: "i-info" }
const VARIANT_CLASS = { success: "toast--succes", error: "toast--erreur", info: "toast--info" }

export function useAppToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useAppToast doit être utilisé dans ToastProvider")
  return ctx
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div className={`toast ${VARIANT_CLASS[toast.variant]}`}>
      <span className="toast__icon"><Icon name={ICONS[toast.variant]} /></span>
      <div>
        <div className="toast__title">{toast.title}</div>
        {toast.text ? <div className="toast__text">{toast.text}</div> : null}
      </div>
      <button
        type="button"
        className="toast__close btn-icon btn-icon--sm btn-icon--plain"
        aria-label="Fermer la notification"
        onClick={() => onDismiss(toast.id)}
      >
        <Icon name="i-x" />
      </button>
    </div>
  )
}

// Zone d'annonce : présente en permanence pour que les lecteurs d'écran annoncent chaque ajout.
export function ToastViewport({ toasts, onDismiss, compact }) {
  return (
    <div
      className={`toasts ds-toasts-fixed ${compact ? "toasts--mobile" : "toasts--bureau"}`}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

// useAppToast() -> { toast({ title, text, variant, duration }), success(title, text), error(title, text), dismiss(id) }
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)
  const compact = useIsCompact()

  const dismiss = useCallback((id) => setToasts((list) => removeToast(list, id)), [])
  const toast = useCallback(({ title, text, variant = "info", duration }) => {
    const id = ++nextId.current
    setToasts((list) => addToast(list, { id, title, text, variant, duration: toastDuration(variant, duration) }))
    return id
  }, [])

  const api = useMemo(
    () => ({
      toast,
      success: (title, text) => toast({ title, text, variant: "success" }),
      error: (title, text) => toast({ title, text, variant: "error" }),
      dismiss,
    }),
    [toast, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} compact={compact} />
    </ToastContext.Provider>
  )
}

export default ToastProvider
