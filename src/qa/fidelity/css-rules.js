// Extraction de règles CSS pour les tests statiques de fidélité aux maquettes.
// Analyseur volontairement minimal : blocs imbriqués (@media, @layer, @supports), listes de
// sélecteurs, déclarations. Pas de CSS imbriqué avec `&`.

const TRANSPARENT_AT_RULES = ["@media", "@layer", "@supports", "@container"]

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "")
}

function normalize(text) {
  return text.replace(/\s+/g, " ").trim()
}

function parseDeclarations(body) {
  const declarations = {}
  let depth = 0
  let current = ""
  const parts = []
  for (const ch of body) {
    if (ch === "(") depth += 1
    if (ch === ")") depth -= 1
    if (ch === ";" && depth === 0) {
      parts.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  parts.push(current)
  for (const part of parts) {
    const index = part.indexOf(":")
    if (index === -1) continue
    const prop = part.slice(0, index).trim().toLowerCase()
    const value = normalize(part.slice(index + 1))
    if (prop && value) declarations[prop] = value
  }
  return declarations
}

function splitSelectors(prelude) {
  const selectors = []
  let depth = 0
  let current = ""
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth += 1
    if (ch === ")" || ch === "]") depth -= 1
    if (ch === "," && depth === 0) {
      selectors.push(normalize(current))
      current = ""
    } else {
      current += ch
    }
  }
  selectors.push(normalize(current))
  return selectors.filter(Boolean)
}

// Parcourt `css` et appelle `visit(prelude, body, media)` pour chaque bloc de règle.
function walk(css, media, visit) {
  let index = 0
  while (index < css.length) {
    const open = css.indexOf("{", index)
    const semicolon = css.indexOf(";", index)
    if (open === -1) break
    if (semicolon !== -1 && semicolon < open) {
      index = semicolon + 1
      continue
    }
    let depth = 1
    let cursor = open + 1
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth += 1
      if (css[cursor] === "}") depth -= 1
      cursor += 1
    }
    const prelude = normalize(css.slice(index, open))
    const body = css.slice(open + 1, cursor - 1)
    index = cursor
    if (prelude.startsWith("@")) {
      const name = prelude.split(/[\s(]/)[0].toLowerCase()
      if (!TRANSPARENT_AT_RULES.includes(name)) continue
      const nextMedia = name === "@media" ? normalize(prelude.slice(name.length)) : media
      walk(body, nextMedia, visit)
    } else {
      visit(prelude, body, media)
    }
  }
}

/**
 * Règles dont la liste de sélecteurs contient exactement `selector`.
 * `media` : omis = règles hors @media ; chaîne = règles d'un @media dont la condition contient
 * cette chaîne (ex. "max-width: 1023px") ; "*" = toutes les règles, quel que soit le contexte.
 * Retourne [{ selector, selectors, declarations, media }] dans l'ordre du fichier.
 */
export function rulesOf(css, selector, { media } = {}) {
  const wanted = normalize(selector)
  const found = []
  walk(stripComments(css), null, (prelude, body, context) => {
    const selectors = splitSelectors(prelude)
    if (!selectors.includes(wanted)) return
    if (media === undefined && context !== null) return
    if (media !== undefined && media !== "*" && !(context ?? "").includes(media)) return
    found.push({ selector: wanted, selectors, declarations: parseDeclarations(body), media: context })
  })
  return found
}

/** Déclarations fusionnées (la dernière valeur l'emporte) de toutes les règles de `rulesOf`. */
export function declarationsOf(css, selector, options) {
  return Object.assign({}, ...rulesOf(css, selector, options).map((rule) => rule.declarations))
}
