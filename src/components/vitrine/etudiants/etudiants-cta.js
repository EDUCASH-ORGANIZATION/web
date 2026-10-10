// Appels à l'action de /etudiants selon le rôle lu côté serveur (affichage seulement, aucune autorisation).

/** Action principale destinée à l'étudiant (ou au visiteur) : { href, label }. */
export function studentAction(role) {
  if (role === "student") return { href: "/student/missions", label: "Voir les missions pour moi" }
  if (role === "client") return { href: "/missions", label: "Voir les missions" }
  return { href: "/auth/register?role=student", label: "Créer mon compte" }
}

/** Action de la carte destinée aux familles et entreprises : { href, label }. */
export function familyAction(role) {
  if (role === "client") return { href: "/client/missions/new", label: "Publier une mission" }
  return { href: "/", label: "Découvrir EduCash pour vous" }
}
