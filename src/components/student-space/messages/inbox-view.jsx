"use client"

// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { useUnread } from "@/components/app-shell/unread-provider"
import { StudentInboxList } from "@/components/student-space/messages/inbox-list"
import { studentConversationHref, studentMessagesHref, studentMissionsHref } from "@/lib/app/student-routes"
import { unreadTotal } from "@/lib/client-space/conversations"

const BENIN_TZ = "Africa/Porto-Novo"

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

// « Jeudi 8 octobre » au fuseau du Bénin.
function dayLabel(now) {
  const label = new Intl.DateTimeFormat("fr-FR", { timeZone: BENIN_TZ, weekday: "long", day: "numeric", month: "long" }).format(now)
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1)
}

/** Délai de regroupement des rafraîchissements : un INSERT et un UPDATE rapprochés ne coûtent qu'un seul. */
export const REFRESH_DELAY_MS = 300

/**
 * Regroupe les demandes de rafraîchissement : chaque `trigger` repousse l'appel de `refresh`.
 * @param {() => void} refresh
 * @param {number} [delay]
 */
export function createDebouncedRefresh(refresh, delay = REFRESH_DELAY_MS) {
  let timer = null
  return {
    trigger() {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        refresh()
      }, delay)
    },
    cancel() {
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
  }
}

// Rafraîchit la liste quand le compteur de non lus de la coquille change : aucun abonnement supplémentaire.
function LiveRefresh() {
  const router = useRouter()
  const unread = useUnread()
  const seen = useRef(unread)
  const scheduler = useMemo(() => createDebouncedRefresh(() => router.refresh()), [router])
  useEffect(() => {
    if (seen.current === unread) return
    seen.current = unread
    scheduler.trigger()
  }, [unread, scheduler])
  useEffect(() => scheduler.cancel, [scheduler])
  return null
}

function NoConversation() {
  return (
    <section className="card2 card2--flush" aria-label="Aucune conversation">
      <div className="empty2">
        <span className="empty2__ic">
          <Icon name="i-message" />
        </span>
        <div className="empty2__title">Pas encore de message</div>
        <div className="empty2__text">{"Vos échanges apparaîtront ici dès qu'un client vous écrit ou vous retient."}</div>
        <Link className="btn btn--dark" href={studentMissionsHref()}>
          Explorer les missions
        </Link>
      </div>
    </section>
  )
}

/**
 * Missions ouvertes depuis le dernier `result` (à lire comme lues) : vidé quand `result` change, cumulé
 * d'une conversation à l'autre sinon. Renvoie l'état reçu s'il n'y a rien à changer.
 * @param {{ result: unknown, ids: string[] }} state
 * @param {unknown} result
 * @param {string|null} openedId
 */
export function nextOpened(state, result, openedId) {
  const fresh = state.result !== result
  const ids = fresh ? [] : state.ids
  if (!fresh && (!openedId || ids.includes(openedId))) return state
  return { result, ids: openedId && !ids.includes(openedId) ? [...ids, openedId] : ids }
}

// Volet gauche réduit à un message (liste vide ou en erreur) quand une conversation est ouverte.
function ListNotice({ children }) {
  return (
    <section className="e2-06-list" aria-label="Conversations">
      <div className="e2-06-list__items">{children}</div>
    </section>
  )
}

// Volet de droite sans conversation ouverte.
function EmptyPane() {
  return (
    <div className="e2-06-pane">
      <div className="empty2">
        <span className="empty2__ic">
          <Icon name="i-message" />
        </span>
        <div className="empty2__title">Choisissez une conversation</div>
        <div className="empty2__text">{"Vos échanges avec les clients s'affichent ici, une conversation par mission."}</div>
      </div>
    </div>
  )
}

/**
 * Messages (E06, E07) : titre de page puis deux volets, la liste des conversations à gauche et `children` à droite
 * (volet vide sur /messages, où la page ne rend rien, conversation sur /messages/<mission>). Vue pure : `result` est la réponse de
 * `getStudentConversations`. La conversation ouverte est comptée comme lue sans attendre le rafraîchissement.
 * @param {{ result: { conversations?: object[], error?: string }, now?: string, children?: import("react").ReactNode }} props
 */
export function StudentInboxView({ result, now, children }) {
  const pathname = usePathname() || studentMessagesHref()
  const nowDate = useMemo(() => (now ? new Date(now) : new Date()), [now])
  const isConversation = pathname.startsWith(`${studentMessagesHref()}/`)
  const all = result?.conversations
  const hasError = Boolean(result?.error) || !all

  // Missions ouvertes depuis le dernier `result` : comptées comme lues, vidé quand `result` change.
  const openedId = (all ?? []).find((c) => pathname === studentConversationHref(c.missionId))?.missionId ?? null
  const [opened, setOpened] = useState({ result, ids: [] })
  const next = nextOpened(opened, result, openedId)
  if (next !== opened) setOpened(next)
  const ids = next.ids

  const conversations = (all ?? []).map((c) => (c.unreadCount > 0 && ids.includes(c.missionId) ? { ...c, unreadCount: 0 } : c))

  // Sur /messages : l'état d'erreur ou vide occupe la page. Sur une conversation : il reste dans le volet
  // gauche, le volet droit garde la conversation (lien « Écrire à... », 404 d'un étudiant sans conversation).
  if (!isConversation && hasError) {
    return (
      <>
        <PageHead title="Messages" />
        <section className="card2 card2--flush" aria-label="Erreur de chargement">
          <ErrorState
            compact
            title="Impossible d'afficher vos messages"
            text={result?.error ?? "Le chargement a échoué. Vos messages ne sont pas touchés."}
          />
        </section>
      </>
    )
  }

  if (!isConversation && conversations.length === 0) {
    return (
      <>
        <LiveRefresh />
        <PageHead date="Aucun message" title="Messages" />
        <NoConversation />
      </>
    )
  }

  const unreadCount = unreadTotal(conversations)
  const unreadLabel = unreadCount > 0 ? plural(unreadCount, "non lu", "non lus") : "Tout est lu"
  const dateLabel = hasError ? "Messages indisponibles" : conversations.length === 0 ? "Aucun message" : unreadLabel

  return (
    <>
      <LiveRefresh />
      <PageHead
        date={
          <>
            <span className="e2-06-day">{dayLabel(nowDate)} · </span>
            {dateLabel}
          </>
        }
        title="Messages"
      />
      <div className="e2-06-inbox" data-view={isConversation ? "conversation" : "list"}>
        {hasError ? (
          <ListNotice>
            <ErrorState
              compact
              title="Impossible d'afficher vos messages"
              text={result?.error ?? "Le chargement a échoué. Vos messages ne sont pas touchés."}
            />
          </ListNotice>
        ) : conversations.length === 0 ? (
          <ListNotice>
            <EmptyState
              compact
              icon="i-message"
              title="Pas encore de message"
              text="Vos échanges apparaîtront ici."
              action={{ label: "Explorer les missions", href: studentMissionsHref() }}
            />
          </ListNotice>
        ) : (
          <StudentInboxList conversations={conversations} now={nowDate} />
        )}
        {isConversation ? children : <EmptyPane />}
      </div>
    </>
  )
}

export default StudentInboxView
