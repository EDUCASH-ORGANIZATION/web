// Mesure d'une liste de sélecteurs dans une page Playwright. Les coordonnées sont relatives à la racine
// (cadre de la planche ou body du rendu du code). Une mesure vaut null si le sélecteur ne trouve rien.

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
      const result = {}
      for (const [key, selector] of Object.entries(selectors)) {
        const element = root.querySelector(selector)
        if (!element) {
          result[key] = null
          continue
        }
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        result[key] = {
          x: Math.round(box.left - rootBox.left),
          y: Math.round(box.top - rootBox.top) + dy,
          w: Math.round(box.width),
          h: Math.round(box.height),
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
