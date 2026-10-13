import Image from "next/image"
import { Icon } from "@/components/design/icon"
import { initialsOf } from "@/lib/app/format"

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
