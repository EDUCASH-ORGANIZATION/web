"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import * as AlertDialog from "@radix-ui/react-alert-dialog"
import { Star, Loader2, CheckCircle } from "lucide-react"
import clsx from "clsx"
import { acceptApplication, rejectApplication } from "@/lib/actions/application.actions"
import { useToast } from "@/components/shared/toaster"

// ─── Étoiles de rating ───────────────────────────────────────────────────────

function StarRating({ rating = 0 }) {
  const rounded = Math.round(rating)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={i < rounded ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}
        />
      ))}
      {rating > 0 && (
        <span className="text-xs text-gray-400 ml-1">{rating.toFixed(1)}</span>
      )}
    </div>
  )
}

// ─── Bouton Accepter avec confirmation AlertDialog ────────────────────────────

function AcceptButton({ applicationId, studentId, missionId, onAccepted }) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleConfirm() {
    setIsLoading(true)
    const result = await acceptApplication({ applicationId, studentId, missionId })
    setIsLoading(false)

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
          className="px-3 py-1.5 rounded-lg bg-[#1A6B4A] text-white text-xs font-semibold hover:bg-[#155a3d] active:bg-[#104530] transition-colors touch-manipulation"
        >
          Accepter
        </button>
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <AlertDialog.Title className="text-base font-bold text-gray-900 mb-2">
            Accepter cette candidature ?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-500 mb-6">
            Les autres candidatures seront automatiquement refusées et la mission passera en statut "En cours".
          </AlertDialog.Description>

          <div className="flex gap-3">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                disabled={isLoading}
                className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 touch-manipulation"
              >
                Annuler
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 h-9 rounded-lg bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 touch-manipulation"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              Confirmer
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

// ─── Bouton Refuser ───────────────────────────────────────────────────────────

function RejectButton({ applicationId, onRejected }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  async function handleReject() {
    setIsLoading(true)
    const result = await rejectApplication(applicationId)
    setIsLoading(false)

    if (result.error) {
      toast({ message: result.error, type: "error" })
      return
    }

    toast({ message: "Candidature refusée.", type: "info" })
    onRejected(applicationId)
  }

  return (
    <button
      type="button"
      onClick={handleReject}
      disabled={isLoading}
      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-50 touch-manipulation"
    >
      {isLoading ? <Loader2 size={12} className="animate-spin inline" /> : "Refuser"}
    </button>
  )
}

// ─── StudentCard ─────────────────────────────────────────────────────────────

/**
 * @param {{
 *   application: object,
 *   missionId: string,
 *   onStatusChange: (applicationId: string, status: string) => void
 * }} props
 */
export function StudentCard({ application, missionId, onStatusChange }) {
  const profile       = application.profiles ?? {}
  const studentProfile = application.student_profiles ?? {}
  const initial       = profile.full_name?.charAt(0)?.toUpperCase() ?? "?"
  const skills        = (studentProfile.skills ?? []).slice(0, 3)
  const messagePreview = application.message ?? ""

  const isAccepted = application.status === "accepted"
  const isRejected = application.status === "rejected"

  return (
    <div className={clsx(
      "bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-3 transition-opacity",
      isRejected ? "opacity-50 border-gray-100" : "border-gray-100"
    )}>
      {/* Avatar + identité + rating */}
      <div className="flex items-start gap-3">
        <div className="relative w-11 h-11 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <Image src={profile.avatar_url} alt={profile.full_name} fill className="object-cover" />
          ) : (
            <span className="text-white text-base font-bold">{initial}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{profile.full_name ?? "Étudiant"}</p>
          {studentProfile.school && (
            <p className="text-xs text-gray-500 truncate">{studentProfile.school}</p>
          )}
          <div className="mt-1">
            <StarRating rating={profile.rating ?? 0} />
          </div>
        </div>
        {/* Badge missions faites */}
        {(profile.missions_done ?? 0) > 0 && (
          <span className="shrink-0 text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {profile.missions_done} mission{profile.missions_done > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span key={skill} className="px-2 py-0.5 rounded-full bg-[#f0faf5] text-[#1A6B4A] text-[11px] font-medium">
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Message de motivation */}
      {messagePreview && (
        <p className="text-sm text-gray-500 italic line-clamp-2 leading-relaxed border-l-2 border-gray-100 pl-3">
          &ldquo;{messagePreview}&rdquo;
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <a
          href={`/student-profile/${application.student_id}`}
          className="text-xs text-[#1A6B4A] hover:underline font-medium"
        >
          Voir le profil →
        </a>

        {isAccepted ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
            <CheckCircle size={12} />
            Accepté ✓
          </span>
        ) : isRejected ? (
          <span className="text-xs text-gray-400 italic">Refusé</span>
        ) : (
          <div className="flex items-center gap-2">
            <RejectButton
              applicationId={application.id}
              onRejected={(id) => onStatusChange(id, "rejected")}
            />
            <AcceptButton
              applicationId={application.id}
              studentId={application.student_id}
              missionId={missionId}
              onAccepted={(id) => onStatusChange(id, "accepted")}
            />
          </div>
        )}
      </div>
    </div>
  )
}
