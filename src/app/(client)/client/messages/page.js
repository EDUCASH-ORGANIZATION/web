// @ds-screen RD-CLIENT-01
import { Suspense } from "react"
import { getClientConversations } from "@/lib/actions/message.actions"
import { InboxView, InboxSkeleton } from "@/components/client-space/messages/inbox-view"
import { SEARCH_MAX_LENGTH } from "@/lib/constants/missions"

export const metadata = { title: "Messages - EduCash" }

const UNREAD_FILTER = "non-lues"

function firstText(value) {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === "string" ? first : ""
}

// Recherche : texte seul, sans caractère de contrôle, bornée (découpe par point de code).
function normalizeSearch(raw) {
  return Array.from(raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim()).slice(0, SEARCH_MAX_LENGTH).join("")
}

// Pas de loading.js ici : ce segment est le parent de [missionId], qui appelle notFound() (le 404 deviendrait un 200).
// L'attente est portée par ce <Suspense>.
async function InboxContent({ q, unreadOnly }) {
  const result = await getClientConversations()
  return <InboxView result={result} q={q} unreadOnly={unreadOnly} now={new Date().toISOString()} />
}

export default async function ClientMessagesPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  const q = normalizeSearch(firstText(sp.q))
  const unreadOnly = firstText(sp.filtre) === UNREAD_FILTER
  return (
    <Suspense key={`${q}|${unreadOnly}`} fallback={<InboxSkeleton />}>
      <InboxContent q={q} unreadOnly={unreadOnly} />
    </Suspense>
  )
}
