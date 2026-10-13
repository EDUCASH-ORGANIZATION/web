// Statut affiché d'une candidature (_system/index.html section 08). Pur.

const VIEWS = {
  pending: { key: "pending", label: "En attente", tone: "alerte" },
  accepted: { key: "accepted", label: "Acceptée", tone: "succes" },
  rejected: { key: "rejected", label: "Non retenue", tone: "neutre" },
}

/**
 * @param {string|null|undefined} status "pending" | "accepted" | "rejected"
 * @returns {{ key: "pending" | "accepted" | "rejected", label: string, tone: string }}
 */
export function applicationStatusView(status) {
  return { ...(Object.hasOwn(VIEWS, status) ? VIEWS[status] : VIEWS.pending) }
}
