"use client"

import { useEffect } from "react"

function openFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(1))
  if (!id) return
  const target = document.getElementById(id)
  if (!target) return
  const details = target.tagName === "DETAILS" ? target : target.querySelector("details")
  if (details) details.open = true
  target.scrollIntoView({ block: "start" })
}

// Ouvre la question ciblée par l'ancre de l'URL (/aide#achats), au montage et à chaque changement.
export function FaqHashOpener() {
  useEffect(() => {
    openFromHash()
    window.addEventListener("hashchange", openFromHash)
    return () => window.removeEventListener("hashchange", openFromHash)
  }, [])
  return null
}
