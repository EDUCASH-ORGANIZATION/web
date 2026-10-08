import { isUuid } from "./ids"

// Chemin du profil public d'un étudiant (ancienne route /students/[id]).
// Seul missionId est conservé, et uniquement s'il s'agit d'un UUID.
export function talentPathFromLegacy(id, searchParams) {
  const path = `/talents/${encodeURIComponent(id)}`
  const raw = searchParams?.missionId
  const missionId = Array.isArray(raw) ? raw[0] : raw
  if (isUuid(missionId)) {
    return `${path}?missionId=${missionId}`
  }
  return path
}
