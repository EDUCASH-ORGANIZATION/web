// @ds-screen RD-ADMIN-01
// Libellés français de l'espace admin. Le prestataire de paiement n'est jamais nommé.

export const ROLE_LABELS = {
  student: "Étudiant",
  client: "Client",
  admin: "Administrateur",
}

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? "Compte"
}

export function accountStatusLabel({ isSuspended } = {}) {
  return isSuspended === true ? "Suspendu" : "Actif"
}

export const TRANSACTION_TYPE_LABELS = {
  deposit: "Recharge",
  reserve: "Réservation",
  release: "Libération",
  commission: "Commission",
  refund: "Remboursement",
  withdrawal: "Retrait",
}

export function transactionTypeLabel(type) {
  return TRANSACTION_TYPE_LABELS[type] ?? "Mouvement"
}
