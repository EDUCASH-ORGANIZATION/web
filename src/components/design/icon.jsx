// EduCash - icône SVG inline, référence un <symbol> du sprite externe
// servi par /sprite.svg (cache long, cache-busting via ?v=).
// Usage : <Icon name="i-search" /> → <svg class="ic"><use href="/sprite.svg?v=...#i-search"/></svg>

import { SPRITE_VERSION } from "./sprite"

export function Icon({ name, className = "ic" }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`/sprite.svg?v=${SPRITE_VERSION}#${name}`} />
    </svg>
  )
}

export default Icon
