"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { Icon } from "@/components/design/icon"
import { useAppToast } from "./toast"

function subscribeOnline(onChange) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

// Bandeau encre affiché hors connexion ; au retour du réseau, un toast le confirme.
// À placer sous ToastProvider.
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
  const { success } = useAppToast()
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
    } else if (wasOffline.current) {
      wasOffline.current = false
      success("Connexion rétablie")
    }
  }, [online, success])

  if (online) return null
  return (
    <div className="banner banner--encre banner--page" role="status">
      <Icon name="i-wifi-off" />
      <div className="banner__body">
        <div className="banner__title">Vous êtes hors connexion</div>
        Vos actions seront de nouveau disponibles dès le retour du réseau.
      </div>
    </div>
  )
}

export default OfflineBanner
