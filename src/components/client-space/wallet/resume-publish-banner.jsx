"use client"

import { useEffect, useSyncExternalStore } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PUBLISH_RESUME_KEY, resumePublishHref } from "@/lib/utils/publish-prefill"

// Lien de reprise d'une publication interrompue par la recharge du portefeuille, version système de
// design. Mêmes clés que l'ancien lien (`PUBLISH_RESUME_KEY`, sessionStorage de l'onglet) : la valeur
// stockée est revalidée à chaque lecture par `resumePublishHref` (chemin interne de publication seulement).

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

/** Présentation du lien de reprise (sans accès au stockage). Rien n'est rendu sans lien valide. */
export function ResumePublishBannerView({ href, onForget }) {
  if (!href) return null
  return (
    <div className="banner banner--info" role="status">
      <Icon name="i-arrow-right" />
      <div className="banner__body">
        <div className="banner__title">Votre publication est en pause</div>
        Rechargez votre portefeuille, puis reprenez là où vous vous êtes arrêté.
      </div>
      <div className="banner__actions">
        <Link className="link2" href={href}>
          Reprendre la publication de votre mission
        </Link>
        <button type="button" className="btn-icon btn-icon--sm" aria-label="Oublier la publication en cours" onClick={onForget}>
          <Icon name="i-x" />
        </button>
      </div>
    </div>
  )
}

/**
 * - `mode="store"` : enregistre `href` (validé) dans sessionStorage, ne rend rien.
 * - `mode="show"` : lit et revalide la valeur stockée, affiche le lien de reprise.
 * @param {{ mode: "store"|"show", href?: string }} props
 */
export function ResumePublishBanner({ mode, href }) {
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
  return <ResumePublishBannerView href={stored} onForget={forget} />
}

export default ResumePublishBanner
