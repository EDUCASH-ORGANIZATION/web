// Pré-remplissage de la publication de mission depuis la vitrine.
// JS pur : importable par les composants serveur et client.
import { CITIES, MISSION_TYPES } from "../supabase/database.constants.js"

/** Page de publication d'une mission (espace client). */
export const PUBLISH_PATH = "/client/missions/new"

const TITLE_MAX_LENGTH = 80

function firstValue(value) {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === "string" ? v : ""
}

function clean(value) {
  return firstValue(value).replace(/[\u0000-\u001f\u007f]/g, "").trim()
}

/**
 * Lit les paramètres de pré-remplissage (`besoin`, `ville`, `type`).
 * Toute valeur invalide donne une chaîne vide.
 * @param {Record<string, string|string[]|undefined>|null|undefined} searchParams
 * @returns {{ title: string, city: string, type: string }}
 */
export function parsePublishPrefill(searchParams) {
  const params = searchParams ?? {}
  const city = clean(params.ville)
  const type = clean(params.type)
  return {
    title: clean(params.besoin).slice(0, TITLE_MAX_LENGTH).trim(),
    city: CITIES.includes(city) ? city : "",
    type: MISSION_TYPES.includes(type) ? type : "",
  }
}

/**
 * Lien relatif vers la publication, paramètres vides omis.
 * @param {{ besoin?: string, ville?: string, type?: string }} [prefill]
 * @returns {string}
 */
export function publishHref({ besoin, ville, type } = {}) {
  const query = new URLSearchParams()
  if (besoin) query.set("besoin", besoin)
  if (ville) query.set("ville", ville)
  if (type) query.set("type", type)
  const qs = query.toString()
  return qs ? `${PUBLISH_PATH}?${qs}` : PUBLISH_PATH
}
