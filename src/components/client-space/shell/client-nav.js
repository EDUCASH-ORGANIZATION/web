// @ds-screen RD-CLIENT-01
// Configuration de la coquille de l'espace client. Agenda et Paramètres restent masqués (pas de page).
// La cloche pointe vers la page des notifications (`notifications`). Chaque lien vise une route existante.
import { PUBLISH_PATH } from "../../../lib/utils/publish-prefill.js"
import { clientNotificationsHref } from "../../../lib/app/client-routes.js"

export const CLIENT_NAV = {
  space: "Espace client",
  identityLabel: "Client",
  homeHref: "/client/dashboard",
  profileHref: "/client/profile",
  notifications: { space: "client", href: clientNotificationsHref() },
  cta: { label: "Publier une mission", href: PUBLISH_PATH, icon: "i-plus" },
  search: {
    action: "/client/missions",
    param: "q",
    label: "Rechercher une mission",
    placeholder: "Rechercher une mission",
  },
  groups: [
    {
      title: null,
      items: [
        { key: "accueil", label: "Accueil", href: "/client/dashboard", icon: "i-home" },
        { key: "missions", label: "Mes missions", href: "/client/missions", icon: "i-briefcase", exclude: [PUBLISH_PATH] },
        { key: "messages", label: "Messages", href: "/client/messages", icon: "i-message", badge: "messages" },
        { key: "portefeuille", label: "Portefeuille", href: "/client/wallet", icon: "i-wallet" },
      ],
    },
    {
      title: "Compte",
      items: [
        { key: "profil", label: "Mon profil", href: "/client/profile", icon: "i-user" },
        { key: "aide", label: "Aide", href: "/aide", icon: "i-help" },
      ],
    },
  ],
  // 4 onglets et, au centre, le bouton rond Publier (cta : jamais de pastille ni de libellé, route de publication).
  mobile: [
    { key: "accueil", label: "Accueil", href: "/client/dashboard", icon: "i-home" },
    { key: "missions", label: "Missions", href: "/client/missions", icon: "i-briefcase", exclude: [PUBLISH_PATH] },
    { key: "publier", label: "Publier une mission", href: PUBLISH_PATH, icon: "i-plus", exact: true, cta: true },
    { key: "messages", label: "Messages", href: "/client/messages", icon: "i-message", badge: "messages" },
    { key: "portefeuille", label: "Portefeuille", href: "/client/wallet", icon: "i-wallet" },
  ],
}
