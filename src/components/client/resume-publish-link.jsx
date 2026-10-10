"use client"

import { useEffect, useSyncExternalStore } from "react"
import Link from "next/link"
import { ArrowRight, X } from "lucide-react"
import { PUBLISH_RESUME_KEY, resumePublishHref } from "@/lib/utils/publish-prefill"

const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function readStored() {
  try {
    return resumePublishHref(window.sessionStorage.getItem(PUBLISH_RESUME_KEY))
  } catch {
    return null
  }
}

/** Présentation du lien de reprise (sans accès au stockage). */
export function ResumePublishView({ href, onForget }) {
  if (!href) return null
  return (
    <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
      <Link
        href={href}
        className="flex items-center gap-2 text-sm font-bold text-[#1A6B4A] hover:underline touch-manipulation"
      >
        Reprendre la publication de votre mission
        <ArrowRight size={16} />
      </Link>
      <button
        type="button"
        onClick={onForget}
        aria-label="Oublier la publication en cours"
        className="p-1 text-green-800 hover:text-green-900 touch-manipulation"
      >
        <X size={16} />
      </button>
    </div>
  )
}

/**
 * Lien de reprise d'une publication interrompue par le rechargement du portefeuille.
 * - `store` : enregistre `href` (validé) dans sessionStorage, ne rend rien.
 * - `show` : lit et revalide la valeur stockée, affiche le lien de reprise.
 * @param {{ mode: "store"|"show", href?: string }} props
 */
export function ResumePublishLink({ mode, href }) {
  const stored = useSyncExternalStore(subscribe, readStored, () => null)

  useEffect(() => {
    if (mode !== "store") return
    const safe = resumePublishHref(href)
    if (!safe) return
    try {
      window.sessionStorage.setItem(PUBLISH_RESUME_KEY, safe)
    } catch {
      // stockage indisponible : la reprise n'est simplement pas proposée
    }
  }, [mode, href])

  function forget() {
    try {
      window.sessionStorage.removeItem(PUBLISH_RESUME_KEY)
    } catch {
      // rien à oublier si le stockage est indisponible
    }
    listeners.forEach((listener) => listener())
  }

  if (mode !== "show") return null
  return <ResumePublishView href={stored} onForget={forget} />
}
