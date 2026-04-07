"use client"

import { useState, useEffect, useRef } from "react"
import { Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const DISMISSED_KEY = "pwa_banner_dismissed_until"
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

export function PwaInstallBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const deferredPromptRef = useRef(null)

  useEffect(() => {
    // Ne pas afficher si déjà dismissé récemment
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY)
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return

    const handler = (e) => {
      e.preventDefault()
      deferredPromptRef.current = e
      setIsVisible(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") {
      deferredPromptRef.current = null
      setIsVisible(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_DURATION_MS))
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex items-start gap-3 max-w-lg mx-auto">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#1A6B4A] flex items-center justify-center">
          <Download size={20} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            Installer EduCash
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Accède à tes missions directement depuis ton écran d&apos;accueil
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleInstall}
            >
              Installer l&apos;application
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
            >
              Plus tard
            </Button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
