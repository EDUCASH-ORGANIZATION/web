"use client"

// Avertissement non bloquant avant l'envoi : le texte saisi contient une coordonnée ou un mot-clé de contournement.
// Vue pure (aucun accès aux données). L'envoi reste possible : le masquage est fait par le serveur.

import { useMemo } from "react"
import { Icon } from "@/components/design/icon"
import { contactWarning } from "@/lib/messaging/contact-copy"
import { detectContacts } from "@/lib/messaging/contact-filter"

export function ContactWarning({ text }) {
  const message = useMemo(() => {
    if (typeof text !== "string" || !text.trim()) return null
    return contactWarning(detectContacts(text).kinds)
  }, [text])
  if (!message) return null
  return (
    <div className="banner banner--info" role="status">
      <Icon name="i-info" />
      <div className="banner__body">{message}</div>
    </div>
  )
}

export default ContactWarning
