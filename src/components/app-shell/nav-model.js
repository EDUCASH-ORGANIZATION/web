// Logique pure de la navigation de la coquille connectée (client, puis étudiant et admin).
// Aucune dépendance : importable côté serveur, côté client et dans les tests.

export const COUNT_CAP = 99

/** Vrai si `pathname` est `base` ou un chemin enfant de `base` (jamais un simple préfixe de texte). */
function isWithin(pathname, base) {
  if (!pathname || !base) return false
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return path === base || path.startsWith(`${base}/`)
}

/**
 * Un élément est actif sur son chemin et ses enfants, sauf s'il est `exact` ou si le chemin tombe
 * dans une de ses exclusions (ex. « Mes missions » n'est pas actif sur /client/missions/new).
 * @param {string} pathname
 * @param {{ href: string, exact?: boolean, exclude?: string[] }} item
 */
export function isItemActive(pathname, item) {
  if (!item?.href) return false
  const path = pathname && pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  if (item.exact) return path === item.href
  if ((item.exclude ?? []).some((base) => isWithin(path, base))) return false
  return isWithin(path, item.href)
}

/**
 * Clé de l'unique élément actif d'une liste : si plusieurs correspondent, le chemin le plus
 * spécifique (le plus long) l'emporte. Renvoie null si aucun ne correspond.
 * @param {string} pathname
 * @param {Array<{ key: string, href: string, exact?: boolean, exclude?: string[] }>} items
 */
export function activeKey(pathname, items) {
  let best = null
  for (const item of items ?? []) {
    if (!isItemActive(pathname, item)) continue
    if (!best || item.href.length > best.href.length) best = item
  }
  return best ? best.key : null
}

/**
 * Compteur affichable : entier positif, « 99+ » au-delà de la borne, null si rien à montrer.
 * @param {unknown} value
 * @returns {string | null}
 */
export function formatCount(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return null
  const whole = Math.floor(n)
  return whole > COUNT_CAP ? `${COUNT_CAP}+` : String(whole)
}

/** Nom accessible d'un lien à compteur : « Messages, 3 non lus », « Messages, plus de 99 non lus ». */
export function countLabel(label, value, unit = "non lus") {
  const shown = formatCount(value)
  if (shown === null) return label
  return shown.endsWith("+") ? `${label}, plus de ${COUNT_CAP} ${unit}` : `${label}, ${shown} ${unit}`
}

/** Initiales d'un nom complet (deux lettres au plus), « ? » si le nom est vide. */
export function initialsOf(fullName) {
  const words = typeof fullName === "string" ? fullName.trim().split(/\s+/).filter(Boolean) : []
  if (words.length === 0) return "?"
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]]
  return letters.map((w) => w.charAt(0).toLocaleUpperCase("fr-FR")).join("")
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

/**
 * Le raccourci « / » met le focus sur la recherche, sauf pendant la saisie dans un champ,
 * avec un modificateur, ou quand l'événement est déjà traité.
 * @param {{ key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, defaultPrevented?: boolean,
 *   target?: { tagName?: string, isContentEditable?: boolean } | null }} event
 */
export function isSearchShortcut(event) {
  if (!event || event.key !== "/") return false
  if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return false
  const target = event.target
  if (target && (TYPING_TAGS.has(target.tagName) || target.isContentEditable)) return false
  return true
}
