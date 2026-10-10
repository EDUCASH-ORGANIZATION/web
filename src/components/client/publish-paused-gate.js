import { Clock, ShieldCheck } from "lucide-react"
import { ResumePublishLink } from "@/components/client/resume-publish-link"
import { PublishNotifyForm } from "@/components/vitrine/publish/publish-notify-form"
import { PAYMENTS_PENDING_COPY } from "@/lib/constants/payments"

const COPY = PAYMENTS_PENDING_COPY.publish

// Remplace la publication d'une mission (espace client, vouvoiement) tant que les paiements sont coupés.
// Le lien de reprise est gardé pour le jour de la réouverture.
export function PublishPausedGate({ resumeHref }) {
  return (
    <div className="max-w-md mx-auto py-16 px-4 flex flex-col items-center text-center gap-6">
      {resumeHref && <ResumePublishLink mode="store" href={resumeHref} />}

      <div className="w-20 h-20 rounded-2xl bg-[#f0faf5] border border-green-100 flex items-center justify-center">
        <Clock size={40} className="text-[#1A6B4A]" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-black text-gray-900 leading-snug">{COPY.title}</h1>
        <p className="text-sm text-gray-500 leading-relaxed">{COPY.lead}</p>
      </div>

      <PublishNotifyForm variant="app" idPrefix="gate-notify" />

      <div className="w-full flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-left">
        <ShieldCheck size={16} className="text-[#1A6B4A] shrink-0 mt-0.5" />
        <p className="text-xs text-green-800 leading-relaxed">
          <strong>Séquestre sécurisé :</strong>{" "}
          à l&apos;ouverture, vos fonds sont bloqués à la publication
          et libérés uniquement quand vous confirmez que la mission est terminée.
          Si la mission est annulée, vous êtes intégralement remboursé.
        </p>
      </div>
    </div>
  )
}
