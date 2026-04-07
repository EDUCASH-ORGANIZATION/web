"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import * as Tabs from "@radix-ui/react-tabs"
import {
  Users, Info, CreditCard, MapPin, Calendar, Zap,
  CheckCircle, Loader2, Briefcase,
} from "lucide-react"
import clsx from "clsx"
import { StudentCard } from "@/components/client/student-card"
import { EmptyState } from "@/components/ui/empty-state"
import { updateMissionStatus } from "@/lib/actions/mission.actions"
import { useToast } from "@/components/shared/toaster"

const URGENCY_LABELS = { high: "Urgent", medium: "Moyen", low: "Normal" }

function formatMoney(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso))
}

// ─── Tab Candidatures ─────────────────────────────────────────────────────────

function TabApplications({ applications, missionId, onApplicationStatusChange }) {
  if (!applications.length) {
    return (
      <EmptyState
        icon={Users}
        title="Aucune candidature reçue"
        message="Votre mission est visible par les étudiants. Les candidatures apparaîtront ici."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {applications.map((app) => (
        <StudentCard
          key={app.id}
          application={app}
          missionId={missionId}
          onStatusChange={onApplicationStatusChange}
        />
      ))}
    </div>
  )
}

// ─── Tab Détails ──────────────────────────────────────────────────────────────

function TabDetails({ mission }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Description</h3>
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
          {mission.description}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin size={12} /> Ville
          </div>
          <p className="text-sm font-semibold text-gray-900">{mission.city}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            💰 Budget
          </div>
          <p className="text-sm font-semibold text-[#1A6B4A]">{formatMoney(mission.budget)} FCFA</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Zap size={12} /> Urgence
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {URGENCY_LABELS[mission.urgency] ?? "Normal"}
          </p>
        </div>

        {mission.deadline && (
          <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar size={12} /> Deadline
            </div>
            <p className="text-sm font-semibold text-gray-900">{formatDate(mission.deadline)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab Paiement ─────────────────────────────────────────────────────────────

function TabPayment({ mission }) {
  const { toast } = useToast()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleConfirmDone() {
    setIsLoading(true)
    const result = await updateMissionStatus(mission.id, "done")
    setIsLoading(false)

    if (result.error) {
      toast({ message: result.error, type: "error" })
      return
    }

    router.push(`/client/payment/${mission.id}`)
  }

  if (mission.status === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle size={32} className="text-emerald-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900">Mission terminée</p>
          <p className="text-sm text-gray-500 mt-1">Le paiement a été traité avec succès.</p>
        </div>
        <a
          href="#"
          className="text-sm text-[#1A6B4A] hover:underline font-medium"
          onClick={(e) => e.preventDefault()}
        >
          Télécharger le reçu (bientôt disponible)
        </a>
      </div>
    )
  }

  if (mission.status === "in_progress") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <CreditCard size={32} className="text-amber-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900">Mission en cours</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">
            Confirmez la fin de mission une fois le travail effectué pour procéder au paiement.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-center">
          <p className="text-sm text-amber-800 font-medium">
            Montant à payer : <span className="font-bold">{formatMoney(mission.budget)} FCFA</span>
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Commission EduCash (12%) incluse
          </p>
        </div>
        <button
          type="button"
          onClick={handleConfirmDone}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 active:bg-amber-700 transition-colors disabled:opacity-60 touch-manipulation"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
          Confirmer la fin de mission et payer
        </button>
      </div>
    )
  }

  // Mission ouverte ou annulée
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Briefcase size={40} className="text-gray-200" strokeWidth={1.5} />
      <p className="text-sm text-gray-500">
        Le paiement sera disponible une fois un étudiant sélectionné et la mission démarrée.
      </p>
    </div>
  )
}

// ─── MissionDetailTabs ────────────────────────────────────────────────────────

/**
 * @param {{
 *   mission: object,
 *   applications: object[]
 * }} props
 */
export function MissionDetailTabs({ mission, applications: initialApplications }) {
  const [applications, setApplications] = useState(initialApplications)

  function handleApplicationStatusChange(applicationId, newStatus) {
    setApplications((prev) =>
      prev.map((a) => a.id === applicationId ? { ...a, status: newStatus } : a)
    )
  }

  const tabs = [
    {
      value: "applications",
      label: `Candidatures (${applications.length})`,
      icon: Users,
    },
    {
      value: "details",
      label: "Détails",
      icon: Info,
    },
    {
      value: "payment",
      label: "Paiement",
      icon: CreditCard,
    },
  ]

  return (
    <Tabs.Root defaultValue="applications" className="flex flex-col gap-5">
      <Tabs.List className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(({ value, label, icon: Icon }) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className={clsx(
              "flex-1 shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap touch-manipulation",
              "text-gray-500 hover:text-gray-700",
              "data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
            )}
          >
            <Icon size={14} />
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="applications" className="focus:outline-none">
        <TabApplications
          applications={applications}
          missionId={mission.id}
          onApplicationStatusChange={handleApplicationStatusChange}
        />
      </Tabs.Content>

      <Tabs.Content value="details" className="focus:outline-none">
        <TabDetails mission={mission} />
      </Tabs.Content>

      <Tabs.Content value="payment" className="focus:outline-none">
        <TabPayment mission={mission} />
      </Tabs.Content>
    </Tabs.Root>
  )
}
