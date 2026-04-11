"use client"

import { useState } from "react"
import { VerifiedAvatar } from "@/components/shared/verified-avatar"
import { RejectModal } from "@/components/admin/reject-modal"
import { useRouter } from "next/navigation"
import {
  CheckCircle, XCircle, Loader2, ShieldCheck, Clock,
  Users, AlertCircle, FileQuestion, RotateCcw, GraduationCap,
  Calendar, RefreshCw, Timer, TrendingUp,
} from "lucide-react"
import { verifyStudent, resetRejection } from "@/lib/actions/admin.actions"
import { useToast } from "@/components/shared/toaster"

// ─── Badge délai de soumission ────────────────────────────────────────────────

function DelayBadge({ submittedAt, createdAt }) {
  const ref = submittedAt ?? createdAt
  if (!ref) return null

  const diffMs   = Date.now() - new Date(ref).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <Timer size={9} /> Soumis aujourd&apos;hui
      </span>
    )
  }
  if (diffDays === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Timer size={9} /> Soumis hier
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
      <Timer size={9} /> Soumis il y a {diffDays} jours
    </span>
  )
}

// ─── Badge statut ─────────────────────────────────────────────────────────────

function StatusBadge({ profile }) {
  if (profile.is_verified && profile.verified_until && new Date(profile.verified_until) < new Date()) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-black text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">
        <RefreshCw size={11} /> Expiré
      </span>
    )
  }
  if (profile.is_verified) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-black text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
        <ShieldCheck size={11} /> Vérifié
      </span>
    )
  }
  if (profile.rejection_reason) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
        <XCircle size={11} /> Rejeté
      </span>
    )
  }
  if (profile.card_url) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
        <Clock size={11} /> En attente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-black text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
      <FileQuestion size={11} /> Incomplet
    </span>
  )
}

// ─── AlertDialog de confirmation (validation) ─────────────────────────────────

function ConfirmVerifyDialog({ profile, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
            <ShieldCheck size={28} className="text-green-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900">
              Confirmer la vérification
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Valider le dossier de{" "}
              <span className="font-semibold text-gray-700">
                {profile.full_name ?? "cet étudiant"}
              </span>{" "}
              ?
            </p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-green-700 font-semibold">
            Un badge vérifié valable <strong>1 an</strong> sera attribué.
          </p>
          <p className="text-[11px] text-green-600 mt-0.5">
            L&apos;étudiant recevra un email de confirmation.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card vérification ────────────────────────────────────────────────────────

function VerificationCard({ profile }) {
  const [verifying, setVerifying]           = useState(false)
  const [resetting, setResetting]           = useState(false)
  const [showReject, setShowReject]         = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const registeredDate = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(profile.created_at))

  async function handleVerify() {
    setVerifying(true)
    setShowConfirm(false)
    const result = await verifyStudent(profile.user_id)
    setVerifying(false)
    if (result.error) {
      toast({ message: result.error, type: "error" })
    } else {
      toast({ message: `${profile.full_name} vérifié(e) avec succès.`, type: "success" })
      router.refresh()
    }
  }

  async function handleReset() {
    setResetting(true)
    const result = await resetRejection(profile.user_id)
    setResetting(false)
    if (result.error) {
      toast({ message: result.error, type: "error" })
    } else {
      toast({ message: "Dossier réinitialisé — l'étudiant peut soumettre à nouveau.", type: "info" })
      router.refresh()
    }
  }

  const isExpired = profile.is_verified && profile.verified_until && new Date(profile.verified_until) < new Date()

  const borderCls = isExpired
    ? "border-purple-200"
    : profile.is_verified
      ? "border-green-200"
      : profile.rejection_reason
        ? "border-red-200"
        : "border-gray-100"

  return (
    <>
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col ${borderCls}`}>

        {/* Header */}
        <div className="p-5 flex items-start gap-3 border-b border-gray-50">
          <VerifiedAvatar
            avatarUrl={profile.avatar_url}
            fullName={profile.full_name ?? ""}
            isVerified={profile.is_verified && !isExpired}
            showBadge={false}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900 truncate">
              {profile.full_name ?? "Nom non renseigné"}
            </p>
            {profile.school && (
              <span className="text-xs text-gray-400 flex items-center gap-1 truncate mt-0.5">
                <GraduationCap size={10} />
                {profile.school}
              </span>
            )}
            <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
              <Calendar size={10} />
              Inscrit le {registeredDate}
            </p>
            {/* Délai de soumission — visible seulement pour les dossiers en attente */}
            {profile.card_url && !profile.is_verified && !profile.rejection_reason && (
              <div className="mt-1.5">
                <DelayBadge
                  submittedAt={profile.verification_submitted_at}
                  createdAt={profile.created_at}
                />
              </div>
            )}
          </div>
          <StatusBadge profile={profile} />
        </div>

        {/* Carte étudiante */}
        <div className="p-5 flex flex-col gap-3 flex-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Carte étudiante
          </p>

          {profile.card_url ? (
            <a
              href={profile.card_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className="relative w-full h-44 rounded-xl border border-gray-100 overflow-hidden bg-gray-50 group-hover:border-[#1A6B4A] transition-colors">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.card_url}
                  alt="Carte étudiante"
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-[#1A6B4A] text-xs font-black px-3 py-1.5 rounded-full shadow-lg">
                    Agrandir →
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#1A6B4A] mt-1.5 font-semibold group-hover:underline">
                Ouvrir en plein écran →
              </p>
            </a>
          ) : (
            <div className="w-full h-44 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
              <FileQuestion size={28} className="text-gray-300" />
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-400">Aucune carte fournie</p>
                <p className="text-[11px] text-gray-300 mt-0.5">L&apos;étudiant n&apos;a pas encore soumis de document</p>
              </div>
            </div>
          )}

          {/* Motif de rejet */}
          {profile.rejection_reason && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex gap-2.5">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black text-red-700 uppercase tracking-wider">Motif du rejet</p>
                <p className="text-xs text-red-600 mt-0.5">{profile.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Info expiration */}
          {isExpired && profile.verified_until && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex gap-2.5">
              <RefreshCw size={14} className="text-purple-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black text-purple-700 uppercase tracking-wider">Badge expiré</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Expiré le{" "}
                  {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(profile.verified_until))}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5">
          {profile.is_verified && !isExpired ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
              <CheckCircle size={14} className="text-green-600" />
              <p className="text-xs font-bold text-green-700">Dossier approuvé</p>
            </div>
          ) : isExpired ? (
            /* Badge expiré → renouveler */
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={verifying}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {verifying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Renouveler le badge
            </button>
          ) : profile.rejection_reason ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="w-full py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Réinitialiser le dossier
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowReject(true)}
                className="flex-1 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <XCircle size={13} />
                Rejeter
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={verifying}
                className="flex-1 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-xs font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {verifying ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                Valider
              </button>
            </div>
          )}
        </div>
      </div>

      {showReject && (
        <RejectModal
          userId={profile.user_id}
          name={profile.full_name ?? "cet étudiant"}
          onClose={() => setShowReject(false)}
        />
      )}

      {showConfirm && (
        <ConfirmVerifyDialog
          profile={profile}
          loading={verifying}
          onConfirm={handleVerify}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center col-span-full">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-gray-300" />
      </div>
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS = [
  {
    value: "submitted",
    label: "À examiner",
    icon: Clock,
    color: "text-amber-600",
    emptyIcon: ShieldCheck,
    emptyTitle: "Aucun dossier à examiner",
    emptySubtitle: "Tout est à jour !",
  },
  {
    value: "expired",
    label: "Expirés",
    icon: RefreshCw,
    color: "text-purple-600",
    emptyIcon: RefreshCw,
    emptyTitle: "Aucun badge expiré",
    emptySubtitle: "Tous les badges vérifiés sont encore valides.",
  },
  {
    value: "incomplete",
    label: "Incomplets",
    icon: FileQuestion,
    color: "text-gray-500",
    emptyIcon: FileQuestion,
    emptyTitle: "Aucun dossier incomplet",
    emptySubtitle: "Tous les étudiants ont soumis leur carte.",
  },
  {
    value: "rejected",
    label: "Rejetés",
    icon: XCircle,
    color: "text-red-500",
    emptyIcon: XCircle,
    emptyTitle: "Aucun dossier rejeté",
    emptySubtitle: "",
  },
  {
    value: "verified",
    label: "Vérifiés",
    icon: ShieldCheck,
    color: "text-green-600",
    emptyIcon: ShieldCheck,
    emptyTitle: "Aucun étudiant vérifié",
    emptySubtitle: "Les validations apparaîtront ici.",
  },
  {
    value: "all",
    label: "Tous",
    icon: Users,
    color: "text-gray-600",
    emptyIcon: Users,
    emptyTitle: "Aucun profil étudiant",
    emptySubtitle: "",
  },
]

// ─── Composant principal ──────────────────────────────────────────────────────

export function VerificationsTabs({ submitted, incomplete, rejected, verified, expired, all, stats }) {
  const [activeTab, setActiveTab] = useState("submitted")

  const lists = { submitted, incomplete, rejected, verified, expired, all }
  const currentTab = TABS.find((t) => t.value === activeTab) ?? TABS[0]
  const current = lists[activeTab] ?? []

  return (
    <div className="flex flex-col gap-6">

      {/* Barre de stats contextuelles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${
          stats.waitingOver48h > 0
            ? "bg-red-50 border-red-200"
            : "bg-white border-gray-100"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            stats.waitingOver48h > 0 ? "bg-red-100" : "bg-gray-100"
          }`}>
            <Timer size={18} className={stats.waitingOver48h > 0 ? "text-red-600" : "text-gray-400"} />
          </div>
          <div>
            <p className={`text-xl font-black ${stats.waitingOver48h > 0 ? "text-red-600" : "text-gray-400"}`}>
              {stats.waitingOver48h}
            </p>
            <p className="text-xs text-gray-500 font-medium">En attente depuis +48h</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border bg-white border-gray-100 px-5 py-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xl font-black text-green-600">{stats.validatedThisMonth}</p>
            <p className="text-xs text-gray-500 font-medium">Validés ce mois</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border bg-white border-gray-100 px-5 py-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <XCircle size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-black text-amber-600">{stats.totalRejected}</p>
            <p className="text-xs text-gray-500 font-medium">Rejetés au total</p>
          </div>
        </div>
      </div>

      {/* Onglets + compteurs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Compteurs par catégorie */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
          {[
            { label: "À examiner", count: submitted.length,  color: "text-amber-600",  bg: "bg-amber-50"  },
            { label: "Incomplets", count: incomplete.length, color: "text-gray-500",   bg: "bg-gray-100"  },
            { label: "Rejetés",    count: rejected.length,   color: "text-red-600",    bg: "bg-red-50"    },
            { label: "Vérifiés",   count: verified.length,   color: "text-green-600",  bg: "bg-green-50"  },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className="px-5 py-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <span className={`text-sm font-black ${color}`}>{count}</span>
              </div>
              <p className="text-sm text-gray-500 font-medium hidden sm:block">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto">
          {TABS.map(({ value, label, icon: Icon, color }) => {
            const isActive = activeTab === value
            const count = lists[value]?.length ?? 0
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-[#1A6B4A] text-[#1A6B4A]"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.75} className={isActive ? color : ""} />
                {label}
                {count > 0 && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    isActive ? "bg-[#1A6B4A] text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grille de cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {current.length === 0 ? (
          <EmptyState
            icon={currentTab.emptyIcon}
            title={currentTab.emptyTitle}
            subtitle={currentTab.emptySubtitle}
          />
        ) : (
          current.map((profile) => (
            <VerificationCard key={profile.user_id} profile={profile} />
          ))
        )}
      </div>
    </div>
  )
}
