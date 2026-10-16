// @ds-screen RD-ADMIN-01
// Fabriques d'URL de l'espace admin. Pur : paramètres vides omis.
// Routes actuelles conservées : un seul endroit à changer lors d'un déménagement.

const DEFAULT_VERIFICATION_TAB = "a-examiner"

function withQuery(path, entries) {
  const query = new URLSearchParams()
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === false || value === "") continue
    query.set(key, value === true ? "1" : String(value))
  }
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

function hasId(id) {
  return id !== undefined && id !== null && id !== ""
}

// Page 1 omise ; toute valeur non numérique ou inférieure à 2 donne l'absence de paramètre.
function pageParam(page) {
  const n = Number(page)
  return Number.isFinite(n) && n > 1 ? Math.floor(n) : undefined
}

export function adminHomeHref() {
  return "/admin/dashboard"
}

/** @param {{ onglet?: string, id?: string, q?: string, ecole?: string, delai?: string, page?: number|string }} [params] */
export function adminVerificationsHref({ onglet, id, q, ecole, delai, page } = {}) {
  return withQuery("/admin/verifications", [
    ["onglet", onglet === DEFAULT_VERIFICATION_TAB ? undefined : onglet],
    ["id", id],
    ["q", q],
    ["ecole", ecole],
    ["delai", delai],
    ["page", pageParam(page)],
  ])
}

/** @param {{ q?: string, role?: string, verif?: string, statut?: string, page?: number|string }} [params] */
export function adminUsersHref({ q, role, verif, statut, page } = {}) {
  return withQuery("/admin/users", [
    ["q", q],
    ["role", role],
    ["verif", verif],
    ["statut", statut],
    ["page", pageParam(page)],
  ])
}

/** @param {string} id @param {{ onglet?: string }} [params] */
export function adminUserHref(id, { onglet } = {}) {
  if (!hasId(id)) return "/admin/users"
  return withQuery(`/admin/users/${encodeURIComponent(id)}`, [["onglet", onglet]])
}

/** @param {{ q?: string, statut?: string, ville?: string, type?: string, page?: number|string }} [params] */
export function adminMissionsHref({ q, statut, ville, type, page } = {}) {
  return withQuery("/admin/missions", [
    ["q", q],
    ["statut", statut],
    ["ville", ville],
    ["type", type],
    ["page", pageParam(page)],
  ])
}

export function adminMissionHref(id) {
  if (!hasId(id)) return "/admin/missions"
  return `/admin/missions/${encodeURIComponent(id)}`
}

/** @param {{ q?: string, page?: number|string }} [params] */
export function adminWalletsHref({ q, page } = {}) {
  return withQuery("/admin/wallets", [
    ["q", q],
    ["page", pageParam(page)],
  ])
}

/** @param {{ type?: string, periode?: string, q?: string, page?: number|string }} [params] */
export function adminTransactionsHref({ type, periode, q, page } = {}) {
  return withQuery("/admin/transactions", [
    ["type", type],
    ["periode", periode],
    ["q", q],
    ["page", pageParam(page)],
  ])
}

export function adminWithdrawalsHref() {
  return "/admin/withdrawals"
}

/** Centre de notifications de l'admin. Seul le filtre « non-lues » est accepté. */
export function adminNotificationsHref({ filtre } = {}) {
  return withQuery("/admin/notifications", [["filtre", filtre === "non-lues" ? filtre : undefined]])
}

const DEFAULT_REPORT_TAB = "a-traiter"
const DEFAULT_REPORT_SORT = "anciens"

/** File des signalements. Onglet « à traiter » et tri « anciens » par défaut : omis de l'URL. */
export function adminReportsHref({ statut, tri, page } = {}) {
  return withQuery("/admin/reports", [
    ["statut", statut === DEFAULT_REPORT_TAB ? undefined : statut],
    ["tri", tri === DEFAULT_REPORT_SORT ? undefined : tri],
    ["page", pageParam(page)],
  ])
}

export function adminReportHref(id) {
  if (!hasId(id)) return "/admin/reports"
  return `/admin/reports/${encodeURIComponent(id)}`
}
