"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { VerifiedAvatar } from "@/components/shared/verified-avatar"
import * as Tabs from "@radix-ui/react-tabs"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
import {
  Users, Info, CreditCard, CheckCircle, Loader2,
  Star, MapPin, GraduationCap, Briefcase, MessageSquare,
  Zap, ShieldCheck, Clock,
} from "lucide-react"
import clsx from "clsx"
import { acceptApplication, rejectApplication } from "@/lib/actions/application.actions"
import { updateMissionStatus } from "@/lib/actions/mission.actions"
import { useToast } from "@/components/shared/toaster"
import { ConfirmMissionModal } from "@/components/client/confirm-mission-modal"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso))
}

function StarRow({ rating = 0 }) {
  const filled = Math.round(rating)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={i < filled ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
        />
      ))}
      {rating > 0 && (
        <span className="text-xs text-gray-400 ml-1.5 font-semibold">{rating.toFixed(1)}</span>
      )}
    </div>
  )
}

// ─── Accept dialog ────────────────────────────────────────────────────────────

function AcceptButton({ applicationId, studentId, missionId, studentName, onAccepted }) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    const result = await acceptApplication({ applicationId, studentId, missionId })
    setLoading(false)

    if (result.error) {
      toast({ message: result.error, type: "error" })
      return
    }

    setOpen(false)
    toast({ message: "Candidature acceptée ! La mission est maintenant en cours.", type: "success" })
    onAccepted(applicationId)
    router.refresh()
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button
          type="button"
          className="flex-1 py-2 rounded-xl bg-[#1A6B4A] text-white text-xs font-bold hover:bg-[#155a3d] transition-colors touch-manipulation"
        >
          Accepter
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-40 animate-in fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 focus:outline-none animate-in fade-in-0 zoom-in-95">
          <div className="flex flex-col items-center text-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
              <CheckCircle size={28} className="text-[#1A6B4A]" />
            </div>
            <div>
              <AlertDialog.Title className="text-base font-black text-gray-900">
                Accepter {studentName} ?
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                Les autres candidatures seront automatiquement refusées et la mission passera en statut <strong>&ldquo;En cours&rdquo;</strong>.
              </AlertDialog.Description>
            </div>
          </div>
          <div className="flex gap-3">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 touch-manipulation"
              >
                Annuler
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 touch-manipulation"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Confirmer
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

// ─── Candidate card ───────────────────────────────────────────────────────────

function CandidateCard({ application, missionId, onStatusChange }) {
  const { toast } = useToast()
  const profile        = application.profiles ?? {}
  const studentProfile = application.student_profiles ?? {}
  const skills         = (studentProfile.skills ?? []).slice(0, 3)

  const isAccepted = application.status === "accepted"
  const isRejected = application.status === "rejected"
  const isPending  = application.status === "pending"

  const [rejectLoading, setRejectLoading] = useState(false)

  async function handleReject() {
    setRejectLoading(true)
    const result = await rejectApplication(application.id)
    setRejectLoading(false)
    if (result.error) { toast({ message: result.error, type: "error" }); return }
    toast({ message: "Candidature refusée.", type: "info" })
    onStatusChange(application.id, "rejected")
  }

  return (
    <div className={clsx(
      "bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden transition-opacity",
      isRejected ? "opacity-50 border-gray-100" : isAccepted ? "border-green-200 ring-1 ring-green-200" : "border-gray-100"
    )}>
      {/* Accepted banner */}
      {isAccepted && (
        <div className="bg-green-500 px-4 py-1.5 flex items-center gap-2">
          <CheckCircle size={13} className="text-white" />
          <p className="text-xs font-bold text-white">Candidature acceptée</p>
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col gap-3">

        {/* Header: avatar + identité */}
        <div className="flex items-start gap-3">
          <VerifiedAvatar
            avatarUrl={profile.avatar_url}
            fullName={profile.full_name ?? ""}
            isVerified={profile.is_verified ?? false}
            verifiedUntil={profile.verified_until ?? null}
            size="md"
            showBadge
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-gray-900 truncate">{profile.full_name ?? "Étudiant"}</p>
            {studentProfile.school && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <GraduationCap size={11} />
                {studentProfile.school}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <StarRow rating={profile.rating ?? 0} />
              {(profile.missions_done ?? 0) > 0 && (
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {profile.missions_done} mission{profile.missions_done > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Infos académiques */}
        {(studentProfile.level || profile.city) && (
          <div className="flex items-center gap-3 flex-wrap">
            {studentProfile.level && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Briefcase size={10} />
                {studentProfile.level}
              </span>
            )}
            {profile.city && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <MapPin size={10} />
                {profile.city}
              </span>
            )}
          </div>
        )}

        {/* Compétences */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span key={skill} className="px-2.5 py-1 rounded-lg bg-[#f0faf5] text-[#1A6B4A] text-[10px] font-bold">
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Message de motivation */}
        {application.message && (
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-xs text-gray-600 italic leading-relaxed line-clamp-3">
              &ldquo;{application.message}&rdquo;
            </p>
          </div>
        )}

        {/* Footer : lien profil + actions */}
        <div className="flex items-center gap-2 pt-1">
          <a
            href={`/students/${application.student_id}?missionId=${missionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-[#1A6B4A] hover:underline mr-auto"
          >
            Voir profil →
          </a>

          {isPending && (
            <>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejectLoading}
                className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 touch-manipulation"
              >
                {rejectLoading ? <Loader2 size={12} className="animate-spin" /> : "Refuser"}
              </button>
              <AcceptButton
                applicationId={application.id}
                studentId={application.student_id}
                missionId={missionId}
                studentName={profile.full_name ?? "cet étudiant"}
                onAccepted={(id) => onStatusChange(id, "accepted")}
              />
            </>
          )}

          {isRejected && (
            <span className="text-[11px] text-gray-400 italic">Refusé</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab Candidatures ─────────────────────────────────────────────────────────

function TabApplications({ applications, missionId, onStatusChange }) {
  const pending  = applications.filter((a) => a.status === "pending")
  const accepted = applications.filter((a) => a.status === "accepted")
  const rejected = applications.filter((a) => a.status === "rejected")

  if (!applications.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Users size={28} className="text-gray-300" />
        </div>
        <p className="text-sm font-bold text-gray-700 mb-1">Aucune candidature reçue</p>
        <p className="text-xs text-gray-400 max-w-xs">
          Votre mission est visible par les étudiants. Les candidatures apparaîtront ici dès qu&apos;un étudiant postule.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {accepted.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle size={12} className="text-green-500" />
            Accepté ({accepted.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accepted.map((app) => (
              <CandidateCard key={app.id} application={app} missionId={missionId} onStatusChange={onStatusChange} />
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Clock size={12} className="text-blue-400" />
            En attente ({pending.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((app) => (
              <CandidateCard key={app.id} application={app} missionId={missionId} onStatusChange={onStatusChange} />
            ))}
          </div>
        </div>
      )}

      {rejected.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Refusés ({rejected.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rejected.map((app) => (
              <CandidateCard key={app.id} application={app} missionId={missionId} onStatusChange={onStatusChange} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Paiement ─────────────────────────────────────────────────────────────

function TabPayment({ mission, selectedStudentName }) {
  const [modalOpen, setModalOpen] = useState(false)

  if (mission.status === "done") {
    return (
      <div className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center">
          <CheckCircle size={40} className="text-[#1A6B4A]" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-lg font-black text-gray-900">Mission terminée</p>
          <p className="text-sm text-gray-500 mt-1.5">
            Le paiement a été libéré depuis votre wallet.
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-4 text-center">
          <p className="text-xs text-gray-500">Montant versé à l&apos;étudiant</p>
          <p className="text-2xl font-black text-[#1A6B4A] mt-0.5">
            {fmt(Math.round(mission.budget * 0.88))} FCFA
          </p>
        </div>
      </div>
    )
  }

  if (mission.status === "in_progress") {
    return (
      <>
        <div className="flex flex-col gap-6">
          {/* Statut en cours */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <CreditCard size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-900">Mission en cours</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Confirmez la fin de mission pour libérer le paiement depuis votre wallet.
                </p>
              </div>
            </div>
          </div>

          {/* Récapitulatif */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
            <p className="text-sm font-black text-gray-900">Récapitulatif du paiement</p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Budget total</span>
                <span className="font-semibold text-gray-900">{fmt(mission.budget)} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Commission EduCash (12%)</span>
                <span className="font-semibold text-gray-700">
                  {fmt(Math.round(mission.budget * 0.12))} FCFA
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
                <span className="font-bold text-gray-900">
                  Versé à {selectedStudentName?.split(" ")[0] ?? "l'étudiant"}
                </span>
                <span className="font-black text-[#1A6B4A]">
                  {fmt(Math.round(mission.budget * 0.88))} FCFA
                </span>
              </div>
            </div>
          </div>

          {/* Bouton */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full py-4 rounded-2xl bg-[#1A6B4A] text-white font-bold hover:bg-[#155a3d] transition-colors flex items-center justify-center gap-2 touch-manipulation"
          >
            <CheckCircle size={18} />
            Confirmer la fin et payer
          </button>

          <div className="flex items-center gap-2 justify-center">
            <ShieldCheck size={14} className="text-[#1A6B4A]" />
            <p className="text-xs text-gray-400 text-center">
              Paiement instantané depuis votre wallet · Sécurisé par EduCash
            </p>
          </div>
        </div>

        <ConfirmMissionModal
          missionId={mission.id}
          missionTitle={mission.title}
          studentName={selectedStudentName ?? "l'étudiant(e)"}
          budget={mission.budget}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      </>
    )
  }

  // Open / cancelled
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <CreditCard size={28} className="text-gray-300" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-700">Paiement non disponible</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Le paiement sera disponible une fois un étudiant sélectionné et la mission démarrée.
        </p>
      </div>
    </div>
  )
}

// ─── MissionDetailTabs ────────────────────────────────────────────────────────

export function MissionDetailTabs({ mission, applications: initialApplications }) {
  const [applications, setApplications] = useState(initialApplications)

  function handleStatusChange(id, newStatus) {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    )
  }

  const acceptedApp         = applications.find((a) => a.status === "accepted")
  const selectedStudentName = acceptedApp?.profiles?.full_name ?? null

  const pendingCount = applications.filter((a) => a.status === "pending").length

  const tabs = [
    { value: "applications", label: "Candidatures", count: applications.length, icon: Users    },
    { value: "payment",      label: "Paiement",     count: null,                icon: CreditCard },
  ]

  return (
    <Tabs.Root defaultValue="applications" className="flex flex-col gap-5">
      <Tabs.List className="flex gap-1 bg-gray-100 p-1 rounded-2xl overflow-x-auto">
        {tabs.map(({ value, label, count, icon: Icon }) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className={clsx(
              "flex-1 shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap touch-manipulation",
              "text-gray-500 hover:text-gray-700",
              "data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
            )}
          >
            <Icon size={15} />
            {label}
            {count !== null && count > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-[#1A6B4A] text-white text-[10px] font-black">
                {count}
              </span>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="applications" className="focus:outline-none">
        <TabApplications
          applications={applications}
          missionId={mission.id}
          onStatusChange={handleStatusChange}
        />
      </Tabs.Content>

      <Tabs.Content value="payment" className="focus:outline-none">
        <TabPayment mission={mission} selectedStudentName={selectedStudentName} />
      </Tabs.Content>
    </Tabs.Root>
  )
}
