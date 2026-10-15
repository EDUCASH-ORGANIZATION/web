// Modèle de la barre mobile de l'espace admin : réexporte la partie mobile de la configuration de la coquille
// (`ADMIN_NAV`), pour garder une seule source de vérité.
import { ADMIN_NAV } from "@/components/admin-space/shell/admin-nav"

export const ADMIN_MOBILE_NAV = Object.freeze({
  mobile: Object.freeze(ADMIN_NAV.mobile.map((item) => Object.freeze({ ...item }))),
  mobileMore: Object.freeze({
    ...ADMIN_NAV.mobileMore,
    items: Object.freeze(ADMIN_NAV.mobileMore.items.map((item) => Object.freeze({ ...item }))),
  }),
})
