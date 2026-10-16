import { Icon } from "@/components/design/icon"
import { PlaceLinks } from "@/components/messaging/place-links"
import { coordsValid, formatClock } from "@/lib/client-space/conversations"

const cx = (...parts) => parts.filter(Boolean).join(" ")

function Body({ message, onMediaError }) {
  if (message.type === "image") {
    // Pas de lien vers l'objet brut : il servirait un fichier HTML déguisé sur l'origine du stockage. L'adresse
    // affichée est toujours une adresse signée ; sur erreur de chargement la vue la renouvelle une fois.
    return message.mediaUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="bubble__photo2" src={message.mediaUrl} alt="Image envoyée" loading="lazy" onError={() => onMediaError?.(message.id)} />
    ) : (
      <span className="bubble__text2">Image indisponible</span>
    )
  }
  if (message.type === "voice") {
    return message.mediaUrl ? (
      <audio className="bubble__audio2" src={message.mediaUrl} controls preload="metadata" aria-label="Message vocal" onError={() => onMediaError?.(message.id)} />
    ) : (
      <span className="bubble__text2">Message vocal indisponible</span>
    )
  }
  if (message.type === "location") {
    return coordsValid(message.lat, message.lng) ? (
      <PlaceLinks lat={message.lat} lng={message.lng} linkClassName="bubble__place2" />
    ) : (
      <span className="bubble__text2">Position indisponible</span>
    )
  }
  // Texte : affiché tel quel (échappé par React), sans lien ni mise en forme.
  return <span className="bubble__text2">{message.content}</span>
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

/**
 * Bulle de message. `status` : "sent" (défaut), "sending" ou "failed" (message de l'utilisateur pas encore
 * livré : `error` en méta, « Réessayer » et « Supprimer » sous la bulle). `onReport(message)` (facultatif) ajoute
 * « Signaler » sur un message reçu et livré ; `maskedNote` est la note de masquage sous la bulle de l'expéditeur.
 */
export function Bubble({ message, senderName, status = "sent", error, onRetry, onDismiss, onMediaError, onReport, maskedNote }) {
  const reportable = Boolean(onReport) && !message.mine && status === "sent"
  return (
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
      {status === "failed" ? (
        <div className="bubble__actions2">
          <button type="button" className="link2" onClick={onRetry}>
            <Icon name="i-refresh" />
            Réessayer
          </button>
          <button type="button" className="link2 link2--muted" onClick={onDismiss}>
            Supprimer
          </button>
        </div>
      ) : null}
      {maskedNote && message.mine ? (
        <p className="bubble__note2" role="status">
          {maskedNote}
        </p>
      ) : null}
      {reportable ? (
        <div className="bubble__actions2">
          <button type="button" className="link2 link2--muted" aria-label={`Signaler ce message de ${senderName}`} onClick={() => onReport(message)}>
            <Icon name="i-flag" />
            Signaler
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default Bubble
