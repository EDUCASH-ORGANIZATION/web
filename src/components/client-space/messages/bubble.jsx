import { Icon } from "@/components/design/icon"
import { coordsValid, formatClock } from "@/lib/client-space/conversations"

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Lien vers une carte : construit à partir de nombres validés, jamais d'un texte reçu.
function placeHref(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
}

function Body({ message }) {
  if (message.type === "image") {
    // Pas de lien vers l'objet brut : le compartiment public servirait un fichier HTML déguisé sur l'origine du stockage.
    return message.mediaUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="bubble__photo2" src={message.mediaUrl} alt="Image envoyée" loading="lazy" />
    ) : (
      <span className="bubble__text2">Image indisponible</span>
    )
  }
  if (message.type === "voice") {
    return message.mediaUrl ? (
      <audio className="bubble__audio2" src={message.mediaUrl} controls preload="metadata" aria-label="Message vocal" />
    ) : (
      <span className="bubble__text2">Message vocal indisponible</span>
    )
  }
  if (message.type === "location") {
    return coordsValid(message.lat, message.lng) ? (
      <a className="bubble__place2" href={placeHref(message.lat, message.lng)} target="_blank" rel="noopener noreferrer">
        <Icon name="i-map-pin" />
        Position partagée, ouvrir la carte
      </a>
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
 * livré : `error` en méta, « Réessayer » et « Supprimer » sous la bulle).
 */
export function Bubble({ message, senderName, status = "sent", error, onRetry, onDismiss }) {
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
      <Body message={message} />
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
    </div>
  )
}

export default Bubble
