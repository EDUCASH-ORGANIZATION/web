// @ds-screen RD-ADMIN-01
// Raccourcis clavier de la file de vérification (AD02). Pur : décide quelle action correspond à une touche, ne
// fait rien lui-même. Une décision (V, R) n'ouvre jamais qu'une confirmation, jamais d'écriture directe.

const TYPING_TAGS = ["INPUT", "TEXTAREA", "SELECT"]
// Éléments qui gèrent eux-mêmes les flèches ou le texte : listes déroulantes, boutons radio, menus, dialogues.
const OWN_KEYS = '[aria-haspopup],[role="combobox"],[role="listbox"],[role="radio"],[role="menu"],[role="dialog"]'
const QUEUE_SCOPE = "[data-queue-scope]"

/** Vrai si la touche appartient à l'élément ciblé (saisie de texte, liste déroulante, radio, dialogue). */
export function isOwnKeyTarget(target) {
  if (!target) return false
  if (TYPING_TAGS.includes(target.tagName)) return true
  if (target.isContentEditable === true) return true
  return typeof target.closest === "function" && target.closest(OWN_KEYS) !== null
}

/** Les flèches ne changent de dossier que depuis la page nue ou la liste : ailleurs elles font défiler. */
export function isQueueScope(target, body) {
  if (!target || target === body) return true
  return typeof target.closest === "function" && target.closest(QUEUE_SCOPE) !== null
}

/**
 * Action d'une touche pressée.
 * @param {{
 *   key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean,
 *   target?: object | null, body?: object | null, dialogOpen?: boolean, allowed?: string[],
 * }} event
 * @returns {"prev" | "next" | "approve" | "reject" | null}
 */
export function shortcutAction({ key, ctrlKey = false, metaKey = false, altKey = false, target = null, body = null, dialogOpen = false, allowed = [] }) {
  if (dialogOpen || ctrlKey || metaKey || altKey) return null
  if (isOwnKeyTarget(target)) return null
  if (key === "ArrowUp") return isQueueScope(target, body) ? "prev" : null
  if (key === "ArrowDown") return isQueueScope(target, body) ? "next" : null
  const letter = typeof key === "string" ? key.toLowerCase() : ""
  if (letter === "v") return allowed.includes("approve") ? "approve" : null
  if (letter === "r") return allowed.includes("reject") ? "reject" : null
  return null
}
