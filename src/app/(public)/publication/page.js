import { redirect } from "next/navigation"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { PublishPaused } from "@/components/vitrine/publish/publish-paused"
import { paymentsEnabled } from "@/lib/constants/payments"
import { parsePublishPrefill, publishHref } from "@/lib/utils/publish-prefill"

export const metadata = {
  title: "Publication en cours d'activation",
  description:
    "La publication de missions ouvre dès que le paiement est activé. Laissez votre email pour être prévenu.",
  robots: { index: false },
  openGraph: { url: "/publication" },
}

// Paiements ouverts : cet écran n'a plus lieu d'être, on rejoint la publication (pré-remplissage conservé).
export default async function PublicationPage({ searchParams }) {
  const initial = parsePublishPrefill(await searchParams)
  if (paymentsEnabled()) {
    redirect(publishHref({ besoin: initial.title, ville: initial.city, type: initial.type }))
  }

  return (
    <VitrinePage>
      <PublishPaused />
    </VitrinePage>
  )
}
