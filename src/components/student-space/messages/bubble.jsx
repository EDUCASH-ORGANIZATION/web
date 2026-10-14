// @ds-screen RD-STUDENT-01
import { Icon } from "@/components/design/icon"
import { coordsValid, formatClock } from "@/lib/client-space/conversations"

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Lien vers une carte : construit à partir de nombres validés, jamais d'un texte reçu.
function placeHref(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
}

function Body({ message, onMediaError }) {
  if (message.type === "image") {
    // Pas de lien vers l'objet brut : il servirait un fichier HTML déguisé sur l'origine du stockage. L'adresse
    // affichée est toujours une adresse signée ; sur erreur de chargement la vue la renouvelle une fois.
    return message.mediaUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="e2-07-photo" src={message.mediaUrl} alt="Image envoyée" loading="lazy" onError={() => onMediaError?.(message.id)} />
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
    return coordsValid(message.lat, message.lng) ? (
      <a className="e2-07-place" href={placeHref(message.lat, message.lng)} target="_blank" rel="noopener noreferrer">
        <Icon name="i-map-pin" />
        Position partagée, ouvrir la carte
      </a>
    ) : (
      <span className="e2-07-text">Position indisponible</span>
    )
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

/**
 * Bulle de message. `status` : "sent" (défaut), "sending" ou "failed" (message de l'étudiant pas encore
 * livré : `error` en méta, « Réessayer » et « Supprimer » sous la bulle).
 */
export function Bubble({ message, senderName, status = "sent", error, onRetry, onDismiss, onMediaError }) {
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
