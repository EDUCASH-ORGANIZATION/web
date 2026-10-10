import { isUuid } from "./ids"

/**
 * Détermine l'appel à l'action de candidature d'une mission publique.
 * @param {{ role: "student"|"client"|"admin"|null, missionId: string, missionType?: string, accepting: boolean, hasApplied?: boolean }} params
 * @returns {{ kind: string, primary: {label: string, href: string}|null, secondary: {label: string, href: string}|null, message: string|null }}
 */
export function applyCta({ role, missionId, missionType, accepting, hasApplied = false }) {
  if (!isUuid(missionId)) throw new Error("Identifiant de mission invalide")

  if (!accepting) {
    const query = missionType ? `?type=${encodeURIComponent(missionType)}` : ""
    return {
      kind: "closed",
      primary: { label: "Voir des missions similaires", href: `/missions${query}` },
      secondary: null,
      message: "Cette mission n'accepte plus de candidatures",
    }
  }

  const applyPath = `/student/missions/${missionId}`

  if (!role) {
    return {
      kind: "visitor",
      primary: {
        label: "Se connecter pour postuler",
        href: `/auth/login?next=${encodeURIComponent(applyPath)}`,
      },
      secondary: {
        label: "Créer un compte étudiant",
        href: `/auth/register?role=student&next=${encodeURIComponent(applyPath)}`,
      },
      message: null,
    }
  }

  if (role === "student") {
    if (hasApplied) {
      return {
        kind: "student-applied",
        primary: { label: "Voir ma candidature", href: "/applications" },
        secondary: null,
        message: null,
      }
    }
    return {
      kind: "student",
      primary: { label: "Postuler", href: applyPath },
      secondary: null,
      message: null,
    }
  }

  if (role === "client") {
    return {
      kind: "client",
      primary: { label: "Publier une mission similaire", href: "/client/missions/new" },
      secondary: null,
      message: "Les candidatures sont réservées aux étudiants.",
    }
  }

  return {
    kind: "admin",
    primary: null,
    secondary: null,
    message: "Vue publique de la mission.",
  }
}
