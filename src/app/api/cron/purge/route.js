import { createHash, timingSafeEqual } from "crypto"
import {
  TIME_BUDGET_MS,
  addCount,
  addStop,
  emptySummary,
  massAllowed,
  resolvePurgeMode,
  summaryHasNoIdentifiers,
} from "@/lib/purge/purge-rules"
import { purgeClosedReports, purgeContactEvents } from "@/lib/actions/purge-rows"
import { purgeAvatars, purgeMessageMedia, purgeProofFiles, purgeStudentCards } from "@/lib/actions/purge-files"
import { pseudonymizeClosedAccounts } from "@/lib/actions/account-closure-pseudonymize"
import { createServiceClient } from "@/lib/supabase/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Purge quotidienne (RD-PURGE-01), appelée par Vercel Cron. Seul GET est exporté : les autres méthodes reçoivent 405.
// Variables d'environnement : CRON_SECRET (obligatoire), PURGE_ENABLED ("true" pour supprimer réellement).

const NO_STORE = { "Cache-Control": "no-store" }

function json(body, status) {
  return Response.json(body, { status, headers: NO_STORE })
}

// Comparaison en temps constant : les deux valeurs sont condensées (longueur fixe) avant timingSafeEqual.
function sameSecret(received, expected) {
  const a = createHash("sha256").update(received).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

/** Cumule dans le résumé le résultat `{ categories, stops }` renvoyé par les purges de fichiers. */
function mergeFileResult(summary, result) {
  const names = Object.keys(result?.categories ?? {})
  for (const name of names) {
    for (const [field, n] of Object.entries(result.categories[name])) addCount(summary, name, field, n)
  }
  for (const reason of result?.stops ?? []) addStop(summary, names[0], reason)
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return json({ error: "Service indisponible" }, 503)

  const header = request.headers.get("authorization") ?? ""
  if (!sameSecret(header, `Bearer ${secret}`)) return json({ error: "Non autorisé" }, 401)

  const started = Date.now()
  const deadline = started + TIME_BUDGET_MS
  try {
    const mode = resolvePurgeMode({ env: process.env, searchParams: new URL(request.url).searchParams })
    const allowMass = massAllowed(process.env)
    const summary = emptySummary(mode)
    // Client service role créé seulement après la validation du secret.
    const service = createServiceClient()
    const common = { now: new Date(), mode, deadline }

    const steps = [
      { category: "contact_events", run: () => purgeContactEvents(service, { ...common, summary }) },
      { category: "closed_reports", run: () => purgeClosedReports(service, { ...common, summary }) },
      {
        category: "closed_accounts",
        run: async () => mergeFileResult(summary, await pseudonymizeClosedAccounts(service, { ...common, allowMass })),
      },
      {
        category: "proof_orphans",
        run: async () => mergeFileResult(summary, await purgeProofFiles(service, { ...common, allowMass })),
      },
      {
        category: "message_media",
        run: async () => mergeFileResult(summary, await purgeMessageMedia(service, { ...common, allowMass })),
      },
      { category: "avatars", run: async () => mergeFileResult(summary, await purgeAvatars(service, { ...common, allowMass })) },
      {
        category: "student_cards",
        run: async () => mergeFileResult(summary, await purgeStudentCards(service, { ...common, allowMass })),
      },
    ]

    for (const step of steps) {
      try {
        await step.run()
      } catch {
        // Une catégorie en échec n'empêche pas les suivantes ; seul le compteur est conservé.
        addCount(summary, step.category, "erreurs", 1)
        addStop(summary, step.category, "error")
      }
    }

    summary.duree_ms = Date.now() - started
    if (!summaryHasNoIdentifiers(summary)) {
      console.error("[purge] summary rejected")
      return json({ error: "Erreur interne" }, 500)
    }
    console.log("[purge]", JSON.stringify(summary))
    return json(summary, 200)
  } catch {
    console.error("[purge] failed")
    return json({ error: "Erreur interne" }, 500)
  }
}
