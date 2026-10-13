// Modèle de la barre mobile de l'espace étudiant (objet pur et sérialisable, passé du layout serveur
// à BottomNav). Le profil n'y figure pas : l'avatar de l'en-tête y mène sur tous les écrans.
// Barre masquée sur les enfants stricts de /messages (conversation) seulement : le détail de mission
// (/student/missions/<id>) garde la barre, la barre de candidature fixe n'étant utilisée par aucun écran.

export const STUDENT_MOBILE_NAV = Object.freeze({
  mobile: Object.freeze([
    Object.freeze({ key: "accueil", label: "Accueil", href: "/dashboard", icon: "i-home" }),
    Object.freeze({ key: "missions", label: "Missions", href: "/student/missions", icon: "i-briefcase" }),
    Object.freeze({ key: "candidatures", label: "Candidatures", href: "/applications", icon: "i-file" }),
    Object.freeze({ key: "messages", label: "Messages", href: "/messages", icon: "i-message", badge: "messages" }),
  ]),
  mobileHideBelow: Object.freeze(["/messages"]),
})
