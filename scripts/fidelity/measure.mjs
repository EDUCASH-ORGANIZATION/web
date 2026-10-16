// Mesure d'une liste de sélecteurs dans une page Playwright. Les coordonnées sont relatives à la racine
// (cadre de la planche ou body du rendu du code). Une mesure vaut null si le sélecteur ne trouve rien.
// `clippedBy` : description (balise.classes) du premier ancêtre `overflow: hidden|clip` (ou `contain: paint`)
// qui coupe la boîte de plus de 1 px, sinon null. Un ancêtre défilant (auto, scroll) ne rogne pas : le contenu
// reste atteignable, et c'est alors sa propre boîte qui est confrontée aux ancêtres suivants. La remontée suit
// les blocs conteneurs (absolute, fixed, transform).

/**
 * @param page Page Playwright
 * @param rootSelector Racine des coordonnées
 * @param selectors { [clé]: sélecteur CSS }
 * @param dy Décalage vertical ajouté aux y (barre d'état du cadre mobile : -36)
 */
export async function measureSelectors(page, rootSelector, selectors, dy = 0) {
  return page.evaluate(
    ({ rootSelector, selectors, dy }) => {
      const root = document.querySelector(rootSelector) || document.body
      const rootBox = root.getBoundingClientRect()
      const describe = (node) => {
        const classes = [...node.classList].slice(0, 2).map((name) => `.${name}`).join("")
        return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${classes}`
      }
      // Nœud qui devient le bloc conteneur des descendants fixed (transform, filter, perspective, will-change, contain).
      const makesContainer = (style) =>
        style.transform !== "none" ||
        style.filter !== "none" ||
        style.perspective !== "none" ||
        /transform|perspective|filter/.test(style.willChange) ||
        /layout|paint|strict|content/.test(style.contain)
      // Les nœuds sans boîte propre n'appliquent pas `overflow` (clientWidth vaut 0).
      const NO_BOX = new Set(["inline", "contents", "table-row", "table-row-group", "table-header-group", "table-footer-group", "table-column", "table-column-group"])
      const clipMargin = (style) => {
        const match = /(-?\d+(?:\.\d+)?)px/.exec(style.overflowClipMargin || "")
        return match ? Number(match[1]) : 0
      }
      const findClipper = (element) => {
        const own = element.getBoundingClientRect()
        if (!own.width || !own.height) return null
        let box = { left: own.left, top: own.top, right: own.right, bottom: own.bottom }
        // Mode de la chaîne des blocs conteneurs : "normal", "absolute" (saute les statiques jusqu'au premier
        // positionné ou transformé), "fixed" (saute tout jusqu'au premier nœud transformé, filtré ou contenu).
        let mode = getComputedStyle(element).position
        for (let node = element.parentElement; node && node !== document.documentElement; node = node.parentElement) {
          const style = getComputedStyle(node)
          const container = makesContainer(style)
          if (mode === "fixed" && !container) continue
          if (mode === "absolute" && style.position === "static" && !container) continue
          if (!NO_BOX.has(style.display)) {
            const area = node.getBoundingClientRect()
            const inner = {
              left: area.left + node.clientLeft,
              top: area.top + node.clientTop,
              right: area.left + node.clientLeft + node.clientWidth,
              bottom: area.top + node.clientTop + node.clientHeight,
            }
            const paints = /paint|strict|content/.test(style.contain)
            const axes = [
              [style.overflowX, "left", "right"],
              [style.overflowY, "top", "bottom"],
            ]
            for (const [overflow, start, end] of axes) {
              if (overflow === "hidden" || overflow === "clip" || paints) {
                const margin = overflow === "clip" ? clipMargin(style) : 0
                if (box[start] < inner[start] - margin - 1 || box[end] > inner[end] + margin + 1) return describe(node)
              } else if (overflow === "auto" || overflow === "scroll") {
                box = { ...box, [start]: inner[start], [end]: inner[end] }
              }
            }
          }
          // Un élément du calque supérieur (dialogue modal, popover) n'est rogné par aucun ancêtre.
          if (node.matches(":modal, :popover-open")) return null
          mode = style.position === "fixed" || style.position === "absolute" ? style.position : "normal"
        }
        return null
      }
      const result = {}
      for (const [key, selector] of Object.entries(selectors)) {
        const element = root.querySelector(selector)
        if (!element) {
          result[key] = null
          continue
        }
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        // Largeur du texte lui-même (indépendante de la boîte, qui peut épouser un frère plus large).
        const range = document.createRange()
        range.selectNodeContents(element)
        const textBox = range.getBoundingClientRect()
        result[key] = {
          clippedBy: findClipper(element),
          x: Math.round(box.left - rootBox.left),
          y: Math.round(box.top - rootBox.top) + dy,
          w: Math.round(box.width),
          h: Math.round(box.height),
          tw: Math.round(textBox.width),
          fontFamily: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          color: style.color,
          bg: style.backgroundColor,
          radius: style.borderRadius,
          pad: style.padding,
          margin: style.margin,
          gap: style.gap,
          border: `${style.borderTopWidth} ${style.borderTopColor}`,
          shadow: style.boxShadow === "none" ? "none" : style.boxShadow,
          cols: style.gridTemplateColumns === "none" ? "" : style.gridTemplateColumns,
          text: (element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
        }
      }
      return result
    },
    { rootSelector, selectors, dy },
  )
}
