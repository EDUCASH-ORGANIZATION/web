"use client"

import { MapPin, Clock } from "lucide-react"
import clsx from "clsx"

/**
 * Timestamp relatif depuis une date ISO.
 * @param {string} dateStr
 * @returns {string}
 */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  if (minutes > 0) return `il y a ${minutes}min`
  return "à l'instant"
}

// Badge : urgence prime sur le type quand "high"
const URGENCY_BADGE = {
  high: { label: "Urgent", className: "bg-amber-100 text-amber-700" },
  medium: { label: "Moyen", className: "bg-orange-100 text-orange-700" },
  low: null, // pas de badge urgence si normal
}

const TYPE_BADGE = {
  "Babysitting":             "bg-pink-100 text-pink-700",
  "Livraison":               "bg-blue-100 text-blue-700",
  "Aide administrative":     "bg-purple-100 text-purple-700",
  "Saisie":                  "bg-teal-100 text-teal-700",
  "Community Management":    "bg-indigo-100 text-indigo-700",
  "Traduction":              "bg-gray-100 text-gray-600",
  "Cours particuliers":      "bg-sky-100 text-sky-700",
  "Autre":                   "bg-gray-100 text-gray-600",
}

/**
 * Carte de mission — composant le plus affiché de l'app.
 *
 * @param {{
 *   mission: import('@/lib/supabase/database.constants').Mission,
 *   showApplyButton?: boolean,
 *   isApplied?: boolean,
 *   onApply?: (mission: import('@/lib/supabase/database.constants').Mission) => void
 * }} props
 */
export function MissionCard({ mission, showApplyButton = false, isApplied = false, onApply }) {
  const formattedBudget = new Intl.NumberFormat("fr-FR").format(mission.budget)

  // Badge principal : urgence si high, sinon type
  const urgency = URGENCY_BADGE[mission.urgency]
  const showUrgencyBadge = mission.urgency === "high"
  const badgeLabel = showUrgencyBadge ? urgency.label : mission.type
  const badgeClass = showUrgencyBadge
    ? urgency.className
    : (TYPE_BADGE[mission.type] ?? "bg-gray-100 text-gray-600")

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-md">

      {/* Corps de la carte */}
      <div className="flex flex-col gap-3 p-5 flex-1">

        {/* Ligne 1 : badge type/urgence + budget */}
        <div className="flex items-center justify-between gap-2">
          <span className={clsx(
            "px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide shrink-0",
            badgeClass
          )}>
            {badgeLabel}
          </span>
          <span className="text-sm font-bold text-[#1A6B4A] shrink-0">
            {formattedBudget} FCFA
          </span>
        </div>

        {/* Titre */}
        <h3 className="font-bold text-[17px] text-gray-900 line-clamp-2 leading-snug">
          {mission.title}
        </h3>

        {/* Description */}
        {mission.description && (
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">
            {mission.description}
          </p>
        )}

        {/* Ville + horodatage */}
        <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto">
          <span className="flex items-center gap-1">
            <MapPin size={12} strokeWidth={1.75} className="shrink-0" />
            {mission.city}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} strokeWidth={1.75} className="shrink-0" />
            {timeAgo(mission.created_at)}
          </span>
        </div>
      </div>

      {/* Bouton Postuler — séparé du corps par une ligne */}
      {showApplyButton && (
        isApplied ? (
          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-400 bg-gray-50">
            ✓ Candidature envoyée
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onApply?.(mission)}
            className="border-t border-gray-100 px-5 py-3 text-sm font-semibold text-[#1A6B4A] hover:bg-[#f0faf5] active:bg-[#d9f2e8] transition-colors touch-manipulation w-full"
          >
            Postuler
          </button>
        )
      )}
    </div>
  )
}
