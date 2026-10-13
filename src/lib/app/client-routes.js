// Fabriques d'URL de l'espace client. Pur : paramètres vides omis.
import { publishHref } from "../utils/publish-prefill.js"

function withQuery(path, entries) {
  const query = new URLSearchParams()
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === false || value === "") continue
    query.set(key, value === true ? "1" : String(value))
  }
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

// Montant numérique strictement positif, sinon undefined (paramètre omis).
function positiveAmount(montant) {
  if (montant === undefined || montant === null || montant === "" || typeof montant === "boolean") return undefined
  const n = Number(montant)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** @param {{ onglet?: string, q?: string }} [params] */
export function clientMissionsHref({ onglet, q } = {}) {
  return withQuery("/client/missions", [["onglet", onglet], ["q", q]])
}

/** @param {string} id @param {{ candidat?: string, confirmer?: boolean, publiee?: boolean }} [params] */
export function clientMissionHref(id, { candidat, confirmer, publiee } = {}) {
  if (id === undefined || id === null || id === "") return "/client/missions"
  return withQuery(`/client/missions/${encodeURIComponent(id)}`, [
    ["candidat", candidat],
    ["confirmer", confirmer],
    ["publiee", publiee],
  ])
}

/** `studentId` est le paramètre lu par la page de conversation existante. */
export function clientConversationHref(missionId, studentId) {
  if (missionId === undefined || missionId === null || missionId === "") return "/client/messages"
  return withQuery(`/client/messages/${encodeURIComponent(missionId)}`, [["studentId", studentId]])
}

/** @param {{ recharger?: boolean, montant?: number|string, filtre?: string }} [params] */
export function clientWalletHref({ recharger, montant, filtre } = {}) {
  return withQuery("/client/wallet", [
    ["recharger", recharger],
    ["montant", positiveAmount(montant)],
    ["filtre", filtre && filtre !== "tout" ? filtre : undefined],
  ])
}

/** @param {{ duplicate?: string, besoin?: string, ville?: string, type?: string }} [params] */
export function clientPublishHref({ duplicate, ...prefill } = {}) {
  const base = publishHref(prefill)
  if (!duplicate) return base
  const joiner = base.includes("?") ? "&" : "?"
  return `${base}${joiner}${new URLSearchParams({ duplicate }).toString()}`
}

/** Écran « Noter l'étudiant » (C10) d'une mission terminée. */
export function clientReviewHref(missionId) {
  if (missionId === undefined || missionId === null || missionId === "") return "/client/missions"
  return `/client/review/${encodeURIComponent(missionId)}`
}
