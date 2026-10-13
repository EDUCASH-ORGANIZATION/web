"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef } from "react"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { Avatar } from "@/components/app-ui/avatar"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { SkeletonRows } from "@/components/app-ui/skeletons"
import { useUnread } from "@/components/app-shell/unread-provider"
import { SEARCH_MAX_LENGTH } from "@/lib/constants/missions"
import { clientConversationHref, clientMissionsHref, clientPublishHref } from "@/lib/app/client-routes"
import { filterConversations, formatListTime, unreadTotal } from "@/lib/client-space/conversations"

const INBOX_PATH = "/client/messages"
const UNREAD_PARAM = "non-lues"

const cx = (...parts) => parts.filter(Boolean).join(" ")
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

// Adresse de la boîte de réception avec recherche et filtre (paramètres vides omis).
export function inboxHref({ q, unreadOnly } = {}) {
  const query = new URLSearchParams()
  if (q) query.set("q", q)
  if (unreadOnly) query.set("filtre", UNREAD_PARAM)
  const qs = query.toString()
  return qs ? `${INBOX_PATH}?${qs}` : INBOX_PATH
}

// Mission en sous-titre, avec la relation avec l'étudiant.
export function subtitleOf(conversation) {
  const title = conversation.missionTitle || "Mission"
  switch (conversation.state) {
    case "candidate":
      return `Candidat · ${title}`
    case "in_progress":
      return `${title} · en cours`
    case "done":
      return `${title} · terminée`
    case "cancelled":
      return `${title} · annulée`
    case "rejected":
      return `Candidature refusée · ${title}`
    default:
      return title
  }
}

// Rafraîchit la liste quand le compteur de non lus de la coquille change : aucun abonnement supplémentaire.
function LiveRefresh() {
  const router = useRouter()
  const unread = useUnread()
  const seen = useRef(unread)
  useEffect(() => {
    if (seen.current === unread) return
    seen.current = unread
    router.refresh()
  }, [unread, router])
  return null
}

function ConversationRow({ conversation, now }) {
  const unread = conversation.unreadCount > 0
  return (
    <li>
      <Link className={cx("convo", unread && "is-unread")} href={clientConversationHref(conversation.missionId, conversation.studentId)}>
        <Avatar name={conversation.name} src={conversation.avatarUrl} />
        <div className="convo__body">
          <div className="convo__name">{conversation.name}</div>
          <div className="convo__mission">{subtitleOf(conversation)}</div>
          <div className="convo__preview">{conversation.preview}</div>
        </div>
        <div className="convo__side">
          {formatListTime(conversation.lastAt, now)}
          {unread ? (
            <span className="count">
              {conversation.unreadCount}
              <span className="sr-only">{conversation.unreadCount > 1 ? " messages non lus" : " message non lu"}</span>
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  )
}

function NoConversation() {
  return (
    <section className="card2 card2--flush inbox-empty2" aria-label="Aucune conversation">
      <div className="empty2">
        <span className="empty2__ic">
          <Icon name="i-message" />
        </span>
        <div className="empty2__title">Aucune conversation</div>
        <div className="empty2__text">
          Lancez une discussion depuis une candidature : ouvrez une de vos missions, puis écrivez à un candidat.
        </div>
        <div className="actions2">
          <Link className="btn btn--primary" href={clientMissionsHref()}>
            Voir mes missions
          </Link>
          <Link className="link2" href={clientPublishHref()}>
            Publier une mission
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * Boîte de réception (C12) : une carte de conversations, une par (mission, étudiant), avec recherche
 * et filtre « Non lues » portés par l'adresse (aucun état local).
 * @param {{ result: { conversations?: object[], error?: string }, q?: string, unreadOnly?: boolean, now?: string }} props
 */
export function InboxView({ result, q = "", unreadOnly = false, now }) {
  const nowDate = useMemo(() => (now ? new Date(now) : new Date()), [now])
  const all = result?.conversations ?? []
  const unreadCount = unreadTotal(all)
  const shown = filterConversations(all, { q, unreadOnly })
  const summary =
    all.length === 0
      ? "Aucune conversation"
      : `${plural(all.length, "conversation", "conversations")} · ${plural(unreadCount, "non lue", "non lues")}`

  if (result?.error || !result?.conversations) {
    return (
      <>
        <PageHead title="Messages" />
        <section className="card2 card2--flush" aria-label="Erreur de chargement">
          <ErrorState compact title="Impossible d'afficher vos messages" text={result?.error ?? "Le chargement a échoué. Veuillez réessayer."} />
        </section>
      </>
    )
  }

  return (
    <>
      <LiveRefresh />
      <PageHead date={summary} title="Messages" />
      {all.length === 0 ? (
        <NoConversation />
      ) : (
        <>
          <div className="inbox-tools2">
            <form role="search" method="get" action={INBOX_PATH}>
              {unreadOnly ? <input type="hidden" name="filtre" value={UNREAD_PARAM} /> : null}
              <label className="search">
                <Icon name="i-search" />
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  maxLength={SEARCH_MAX_LENGTH}
                  placeholder="Rechercher un étudiant, une mission"
                  aria-label="Rechercher dans les messages"
                  autoComplete="off"
                />
              </label>
            </form>
            <nav className="segmented segmented--block" aria-label="Filtrer les conversations">
              <Link className={cx("segmented__item", !unreadOnly && "is-active")} href={inboxHref({ q })} aria-current={unreadOnly ? undefined : "page"}>
                Toutes
              </Link>
              <Link className={cx("segmented__item", unreadOnly && "is-active")} href={inboxHref({ q, unreadOnly: true })} aria-current={unreadOnly ? "page" : undefined}>
                {unreadCount > 0 ? `Non lues (${unreadCount})` : "Non lues"}
              </Link>
            </nav>
          </div>
          {shown.length === 0 ? (
            <section className="card2 card2--flush" aria-label="Aucun résultat">
              {q ? (
                <EmptyState
                  compact
                  icon="i-search"
                  title={`Aucune conversation pour « ${q} »`}
                  text="Essayez un autre mot."
                  action={{ label: "Effacer la recherche", href: inboxHref({ unreadOnly }) }}
                />
              ) : (
                <EmptyState
                  compact
                  icon="i-check-circle"
                  title="Aucun message non lu"
                  text="Vous avez lu tous vos messages."
                  action={{ label: "Voir toutes les conversations", href: inboxHref({ q }) }}
                />
              )}
            </section>
          ) : (
            <ul className="convos2 inbox-list2" aria-label="Conversations">
              {shown.map((conversation) => (
                <ConversationRow key={conversation.key} conversation={conversation} now={nowDate} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

export function InboxSkeleton() {
  return (
    <>
      <PageHead title="Messages" />
      <SkeletonRows count={5} />
    </>
  )
}

export default InboxView
