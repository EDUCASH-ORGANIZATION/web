// Logique pure du composant Select (motif APG "select-only combobox").
// Une option : { value, label, disabled? }. Les index portent sur le tableau d'options.

export const TYPEAHEAD_RESET_MS = 500
export const MENU_ITEM_HEIGHT = 42
export const MENU_PADDING = 14
export const MENU_MAX_HEIGHT = 280
export const MENU_MIN_WIDTH = 220
export const VIEWPORT_MARGIN = 8
export const MENU_GAP = 6
export const MENU_MIN_HEIGHT = 168

const isEnabled = (options, i) => i >= 0 && i < options.length && !options[i].disabled

export function firstEnabled(options) {
  return options.findIndex((o) => !o.disabled)
}

export function lastEnabled(options) {
  for (let i = options.length - 1; i >= 0; i--) if (!options[i].disabled) return i
  return -1
}

export function indexOfValue(options, value) {
  return options.findIndex((o) => o.value === value)
}

// Option active à l'ouverture : la valeur choisie, sinon la première option activable.
export function initialActive(options, value) {
  const i = indexOfValue(options, value)
  return isEnabled(options, i) ? i : firstEnabled(options)
}

// Déplace l'option active de `delta` (+1 / -1) en sautant les options désactivées, sans boucler.
export function moveActive(options, from, delta) {
  if (from < 0) return delta > 0 ? firstEnabled(options) : lastEnabled(options)
  let i = from + delta
  while (i >= 0 && i < options.length) {
    if (!options[i].disabled) return i
    i += delta
  }
  return from
}

export const isTypeChar = (key) => typeof key === "string" && key.length === 1 && key !== " "

// Recherche par première lettre. Une même lettre répétée fait défiler les options qui
// commencent par elle ; une saisie de plusieurs lettres cherche le préfixe complet.
export function typeaheadIndex(options, active, buffer) {
  if (!buffer) return active
  const text = buffer.toLocaleLowerCase("fr")
  const cycling = [...text].every((c) => c === text[0])
  const needle = cycling ? text[0] : text
  const start = cycling ? active + 1 : Math.max(active, 0)
  for (let step = 0; step < options.length; step++) {
    const i = (start + step) % options.length
    if (!options[i].disabled && options[i].label.toLocaleLowerCase("fr").startsWith(needle)) return i
  }
  return active
}

// Tampon de saisie : repart de zéro après TYPEAHEAD_RESET_MS sans frappe.
export function nextBuffer(prev, key, now) {
  const fresh = !prev || now - prev.at > TYPEAHEAD_RESET_MS
  return { text: (fresh ? "" : prev.text) + key, at: now }
}

// Traduit une touche en intention. `open` : la liste est ouverte. `typing` : une saisie est en cours.
export function keyIntent({ key, altKey = false, ctrlKey = false, metaKey = false, open, typing = false }) {
  if (ctrlKey || metaKey) return "none"
  if (!open) {
    if (key === "Enter" || key === " " || key === "ArrowDown" || key === "ArrowUp") {
      return key === " " && typing ? "type" : "open"
    }
    if (key === "Home") return "open-first"
    if (key === "End") return "open-last"
    return isTypeChar(key) ? "open-type" : "none"
  }
  switch (key) {
    case "ArrowDown": return altKey ? "none" : "next"
    case "ArrowUp": return altKey ? "select" : "prev"
    case "Home": return "first"
    case "End": return "last"
    case "Enter": return "select"
    case " ": return typing ? "type" : "select"
    case "Escape": return "close"
    case "Tab": return "tab"
    default: return isTypeChar(key) ? "type" : "none"
  }
}

// Place la liste sous le déclencheur ; la remonte au-dessus seulement si la place en bas est vraiment
// insuffisante (moins de MENU_MIN_HEIGHT) et que le haut en offre davantage. Quand la liste ne tient
// pas en entier mais que la place est suffisante, elle reste où elle est avec `maxHeight` (défilement).
// Aligne sur la fin si elle déborderait à droite. `rect` : getBoundingClientRect du déclencheur.
// `maxHeight` vaut null quand la liste tient avec sa hauteur naturelle.
export function choosePlacement({ rect, viewportWidth, viewportHeight, count, menuWidth = MENU_MIN_WIDTH }) {
  const needed = Math.min(MENU_MAX_HEIGHT, count * MENU_ITEM_HEIGHT + MENU_PADDING)
  const below = Math.max(0, viewportHeight - rect.bottom - VIEWPORT_MARGIN - MENU_GAP)
  const above = Math.max(0, rect.top - VIEWPORT_MARGIN - MENU_GAP)
  const needsRoom = below < needed
  const up = needsRoom && below < Math.min(needed, MENU_MIN_HEIGHT) && above > below
  const room = up ? above : below
  const maxHeight = needed > room ? Math.floor(room) : null
  const overflowsRight = rect.left + menuWidth > viewportWidth - VIEWPORT_MARGIN
  const fitsEnd = rect.right - menuWidth >= VIEWPORT_MARGIN
  return { vertical: up ? "top" : "bottom", horizontal: overflowsRight && fitsEnd ? "end" : "start", maxHeight }
}
