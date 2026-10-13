// @ds-screen RD-CLIENT-01
import { getPublishPage } from "@/lib/actions/client-publish.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { todayInBenin } from "@/lib/app/format"
import { clientPublishHref } from "@/lib/app/client-routes"
import { parsePublishPrefill } from "@/lib/utils/publish-prefill"
import { initialValues, parseDuplicateId } from "@/lib/client-space/publish-schema"
import { PublishPausedView } from "@/components/client-space/publish/publish-paused-view"
import { PublishWizard } from "@/components/client-space/publish/publish-wizard"

export const metadata = { title: "Publier une mission - EduCash" }

// Page mince : le drapeau des paiements est lu ici, côté serveur, et décide de la vue. Paiements coupés :
// l'écran « Publication en cours d'activation », sans aucune lecture de données. Paiements ouverts : l'assistant,
// avec le solde disponible (information) et la mission à dupliquer si elle appartient au client.
// Le préremplissage vient de l'URL (`besoin`, `ville`, `type`, `duplicate`) : chaque valeur est validée ici,
// l'inconnu est ignoré. Le layout garde la route ; chaque action revérifie le rôle client.
export default async function NewMissionPage({ searchParams }) {
  const params = (await searchParams) ?? {}
  const prefill = parsePublishPrefill(params)
  const duplicateId = parseDuplicateId(params.duplicate)

  if (!paymentsEnabled()) {
    const hasPrefill = Boolean(prefill.title || prefill.city || prefill.type)
    const resumeHref =
      hasPrefill || duplicateId
        ? clientPublishHref({ duplicate: duplicateId, besoin: prefill.title, ville: prefill.city, type: prefill.type })
        : undefined
    return <PublishPausedView resumeHref={resumeHref} />
  }

  const result = await getPublishPage({ duplicate: duplicateId })
  const duplicate = result.data?.duplicate ?? null
  const initial = initialValues(prefill, duplicate)
  // La clé relance l'état de l'assistant quand le lien de reprise ou une duplication change l'URL.
  const key = [duplicate ? duplicateId : "", initial.title, initial.city, initial.type].join("|")
  return (
    <PublishWizard
      key={key}
      initial={initial}
      duplicateId={duplicate ? duplicateId : ""}
      available={result.data?.available ?? null}
      today={todayInBenin()}
      error={result.error}
    />
  )
}
