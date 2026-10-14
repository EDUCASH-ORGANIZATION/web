// @ds-screen RD-STUDENT-01
// Configuration de la coquille de l'espace étudiant. Agenda, Paramètres et cloche restent masqués
// (aucune page, aucune notification). Chaque lien vise une route existante (routes actuelles, décision D1).
// Barre mobile (décision D3) : les 4 onglets de RD-NAV-02 ; le portefeuille passe par la carte argent et la sidebar.
// Elle reste visible sur le détail de mission et se masque sur les enfants stricts de /messages (conversation).

export const STUDENT_NAV = {
  space: "Espace étudiant",
  identityLabel: "Étudiant",
  homeHref: "/dashboard",
  profileHref: "/profile",
  search: {
    action: "/student/missions",
    param: "q",
    echo: true,
    label: "Rechercher une mission",
    placeholder: "Rechercher une mission",
  },
  groups: [
    {
      title: null,
      items: [
        { key: "accueil", label: "Accueil", href: "/dashboard", icon: "i-home" },
        { key: "missions", label: "Missions", href: "/student/missions", icon: "i-briefcase" },
        { key: "candidatures", label: "Candidatures", href: "/applications", icon: "i-file" },
        { key: "messages", label: "Messages", href: "/messages", icon: "i-message", badge: "messages" },
        { key: "portefeuille", label: "Portefeuille", href: "/wallet", icon: "i-wallet" },
      ],
    },
    {
      title: "Compte",
      items: [
        { key: "profil", label: "Mon profil", href: "/profile", icon: "i-user", exclude: ["/profile/verify"] },
        { key: "verification", label: "Vérification", href: "/profile/verify", icon: "i-shield" },
        { key: "aide", label: "Aide", href: "/aide", icon: "i-help" },
      ],
    },
  ],
  mobile: [
    { key: "accueil", label: "Accueil", href: "/dashboard", icon: "i-home" },
    { key: "missions", label: "Missions", href: "/student/missions", icon: "i-briefcase" },
    { key: "candidatures", label: "Candidatures", href: "/applications", icon: "i-file" },
    { key: "messages", label: "Messages", href: "/messages", icon: "i-message", badge: "messages" },
  ],
  mobileHideBelow: ["/messages"],
}
