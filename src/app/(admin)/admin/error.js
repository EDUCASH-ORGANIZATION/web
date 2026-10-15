// @ds-screen RD-ADMIN-01
"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"

// T05 : erreur inattendue d'une page admin, affichée dans la coquille (la navigation reste utilisable).
export default function AdminError({ error, reset }) {
  // Seul le digest est journalisé (jamais le message ni la pile) : il suffit à retrouver l'erreur côté serveur.
  useEffect(() => {
    if (error?.digest) console.error("[admin error]", error.digest)
  }, [error])

  return (
    <div className="empty empty--erreur" role="alert">
      <div className="empty__art">
        <span className="ic-sq"><Icon name="i-alert-triangle" /></span>
      </div>
      <h1 className="empty__title">Une erreur est survenue</h1>
      <div className="empty__text">
        Cette page n&apos;a pas pu s&apos;afficher. Réessayez dans un instant. Si vous veniez de décider, rechargez la file pour vérifier.
      </div>
      <div className="empty__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => reset()}>
          Réessayer
        </button>
        <Link className="btn btn--secondary btn--sm" href="/admin/dashboard">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
