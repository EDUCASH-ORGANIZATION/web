// @ds-screen RD-STUDENT-01
import { Icon } from "@/components/design/icon"
import { Enlargeable } from "@/components/messaging/image-viewer"
import { PlaceLinks } from "@/components/messaging/place-links"
import { PURCHASE_PREVIEW, formatClock, isPurchaseMessageType } from "@/lib/client-space/conversations"
import { PURCHASE_EVENTS, purchaseMessageContent } from "@/lib/purchases/requests"
import { PurchaseCard } from "./purchase/purchase-card"
import { PurchaseEventLine } from "./purchase/purchase-event-line"

const cx = (...parts) => parts.filter(Boolean).join(" ")

function Body({ message, onMediaError }) {
  if (message.type === "image") {
    // Pas de lien vers l'objet brut : il servirait un fichier HTML déguisé sur l'origine du stockage. L'adresse
    // affichée est toujours une adresse signée ; sur erreur de chargement la vue la renouvelle une fois.
    return message.mediaUrl ? (
      <Enlargeable url={message.mediaUrl} caption="Image envoyée" label="Agrandir l'image envoyée" onError={() => onMediaError?.(message.id)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="e2-07-photo" src={message.mediaUrl} alt="Image envoyée" loading="lazy" onError={() => onMediaError?.(message.id)} />
      </Enlargeable>
    ) : (
      <span className="e2-07-text">Image indisponible</span>
    )
  }
  if (message.type === "voice") {
    return message.mediaUrl ? (
      <audio className="e2-07-audio" src={message.mediaUrl} controls preload="metadata" aria-label="Message vocal" onError={() => onMediaError?.(message.id)} />
    ) : (
      <span className="e2-07-text">Message vocal indisponible</span>
    )
  }
  if (message.type === "location") {
    // Liens Google Maps construits par PlaceLinks à partir de nombres validés, jamais d'un texte reçu.
    return <PlaceLinks lat={message.lat} lng={message.lng} linkClassName="e2-07-place" />
  }
  // Texte : affiché tel quel (échappé par React), sans lien ni mise en forme.
  return <span className="e2-07-text">{message.content}</span>
}

function Meta({ message, status, error }) {
  if (status === "sending") return <div className="bubble__meta">Envoi en cours...</div>
  if (status === "failed") return <div className="bubble__meta">{error}</div>
  return (
    <div className="bubble__meta">
      {formatClock(message.createdAt)}
      {message.mine ? (
        <>
          <Icon name={message.read ? "i-check-double" : "i-check"} />
          <span className="sr-only">{message.read ? "Lu" : "Envoyé"}</span>
        </>
      ) : null}
    </div>
  )
}

/** Identifiant d'ancre de la carte d'une demande (drapeau d'URL `?demande=<id>`). */
export const purchaseAnchorId = (requestId) => `demande-${requestId}`

// Ligne neutre quand la demande d'un message d'achat n'est pas (ou plus) lisible : jamais le contenu de la ligne.
function PurchaseFallback({ event = false }) {
  return (
    <div className="msg-system">
      <Icon name="i-receipt" />
      {event ? PURCHASE_PREVIEW.purchase_event : `${PURCHASE_PREVIEW.purchase_request} : détails momentanément indisponibles.`}
    </div>
  )
}

// Événement d'une ligne système : celui dont le texte fixe du serveur est le contenu reçu, pour le numéro de la demande.
const eventOf = (request, content) =>
  PURCHASE_EVENTS.find((event) => purchaseMessageContent("purchase_event", request.seq, event) === content) ?? null

/**
 * Message d'achat : la carte `purchase_request` (PurchaseCard) ou la ligne système `purchase_event`. Aucun
 * « Signaler ce message » : le signalement se fait sur la carte. `purchase` : { request (la demande du message, ou
 * absente), clientName, missionStatus, busy, onEdit, onCancel, onConfirmReceived, onReport }.
 */
function PurchaseMessage({ message, purchase }) {
  const request = purchase?.request
  if (!request) return <PurchaseFallback event={message.type === "purchase_event"} />
  if (message.type === "purchase_event") {
    const event = eventOf(request, message.content)
    return event ? <PurchaseEventLine event={event} seq={request.seq} /> : <PurchaseFallback event={message.type === "purchase_event"} />
  }
  return (
    <div id={purchaseAnchorId(request.id)} className="e2-07-card">
      <PurchaseCard
        request={request}
        clientName={purchase.clientName}
        missionStatus={purchase.missionStatus}
        alreadyReportedByMe={request.alreadyReportedByMe === true}
        busy={purchase.busy === true}
        onEdit={purchase.onEdit}
        onCancel={purchase.onCancel}
        onConfirmReceived={purchase.onConfirmReceived}
        onReport={purchase.onReport}
        onPhotoError={purchase.onPhotoError}
      />
    </div>
  )
}

/**
 * Bulle de message. `status` : "sent" (défaut), "sending" ou "failed" (message de l'étudiant pas encore
 * livré : `error` en méta, « Réessayer » et « Supprimer » sous la bulle). `onReport(message)` facultative : le bouton
 * « Signaler » n'apparaît que sur un message reçu et livré, jamais sur ceux de l'étudiant, ni sur un message d'achat.
 */
export function Bubble({ message, senderName, status = "sent", error, onRetry, onDismiss, onMediaError, onReport, purchase }) {
  if (isPurchaseMessageType(message.type)) return <PurchaseMessage message={message} purchase={purchase} />
  return (
    <>
      <div
        className={cx(
          "bubble",
          message.mine ? "bubble--me" : "bubble--them",
          message.type === "image" && "bubble--media",
          status === "sending" && "is-sending",
          status === "failed" && "is-failed",
        )}
      >
        <span className="sr-only">{message.mine ? "Vous" : senderName} : </span>
        <Body message={message} onMediaError={onMediaError} />
        <Meta message={message} status={status} error={error} />
      </div>
      {onReport && !message.mine && status === "sent" ? (
        <div className="e2-07-report">
          <button type="button" className="btn btn--ghost btn--sm" aria-label={`Signaler ce message de ${senderName}`} onClick={() => onReport(message)}>
            <Icon name="i-flag" />
            Signaler
          </button>
        </div>
      ) : null}
      {status === "failed" ? (
        <div className="e2-07-fail">
          <button type="button" className="btn btn--soft btn--sm" onClick={onRetry}>
            <Icon name="i-refresh" />
            Réessayer
          </button>
          <button type="button" className="btn btn--ghost btn--sm e2-07-dismiss" onClick={onDismiss}>
            Supprimer
          </button>
        </div>
      ) : null}
    </>
  )
}

export default Bubble
