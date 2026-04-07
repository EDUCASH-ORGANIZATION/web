"use client"

import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { CheckCircle, XCircle, Info, X } from "lucide-react"
import clsx from "clsx"

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast doit être utilisé dans Toaster")
  return ctx
}

// ─── Toaster Provider + UI ───────────────────────────────────────────────────

const ICONS = {
  success: <CheckCircle size={18} className="text-emerald-500 shrink-0" />,
  error: <XCircle size={18} className="text-red-500 shrink-0" />,
  info: <Info size={18} className="text-blue-500 shrink-0" />,
}

let toastId = 0

export function Toaster({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(({ message, type = "info", duration = 4000 }) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast stack */}
      <div
        aria-live="polite"
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0 lg:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "flex items-start gap-3 rounded-xl bg-white shadow-lg border border-gray-100 px-4 py-3",
              "animate-in slide-in-from-bottom-2 fade-in duration-200"
            )}
          >
            {ICONS[t.type]}
            <p className="flex-1 text-sm text-gray-800">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
