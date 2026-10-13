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
  return activeItem(pathname, items)?.key ?? null
}

/** Élément actif lui-même (même règle que `activeKey`), pour comparer par référence plutôt que par clé. */
function activeItem(pathname, items) {
  let best = null
  for (const item of items ?? []) {
    if (!isItemActive(pathname, item)) continue
    if (!best || item.href.length > best.href.length) best = item
  }
  return best
}

/**
 * Vrai seulement pour un enfant STRICT d'une des bases : la base elle-même et un simple préfixe de texte
 * (« /messagesx ») ne comptent pas. Sert à masquer la barre mobile sur les écrans de détail.
 * @param {string} pathname
 * @param {string[]} [bases]
 */
export function isHiddenBelow(pathname, bases) {
  if (!pathname) return false
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return (bases ?? []).some((base) => base && path.startsWith(`${base}/`))
}

/**
 * Élément actif de la barre mobile, entre les entrées visibles et les liens du panneau « Plus » :
 * le chemin le plus spécifique l'emporte. Le bouton central (`cta`) n'entre jamais dans ce calcul : il n'a pas de pastille.
 * Renvoie la clé active, si « Plus » est actif et la clé du lien concerné.
 * @param {string} pathname
 * @param {Array<{ key: string, href: string, exact?: boolean, exclude?: string[] }>} items
 * @param {{ items?: Array<{ key: string, href: string, exact?: boolean, exclude?: string[] }> } | undefined} more
 * @returns {{ activeKey: string | null, moreActive: boolean, moreActiveKey: string | null }}
 */
export function resolveMobileActive(pathname, items, more) {
  const moreItems = more?.items ?? []
  const all = [
    ...(items ?? []).filter((item) => !item.cta).map((item) => ({ ...item, inMore: false })),
    ...moreItems.map((item) => ({ ...item, inMore: true })),
  ]
  const hit = activeItem(pathname, all)
  const moreActive = Boolean(hit?.inMore)
  return {
    activeKey: hit && !hit.inMore ? hit.key : null,
    moreActive,
    moreActiveKey: moreActive ? hit.key : null,
  }
}

/**
 * Nom accessible du bouton « Plus » : « Plus » seul, ou « Plus, Portefeuilles » quand un lien du panneau est la page courante.
 * @param {{ label: string, items?: Array<{ key: string, label: string }> }} more
 * @param {string | null} [currentKey]
 */
export function moreAccessibleName(more, currentKey) {
  const current = currentKey ? (more.items ?? []).find((item) => item.key === currentKey) : null
  return current ? `${more.label}, ${current.label}` : more.label
}

// État du panneau « Plus » : ouvert ou non, et chemin sur lequel il a été ouvert. Un changement de chemin le referme,
// y compris au retour sur le chemin d'origine (pas d'effet de synchronisation : l'état est recalé pendant le rendu).

/** @returns {{ open: boolean, path: string | null }} */
export function initialMoreState(pathname) {
  return { open: false, path: pathname ?? null }
}

/** Recale l'état sur le chemin courant : fermé dès que le chemin a changé. Renvoie le même objet si rien ne change. */
export function syncMoreState(state, pathname) {
  const path = pathname ?? null
  return state.path === path ? state : { open: false, path }
}

/** Bascule ouvert/fermé du bouton « Plus » (état supposé déjà recalé sur le chemin courant). */
export function toggleMoreState(state) {
  return { ...state, open: !state.open }
}

/** Ferme le panneau (clic sur un lien, Échap, clic extérieur). */
export function closeMoreState(state) {
  return state.open ? { ...state, open: false } : state
}

/** Échap ferme le panneau « Plus ». */
export function isCloseKey(key) {
  return key === "Escape" || key === "Esc"
}

/** Vrai si la cible d'un clic est hors du conteneur (ou si le conteneur est absent). */
export function isOutside(container, target) {
  if (!container || !target) return true
  return !container.contains(target)
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
