"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Star, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { verifyStudent, rejectStudent } from "@/lib/actions/admin.actions"
import { useToast } from "@/components/shared/toaster"

const TABS = [
  { value: "pending",  label: "En attente" },
  { value: "verified", label: "Vérifiés" },
  { value: "all",      label: "Tous" },
]

// ─── Modal de rejet ───────────────────────────────────────────────────────────

function RejectModal({ userId, name, onClose }) {
  const [reason, setReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  async function handleReject() {
    if (!reason.trim()) return
    setIsLoading(true)
    const result = await rejectStudent(userId, reason.trim())
    setIsLoading(false)
    if (result.error) {
      toast({ message: result.error, type: "error" })
    } else {
      toast({ message: `Dossier de ${name} rejeté.`, type: "success" })
      onClose()
      router.refresh()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <h3 className="text-base font-semibold text-gray-900">Rejeter le dossier de {name}</h3>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Motif du rejet</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : Carte étudiante illisible, établissement non reconnu..."
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={isLoading || !reason.trim()}
            className="flex-1 h-9 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Rejeter
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card vérification ────────────────────────────────────────────────────────

function VerificationCard({ profile }) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const initial = profile.full_name?.charAt(0)?.toUpperCase() ?? "?"
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(profile.created_at))

  async function handleVerify() {
    setIsVerifying(true)
    const result = await verifyStudent(profile.user_id)
    setIsVerifying(false)
    if (result.error) {
      toast({ message: result.error, type: "error" })
    } else {
      toast({ message: `${profile.full_name} vérifié(e) avec succès.`, type: "success" })
      router.refresh()
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <Image src={profile.avatar_url} alt={profile.full_name} fill sizes="44px" className="object-cover" />
            ) : (
              <span className="text-white font-bold">{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{profile.full_name}</p>
            <p className="text-xs text-gray-400">
              {profile.student_profiles?.school ?? "—"} · Inscrit le {date}
            </p>
          </div>
          {profile.is_verified && (
            <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">
              Vérifié ✓
            </span>
          )}
        </div>

        {/* Carte étudiante */}
        {profile.card_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <div className="relative rounded-lg w-full h-40 border border-gray-100 overflow-hidden">
            <Image
              src={profile.card_signed_url}
              alt="Carte étudiante"
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="rounded-lg w-full h-40 bg-gray-100 flex items-center justify-center">
            <p className="text-sm text-gray-400">Aucune carte fournie</p>
          </div>
        )}

        {/* Actions — uniquement si non encore vérifié */}
        {!profile.is_verified && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying}
              className="flex-1 h-9 rounded-lg bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 touch-manipulation"
            >
              {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Valider ✓
            </button>
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              className="flex-1 h-9 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 touch-manipulation"
            >
              <XCircle size={14} />
              Rejeter ✗
            </button>
          </div>
        )}
      </div>

      {showRejectModal && (
        <RejectModal
          userId={profile.user_id}
          name={profile.full_name}
          onClose={() => setShowRejectModal(false)}
        />
      )}
    </>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * @param {{
 *   pending: object[],
 *   verified: object[],
 *   all: object[],
 * }} props
 */
export function VerificationsTabs({ pending, verified, all }) {
  const [activeTab, setActiveTab] = useState("pending")

  const lists = { pending, verified, all }
  const current = lists[activeTab] ?? []

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {TABS.map(({ value, label }) => {
          const count = lists[value]?.length ?? 0
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={[
                "px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5",
                activeTab === value
                  ? "border-b-2 border-[#1A6B4A] text-[#1A6B4A]"
                  : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent",
              ].join(" ")}
            >
              {label}
              {value === "pending" && count > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Grille de cards */}
      {current.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-gray-400">Aucun profil dans cette catégorie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {current.map((profile) => (
            <VerificationCard key={profile.user_id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  )
}
