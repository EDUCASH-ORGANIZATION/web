import { coordsValid } from "@/lib/client-space/conversations"

// Liens de carte et recherche de lieu, logique pure partagée par les espaces client et étudiant.
// Les liens Google Maps ne sont construits qu'à partir de coordonnées numériques valides, jamais
// d'un texte reçu, et n'utilisent aucune clé.

export const NOMINATIM_MIN_QUERY = 3
export const NOMINATIM_MAX_QUERY = 120
// Politique d'usage de Nominatim : une requête par seconde au plus.
export const NOMINATIM_MIN_INTERVAL_MS = 1000
export const OSM_COPYRIGHT_HREF = "https://www.openstreetmap.org/copyright"

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
const NOMINATIM_PARAMS = "format=json&limit=5&accept-language=fr&countrycodes=bj"

// Six décimales (environ 10 cm) et jamais de notation scientifique dans l'URL.
function coordText(value) {
  return String(Number(value.toFixed(6)))
}

function coordPair(lat, lng) {
  return coordsValid(lat, lng) ? `${coordText(lat)},${coordText(lng)}` : null
}

// « Ouvrir dans Google Maps » : null si les coordonnées sont invalides.
export function googleMapsPlaceHref(lat, lng) {
  const pair = coordPair(lat, lng)
  return pair ? `https://www.google.com/maps/search/?api=1&query=${pair}` : null
}

// « Itinéraire » : null si les coordonnées sont invalides.
export function googleMapsDirectionsHref(lat, lng) {
  const pair = coordPair(lat, lng)
  return pair ? `https://www.google.com/maps/dir/?api=1&destination=${pair}` : null
}

// Texte de recherche normalisé, ou null s'il est trop court ou trop long.
export function normalizeQuery(q) {
  if (typeof q !== "string") return null
  const text = q.trim()
  if (text.length < NOMINATIM_MIN_QUERY || text.length > NOMINATIM_MAX_QUERY) return null
  return text
}

// URL de recherche Nominatim limitée au Bénin, ou null si la requête est inutilisable.
export function nominatimSearchUrl(q) {
  const text = normalizeQuery(q)
  return text ? `${NOMINATIM_SEARCH}?q=${encodeURIComponent(text)}&${NOMINATIM_PARAMS}` : null
}

// Délai à attendre avant la prochaine requête pour respecter l'intervalle minimal.
export function nominatimWaitMs(lastRequestAt, now) {
  if (typeof lastRequestAt !== "number" || typeof now !== "number") return 0
  return Math.max(0, lastRequestAt + NOMINATIM_MIN_INTERVAL_MS - now)
}

// Résultat de recherche de lieu réduit à un libellé et des coordonnées valides.
export function toPlace(raw) {
  const lat = Number.parseFloat(raw?.lat)
  const lng = Number.parseFloat(raw?.lon)
  if (!coordsValid(lat, lng) || typeof raw?.display_name !== "string") return null
  return { label: raw.display_name, lat, lng }
}
