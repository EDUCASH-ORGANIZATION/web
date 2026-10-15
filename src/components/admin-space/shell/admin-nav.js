// @ds-screen RD-ADMIN-01
// Configuration de la coquille de l'espace admin. Chaque lien vise une route existante. Aucun abonnement aux messages (`realtime: false`).
// Le compteur « verifications » est celui des dossiers « À examiner » (passé par `counts`).

export const ADMIN_NAV = {
  space: "Administration",
  identityLabel: "Admin",
  homeHref: "/admin/dashboard",
  profileHref: "/admin/dashboard",
  realtime: false,
  search: {
    action: "/admin/users",
    param: "q",
    label: "Rechercher un utilisateur",
    placeholder: "Rechercher un utilisateur",
  },
  groups: [
    {
      title: "Général",
      items: [
        { key: "accueil", label: "Tableau de bord", href: "/admin/dashboard", icon: "i-home" },
        {
          key: "verifications",
          label: "Vérifications",
          href: "/admin/verifications",
          icon: "i-user-check",
          badge: "verifications",
          badgeUnit: "à examiner",
        },
        { key: "utilisateurs", label: "Utilisateurs", href: "/admin/users", icon: "i-users" },
        { key: "missions", label: "Missions", href: "/admin/missions", icon: "i-briefcase" },
      ],
    },
    {
      title: "Finances",
      items: [
        { key: "transactions", label: "Transactions", href: "/admin/transactions", icon: "i-receipt" },
        { key: "portefeuilles", label: "Portefeuilles", href: "/admin/wallets", icon: "i-wallet" },
        { key: "retraits", label: "Retraits", href: "/admin/withdrawals", icon: "i-banknote" },
      ],
    },
  ],
  mobile: [
    { key: "accueil", label: "Accueil", href: "/admin/dashboard", icon: "i-home" },
    {
      key: "verifications",
      label: "Vérifs",
      href: "/admin/verifications",
      icon: "i-user-check",
      badge: "verifications",
      badgeUnit: "à examiner",
    },
    { key: "missions", label: "Missions", href: "/admin/missions", icon: "i-briefcase" },
    { key: "utilisateurs", label: "Utilisateurs", href: "/admin/users", icon: "i-users" },
  ],
  mobileMore: {
    key: "plus",
    label: "Plus",
    icon: "i-more-h",
    items: [
      { key: "transactions", label: "Transactions", href: "/admin/transactions", icon: "i-receipt" },
      { key: "portefeuilles", label: "Portefeuilles", href: "/admin/wallets", icon: "i-wallet" },
      { key: "retraits", label: "Retraits", href: "/admin/withdrawals", icon: "i-banknote" },
    ],
  },
}
