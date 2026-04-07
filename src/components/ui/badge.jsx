const STATUS_CONFIG = {
  // Mission statuses
  open: {
    label: "Ouverte",
    className: "bg-blue-50 text-blue-600 ring-blue-200",
  },
  in_progress: {
    label: "En cours",
    className: "bg-amber-50 text-amber-600 ring-amber-200",
  },
  done: {
    label: "Terminée",
    className: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-gray-100 text-gray-500 ring-gray-200",
  },
  // Application statuses
  pending: {
    label: "En attente",
    className: "bg-amber-50 text-amber-600 ring-amber-200",
  },
  accepted: {
    label: "Acceptée",
    className: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  },
  rejected: {
    label: "Refusée",
    className: "bg-gray-100 text-gray-500 ring-gray-200",
  },
  // Transaction statuses
  paid: {
    label: "Payée",
    className: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  },
  failed: {
    label: "Échouée",
    className: "bg-red-50 text-red-600 ring-red-200",
  },
  refunded: {
    label: "Remboursée",
    className: "bg-blue-50 text-blue-600 ring-blue-200",
  },
}

export function Badge({ status }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-500 ring-gray-200",
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${config.className}`}
    >
      {config.label}
    </span>
  )
}
