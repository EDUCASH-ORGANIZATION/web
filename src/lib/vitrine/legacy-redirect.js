const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Chemin du profil public d'un étudiant (ancienne route /students/[id]).
// Seul missionId est conservé, et uniquement s'il s'agit d'un UUID.
export function talentPathFromLegacy(id, searchParams) {
  const path = `/talents/${encodeURIComponent(id)}`
  const raw = searchParams?.missionId
  const missionId = Array.isArray(raw) ? raw[0] : raw
  if (typeof missionId === "string" && UUID_RE.test(missionId)) {
    return `${path}?missionId=${missionId}`
  }
  return path
}
