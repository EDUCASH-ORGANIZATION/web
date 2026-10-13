import Image from "next/image"
import { Icon } from "@/components/design/icon"

/**
 * Initiales d'un nom : deux lettres au plus, "?" si le nom est vide.
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function initialsOf(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[words.length - 1]][0]]
  return letters.join("").toLocaleUpperCase("fr-FR")
}

// Avatar neutre : photo (`src`) ou initiales. `verified` ajoute le sceau vérifié (symbole `seal` du sprite).
export function Avatar({ name, src, size = "md", verified = false }) {
  const label = verified ? `${name}, profil vérifié` : name
  const className = size === "sm" ? "av2 av2--sm" : "av2"
  const px = size === "sm" ? 32 : 36
  return (
    <>
      {src ? (
        <span className={className}>
          <Image src={src} alt={label} width={px} height={px} className="h-full w-full rounded-full object-cover" />
        </span>
      ) : (
        <span className={className} role="img" aria-label={label}>
          {initialsOf(name)}
        </span>
      )}
      {verified ? <Icon name="seal" className="seal" /> : null}
    </>
  )
}

export default Avatar
