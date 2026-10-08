import { SPRITE_VERSION } from "@/components/design/sprite"

// Gribouillis décoratif du système (sprite externe). `viewBox` facultatif.
export function Scribble({ name, className = "", viewBox }) {
  return (
    <svg className={`scribble ${className}`.trim()} viewBox={viewBox} preserveAspectRatio={viewBox ? "none" : undefined} aria-hidden="true" focusable="false">
      <use href={`/sprite.svg?v=${SPRITE_VERSION}#${name}`} />
    </svg>
  )
}

// Forme décorative (sprite externe), hors classe .scribble.
export function Shape({ name, className }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`/sprite.svg?v=${SPRITE_VERSION}#${name}`} />
    </svg>
  )
}
