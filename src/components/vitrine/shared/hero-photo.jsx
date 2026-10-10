import { preload } from "react-dom"

// Photos des heros, détourées en local puis exportées en WebP (déjà optimisées : pas de passage par
// l'optimiseur de next/image). Elles se posent sur l'aplat citron `photo-ph`, centrées et calées en bas.
// - client : Daniel Sunga, Pexels (licence Pexels, attribution non requise), 562 x 920.
// - student : Abraham Ocholi, Pexels (licence Pexels, attribution non requise), 644 x 1100.
export const HERO_PHOTOS = {
  client: { src: "/images/clients/portrait-client.webp", width: 562, height: 920 },
  student: { src: "/images/hero/portrait-hero.webp", width: 644, height: 1100 },
}

// Le visuel est masqué sous 1024 px : un <picture> dont la seule source est réservée aux écrans larges
// ne demande jamais l'image en mobile (le repli est un pixel transparent en data URI), alors que
// next/image avec priority la préchargerait même masquée. Le préchargement est limité par `media`.
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
const HERO_PHOTO_MEDIA = "(min-width: 1024px)"

// Aplat citron + photo d'un hero. `priority` demande un préchargement et un chargement prioritaires.
export function HeroPhoto({ photo, priority = false }) {
  preload(photo.src, {
    as: "image",
    media: HERO_PHOTO_MEDIA,
    ...(priority ? { fetchPriority: "high" } : {}),
  })
  return (
    <div className="photo-ph">
      <picture className="v-hero__picture">
        <source media={HERO_PHOTO_MEDIA} srcSet={photo.src} />
        <img
          className="v-hero__photo"
          src={PIXEL}
          width={photo.width}
          height={photo.height}
          {...(priority ? { fetchPriority: "high" } : {})}
          alt=""
        />
      </picture>
    </div>
  )
}
