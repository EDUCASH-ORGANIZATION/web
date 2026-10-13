// @ds-screen RD-CLIENT-01
"use client"

import Link from "next/link"
import { Icon } from "@/components/design/icon"

// T05 : erreur inattendue d'une page client, affichée dans la coquille (la navigation reste utilisable).
export default function ClientError({ reset }) {
  return (
    <div className="empty empty--erreur" role="alert">
      <div className="empty__art">
        <span className="ic-sq"><Icon name="i-alert-triangle" /></span>
      </div>
      <h1 className="empty__title">Une erreur est survenue</h1>
      <div className="empty__text">
        Cette page n&apos;a pas pu s&apos;afficher. Vos fonds sont en sécurité : aucune opération n&apos;a été modifiée.
      </div>
      <div className="empty__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => reset()}>
          Réessayer
        </button>
        <Link className="btn btn--secondary btn--sm" href="/contact">
          Contacter le support
        </Link>
      </div>
    </div>
  )
}
