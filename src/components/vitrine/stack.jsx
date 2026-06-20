"use client"

import MuiStack from "@mui/material/Stack"

/**
 * Wrapper autour de MUI `Stack`.
 *
 * MUI v9 `Stack` ne consomme que `direction`, `spacing`, `divider` et `useFlexGap`.
 * Les props flexbox/typo (`alignItems`, `justifyContent`, `textAlign`) seraient
 * sinon transférées à l'élément DOM → warning React
 * ("React does not recognize the `alignItems` prop on a DOM element").
 *
 * Ce wrapper les redirige automatiquement vers `sx`, ce qui permet de garder
 * la syntaxe pratique `<Stack alignItems="center" justifyContent="center">`.
 */
export function Stack({ alignItems, justifyContent, textAlign, sx, ...props }) {
  const overrides = {}
  if (alignItems !== undefined) overrides.alignItems = alignItems
  if (justifyContent !== undefined) overrides.justifyContent = justifyContent
  if (textAlign !== undefined) overrides.textAlign = textAlign

  const mergedSx = Array.isArray(sx) ? [overrides, ...sx] : [overrides, sx]

  return <MuiStack {...props} sx={mergedSx} />
}
