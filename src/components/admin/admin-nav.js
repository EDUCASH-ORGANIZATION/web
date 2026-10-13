// Modèle de la barre mobile de l'espace admin (objet pur et sérialisable, passé du layout serveur
// à BottomNav). Quatre entrées visibles : les deux dernières destinations de la barre latérale
// passent par « Plus », ce qui garde les cinq destinations joignables sous 1024 px.

export const ADMIN_MOBILE_NAV = Object.freeze({
  mobile: Object.freeze([
    Object.freeze({ key: "accueil", label: "Accueil", href: "/admin/dashboard", icon: "i-home" }),
    Object.freeze({
      key: "verifications",
      label: "Vérifications",
      href: "/admin/verifications",
      icon: "i-user-check",
      badge: "verifications",
      badgeUnit: "en attente",
    }),
    Object.freeze({ key: "utilisateurs", label: "Utilisateurs", href: "/admin/users", icon: "i-users" }),
  ]),
  mobileMore: Object.freeze({
    key: "plus",
    label: "Plus",
    icon: "i-more-h",
    items: Object.freeze([
      Object.freeze({ key: "missions", label: "Missions", href: "/admin/missions", icon: "i-briefcase" }),
      Object.freeze({ key: "portefeuilles", label: "Portefeuilles", href: "/admin/wallets", icon: "i-wallet" }),
    ]),
  }),
})
