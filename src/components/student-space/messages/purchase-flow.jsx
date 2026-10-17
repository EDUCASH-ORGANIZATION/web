"use client"

// @ds-screen RD-STUDENT-01
// Câblage des demandes de paiement d'achats dans la conversation de l'étudiant (E07, ST-10) : fenêtres de la carte
// (formulaire, annulation, « Reçu par le vendeur », signalement) branchées sur les actions serveur. Les vues viennent
// de `./purchase/` ; les écritures passent par `@/lib/actions/purchase-request.actions` (jamais par le navigateur,
// hors le téléversement des photos, injecté par `upload`). Chaque fenêtre est un Modal, rendu à côté de la liste.
import { useEffect, useRef } from "react"
import { ConfirmDialog } from "@/components/app-ui/confirm-dialog"
import {
  cancelPurchaseRequest,
  confirmPurchaseReceived,
  createPurchaseRequest,
  editPurchaseRequest,
  reportPurchaseRequestAsStudent,
} from "@/lib/actions/purchase-request.actions"
import { REPORT_FALLBACK_ERROR } from "@/components/messaging/report-dialog"
import { PurchaseFormDialog } from "./purchase/purchase-form-dialog"
import { PurchaseReceivedDialog } from "./purchase/purchase-received-dialog"
import { PurchaseReportDialog } from "./purchase/purchase-report-dialog"

export const PURCHASE_ACTION_FALLBACK_ERROR = "L'opération n'a pas abouti. Vérifiez votre connexion et réessayez."
/** Identifiant de demande tiré côté navigateur avant le téléversement (le dossier des preuves le contient). */
export const newRequestId = () => crypto.randomUUID()

export const PHOTO_UPLOAD_ERROR = "Photo non envoyée. Vérifiez votre connexion et réessayez."

/**
 * Adapte la réponse d'une action serveur au contrat des fenêtres : `{ ok: true }`, `{ error }` ou `{ fieldErrors }`.
 * Une réponse absente ou sans succès explicite est une erreur (jamais un succès par défaut).
 * @param {unknown} result
 * @returns {{ ok: true } | { error: string } | { fieldErrors: Record<string, string> }}
 */
export function adaptPurchaseResult(result) {
  if (result && typeof result === "object") {
    if (result.fieldErrors && typeof result.fieldErrors === "object") return { fieldErrors: result.fieldErrors }
    if (typeof result.error === "string" && result.error !== "") return { error: result.error }
    if (result.success === true) return { ok: true }
  }
  return { error: PURCHASE_ACTION_FALLBACK_ERROR }
}

/** Adaptation du signalement : `{ reference }` ou `{ error }`. */
export function adaptReportResult(result) {
  if (result?.error) return { error: result.error }
  if (result?.success === true && typeof result.reference === "string") return { reference: result.reference }
  return { error: REPORT_FALLBACK_ERROR }
}

// Confirmation d'envoi : le nom du client finit parfois par un point (« Afiavi D. »), jamais deux.
const sentText = (clientName) => {
  const who = clientName || "le client"
  return `Votre demande a été envoyée à ${who}${who.endsWith(".") ? "" : "."}`
}

// Valeurs de départ du formulaire de modification : les chemins des preuves actuelles et leurs adresses signées.
function editValues(request) {
  return {
    payeeKind: request.payeeKind,
    payeeNumber: request.payeeNumber,
    vendorName: request.vendorName,
    items: request.items ?? "",
    amount: request.amount,
    payeePhoto: request.payeePhotoPath ? { path: request.payeePhotoPath, previewUrl: request.payeePhotoUrl ?? null } : null,
    ticketPhoto: request.ticketPhotoPath ? { path: request.ticketPhotoPath, previewUrl: request.ticketPhotoUrl ?? null } : null,
  }
}

/**
 * Fenêtre ouverte, selon `dialog` :
 * - `{ kind: "form", mode: "create", requestId, seq }` ou `{ kind: "form", mode: "edit", request }` ;
 * - `{ kind: "cancel" | "received" | "report", request }`.
 * `onChanged(texte?)` relit les demandes après une action (réussie ou périmée) ; `onClose()` ferme ; `onReport(request)` ouvre le
 * signalement (« Le vendeur n'a rien reçu »). `upload({ requestId, kind, file })` renvoie `{ path }` ou `{ error }` (hook partagé).
 */
export function PurchaseDialogs({ dialog, missionId, clientName, estimate, otherRequested, upload, onChanged, onClose, onReport }) {
  const previews = useRef([])
  useEffect(
    () => () => {
      previews.current.forEach((url) => URL.revokeObjectURL(url))
      previews.current = []
    },
    [],
  )
  if (!dialog) return null
  const { request } = dialog

  // Relecture après toute réponse, même refusée : une version périmée se règle en relisant la demande. `doneText`
  // (confirmation affichée dans la conversation) n'est transmis qu'en cas de succès.
  const settle = async (run, doneText) => {
    let outcome
    try {
      outcome = adaptPurchaseResult(await run())
    } catch {
      outcome = { error: PURCHASE_ACTION_FALLBACK_ERROR }
    }
    onChanged(outcome.ok ? doneText : undefined)
    return outcome
  }

  if (dialog.kind === "form") {
    const edit = dialog.mode === "edit"
    const requestId = edit ? request.id : dialog.requestId
    const uploadPhoto = async ({ kind, file }) => {
      let result
      try {
        result = await upload({ requestId, kind, file })
      } catch {
        result = { error: PHOTO_UPLOAD_ERROR }
      }
      if (!result?.path) return { error: result?.error || PHOTO_UPLOAD_ERROR }
      const previewUrl = URL.createObjectURL(file)
      previews.current.push(previewUrl)
      return { path: result.path, previewUrl }
    }
    const submit = (data) =>
      settle(
        () =>
          edit
            ? editPurchaseRequest({ requestId, expectedVersion: request.version, ...data })
            : createPurchaseRequest({ missionId, requestId, ...data }),
        edit ? "Votre demande a été modifiée." : sentText(clientName),
      )
    return (
      <PurchaseFormDialog
        key={requestId}
        mode={edit ? "edit" : "create"}
        seq={edit ? request.seq : dialog.seq}
        clientName={clientName}
        initialValues={edit ? editValues(request) : undefined}
        estimate={estimate}
        otherRequested={otherRequested}
        onUploadPhoto={uploadPhoto}
        onSubmit={submit}
        onClose={onClose}
      />
    )
  }

  if (dialog.kind === "cancel") {
    return (
      <ConfirmDialog
        open
        onClose={onClose}
        cancelLabel="Garder la demande"
        steps={[
          {
            title: "Annuler cette demande de paiement ?",
            description: `${clientName || "Le client"} ne la verra plus parmi les paiements à effectuer. Vous pourrez en envoyer une nouvelle.`,
            confirmLabel: "Annuler la demande",
          },
        ]}
        onConfirm={() =>
          settle(() => cancelPurchaseRequest({ requestId: request.id, expectedVersion: request.version }), "Votre demande a été annulée.")
        }
      />
    )
  }

  if (dialog.kind === "received") {
    return (
      <PurchaseReceivedDialog
        request={request}
        clientName={clientName}
        onConfirm={() =>
          settle(
            () => confirmPurchaseReceived({ requestId: request.id, expectedVersion: request.version }),
            "Réception confirmée. La carte est verrouillée.",
          )
        }
        onNotReceived={() => onReport(request)}
        onClose={onClose}
      />
    )
  }

  if (dialog.kind === "report") {
    const submitReport = async ({ reason, details }) => {
      let outcome
      try {
        outcome = adaptReportResult(await reportPurchaseRequestAsStudent({ requestId: request.id, reason, details }))
      } catch {
        outcome = { error: REPORT_FALLBACK_ERROR }
      }
      if (!outcome.error) onChanged()
      return outcome
    }
    return <PurchaseReportDialog key={request.id} request={request} onSubmit={submitReport} onClose={onClose} />
  }
  return null
}

export default PurchaseDialogs
