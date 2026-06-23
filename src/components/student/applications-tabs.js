"use client"

import { useState } from "react"
import Link from "next/link"
import { FileText, CheckCircle, XCircle, MessageSquare, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import clsx from "clsx"

const TYPE_COLORS = {
  "Babysitting":          "bg-pink-100 text-pink-700",
  "Livraison":            "bg-blue-100 text-blue-700",
  "Saisie":               "bg-teal-100 text-teal-700",
  "Community Management": "bg-indigo-100 text-indigo-700",
  "Traduction":           "bg-gray-100 text-gray-600",
  "Cours particuliers":   "bg-sky-100 text-sky-700",
  "Autre":                "bg-gray-100 text-gray-600",
}

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

function formatMoney(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

// ─── ApplicationCard ─────────────────────────────────────────────────────────

function ApplicationCard({ application }) {
  const { status, created_at, missions } = application

  const missionId   = missions?.id
  const title       = missions?.title ?? "Mission supprimée"
  const type        = missions?.type ?? ""
  const city        = missions?.city ?? ""
  const budget      = missions?.budget ?? 0
  const missionStatus = missions?.status

  const typeClass = TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600"
  const formattedDate = DATE_FORMAT.format(new Date(created_at))

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">

      {/* Badge statut — coin supérieur droit */}
      <div className="absolute top-4 right-4">
        <Badge status={status} />
      </div>

      {/* Titre mission */}
      <p className="font-semibold text-gray-900 pr-28 leading-snug">{title}</p>

      {/* Type + ville + budget */}
      <div className="flex flex-wrap items-center gap-2">
        {type && (
          <span className={clsx("px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide", typeClass)}>
            {type}
          </span>
        )}
        {city && (
          <span className="text-xs text-gray-500">{city}</span>
        )}
        {budget > 0 && (
          <>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-xs font-bold text-[#1A6B4A]">{formatMoney(budget)} FCFA</span>
          </>
        )}
        {missionStatus && missionStatus !== "open" && (
          <>
            <span className="text-gray-300 text-xs">·</span>
            <Badge status={missionStatus} />
          </>
        )}
      </div>

      {/* Date candidature */}
      <p className="text-sm text-gray-400">Postulé le {formattedDate}</p>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {missionId && (
          <Link
            href={`/missions/${missionId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors touch-manipulation"
          >
            <ExternalLink size={12} />
            Voir la mission
          </Link>
        )}

        {status === "accepted" && missionId && (
          <Link
            href={`/student/messages/${missionId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A6B4A] text-white text-xs font-medium hover:bg-[#155a3d] transition-colors touch-manipulation"
          >
            <MessageSquare size={12} />
            Envoyer un message
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Empty states par onglet ─────────────────────────────────────────────────

const EMPTY_STATES = {
  pending: {
    icon: FileText,
    title: "Aucune candidature en attente",
    message: "Tes prochaines candidatures apparaîtront ici.",
    href: "/student/missions",
    ctaLabel: "Explorer les missions",
  },
  accepted: {
    icon: CheckCircle,
    title: "Aucune candidature acceptée",
    message: "Continue à postuler — une opportunité t'attend !",
    href: "/student/missions",
    ctaLabel: "Voir les missions",
  },
  rejected: {
    icon: XCircle,
    title: "Aucune candidature refusée",
    message: "C'est une bonne nouvelle !",
    href: null,
    ctaLabel: null,
  },
}

function EmptyTab({ type }) {
  const { icon: Icon, title, message, href, ctaLabel } = EMPTY_STATES[type]
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <Icon size={40} className="text-gray-200" strokeWidth={1.5} />
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-sm text-gray-400 max-w-xs">{message}</p>
      {href && ctaLabel && (
        <Link
          href={href}
          className="mt-1 inline-flex items-center px-4 py-2 rounded-lg bg-[#1A6B4A] text-white text-sm font-medium hover:bg-[#155a3d] transition-colors touch-manipulation"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  )
}

// ─── ApplicationsTabs ────────────────────────────────────────────────────────

/**
 * @param {{
 *   pending: Array,
 *   accepted: Array,
 *   rejected: Array
 * }} props
 */
export function ApplicationsTabs({ pending, accepted, rejected }) {
  const tabs = [
    {
      value: "pending",
      label: "En attente",
      count: pending.length,
      data: pending,
      icon: FileText,
      activeColor: "text-amber-600",
      activeBg: "bg-amber-50",
      activeBorder: "border-amber-300",
      countBg: "bg-amber-100 text-amber-700",
    },
    {
      value: "accepted",
      label: "Acceptées",
      count: accepted.length,
      data: accepted,
      icon: CheckCircle,
      activeColor: "text-[#1A6B4A]",
      activeBg: "bg-green-50",
      activeBorder: "border-green-300",
      countBg: "bg-green-100 text-[#1A6B4A]",
    },
    {
      value: "rejected",
      label: "Refusées",
      count: rejected.length,
      data: rejected,
      icon: XCircle,
      activeColor: "text-red-600",
      activeBg: "bg-red-50",
      activeBorder: "border-red-200",
      countBg: "bg-red-100 text-red-600",
    },
  ]

  const [active, setActive] = useState("pending")
  const current = tabs.find((t) => t.value === active)

  return (
    <div className="flex flex-col gap-4">

      {/* Onglets */}
      <div className="flex gap-2 w-full overflow-x-auto pb-0.5" role="tablist">
        {tabs.map(({ value, label, count, icon: Icon, activeColor, activeBg, activeBorder, countBg }) => {
          const isActive = active === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(value)}
              className={clsx(
                "flex-1 shrink-0 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all whitespace-nowrap touch-manipulation cursor-pointer",
                isActive
                  ? clsx("shadow-sm", activeBg, activeColor, activeBorder)
                  : "border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <Icon size={14} className="shrink-0" />
              <span>{label}</span>
              <span className={clsx(
                "text-[11px] font-bold px-1.5 py-0.5 rounded-md transition-colors",
                isActive ? countBg : "bg-gray-100 text-gray-500"
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Contenu de l'onglet actif */}
      <div role="tabpanel">
        {current?.data.length === 0 ? (
          <EmptyTab type={active} />
        ) : (
          <div className="flex flex-col gap-3">
            {current?.data.map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
