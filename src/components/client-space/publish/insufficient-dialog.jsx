"use client"

import { useRef } from "react"
import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { Lines } from "@/components/app-ui/lines"
import { clientWalletHref } from "@/lib/app/client-routes"
import { formatAmount } from "@/lib/app/format"

/**
 * Solde insuffisant au moment de publier (`wallet_insufficient`). Rien n'est publié ni bloqué : la boîte
 * propose la recharge de la somme manquante (`?recharger=1&montant=`, le lien de reprise est mémorisé par
 * l'assistant) ou le retour à la mission. Échap, piège de focus et retour du focus viennent de `Modal`.
 * @param {{ open: boolean, shortfall: number, available: number|null, required: number, onClose: () => void }} props
 */
export function InsufficientDialog({ open, shortfall, available, required, onClose }) {
  const rechargeRef = useRef(null)
  if (!open) return null
  const missing = formatAmount(shortfall)
  const known = Number.isFinite(available)
  return (
    <Modal
      open
      onClose={onClose}
      title={`Il manque ${missing}`}
      description="Votre portefeuille ne couvre pas le budget de cette mission."
      size="sm"
      initialFocusRef={rechargeRef}
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={onClose}>
            Revenir à ma mission
          </button>
          <Link ref={rechargeRef} className="btn btn--dark" href={clientWalletHref({ recharger: true, montant: shortfall })}>
            <Icon name="i-plus" />
            Recharger {missing}
          </Link>
        </>
      }
    >
      <div className="dialog2__content">
        <Lines
          rows={[
            { label: "Budget à bloquer", value: required },
            ...(known ? [{ label: "Disponible sur votre portefeuille", value: available }] : []),
          ]}
          total={{ label: "Il manque", value: shortfall }}
        />
        <p className="note2 note2--box">
          <Icon name="i-lock" />
          <span>Votre mission n&apos;est pas publiée et rien n&apos;a été bloqué. Une fois rechargé, vous reprendrez la publication.</span>
        </p>
      </div>
    </Modal>
  )
}
