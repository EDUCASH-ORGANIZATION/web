// Liens de carte d'une position partagée : « Ouvrir dans Google Maps » et « Itinéraire ».
// Les URL viennent uniquement des fabriques de map-links.js, à partir de coordonnées numériques valides,
// jamais d'un texte reçu. Vue pure.

import { Icon } from "@/components/design/icon"
import { googleMapsDirectionsHref, googleMapsPlaceHref } from "@/lib/messaging/map-links"

export const PLACE_UNAVAILABLE_COPY = "Position indisponible"

export function PlaceLinks({ lat, lng, linkClassName = "link" }) {
  const placeHref = googleMapsPlaceHref(lat, lng)
  const directionsHref = googleMapsDirectionsHref(lat, lng)
  if (!placeHref || !directionsHref) return <span className="caption">{PLACE_UNAVAILABLE_COPY}</span>
  return (
    <span className="row">
      <a href={placeHref} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        <Icon name="i-map-pin" />
        Ouvrir dans Google Maps
      </a>
      <a href={directionsHref} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        <Icon name="i-navigation" />
        Itinéraire
      </a>
    </span>
  )
}

export default PlaceLinks
