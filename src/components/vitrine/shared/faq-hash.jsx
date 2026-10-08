"use client"

import { HashScroll } from "./hash-scroll"

function openDetails(target) {
  const details = target.tagName === "DETAILS" ? target : target.querySelector("details")
  if (details) details.open = true
}

// Ouvre la question ciblée par l'ancre de l'URL (/aide#achats), au montage et à chaque changement.
export function FaqHashOpener() {
  return <HashScroll prepare={openDetails} />
}
