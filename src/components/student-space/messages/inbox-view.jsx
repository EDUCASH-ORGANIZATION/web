"use client"

// @ds-screen RD-STUDENT-01
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
import { studentConversationHref, studentMessagesHref, studentMissionsHref } from "@/lib/app/student-routes"
import { filterConversations, formatListTime, unreadTotal } from "@/lib/client-space/conversations"

const UNREAD_PARAM = "non-lues"

const cx = (...parts) => parts.filter(Boolean).join(" ")
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

// Adresse de la boîte de réception avec recherche et filtre (paramètres vides omis).
export function inboxHref({ q, unreadOnly } = {}) {
  const query = new URLSearchParams()
  if (q) query.set("q", q)
  if (unreadOnly) query.set("filtre", UNREAD_PARAM)
  const qs = query.toString()
  return qs ? `${studentMessagesHref()}?${qs}` : studentMessagesHref()
}

// Mission en petit sous le dernier message, avec la relation de l'étudiant à cette mission.
export function subtitleOf(conversation) {
  const title = conversation.missionTitle || "Mission"
  switch (conversation.state) {
    case "candidate":
      return `${title} · candidature`
    case "in_progress":
      return `${title} · en cours`
    case "done":
      return `${title} · terminée`
    case "cancelled":
      return `${title} · annulée`
    case "rejected":
      return `${title} · non retenue`
    default:
      return `${title} · attribuée`
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
      <Link className={cx("e2-06-convo", unread && "is-unread")} href={studentConversationHref(conversation.missionId)}>
        <Avatar name={conversation.name} src={conversation.avatarUrl} />
        <div>
          <div className="e2-06-convo__name">{conversation.name}</div>
          <div className="e2-06-convo__preview">{conversation.preview}</div>
          <div className="e2-06-convo__mission">{subtitleOf(conversation)}</div>
        </div>
        <span className="e2-06-convo__side">
          {formatListTime(conversation.lastAt, now)}
          {unread ? (
            <span className="e2-06-count">
              {conversation.unreadCount}
              <span className="sr-only">{conversation.unreadCount > 1 ? " messages non lus" : " message non lu"}</span>
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  )
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

// Aucun résultat : recherche sans réponse, ou aucun message non lu.
function NoResult({ q, unreadOnly }) {
  if (q) {
    return (
      <EmptyState
        compact
        icon="i-search"
        title={`Aucune conversation pour « ${q} »`}
        text="Essayez un autre mot."
        action={{ label: "Effacer la recherche", href: inboxHref({ unreadOnly }) }}
      />
    )
  }
  return (
    <EmptyState
      compact
      icon="i-check-circle"
      title="Aucun message non lu"
      text="Vous avez lu tous vos messages."
      action={{ label: "Voir toutes les conversations", href: inboxHref({ q }) }}
    />
  )
}

/**
 * Messages (E06) : une ligne par personne, la mission en petit. Recherche et filtre « Non lues » portés par
 * l'adresse (aucun état local). Vue pure : `result` est la réponse de `getStudentConversations`.
 * @param {{ result: { conversations?: object[], error?: string }, q?: string, unreadOnly?: boolean, now?: string }} props
 */
export function StudentInboxView({ result, q = "", unreadOnly = false, now }) {
  const nowDate = useMemo(() => (now ? new Date(now) : new Date()), [now])
  const all = result?.conversations ?? []
  const unreadCount = unreadTotal(all)
  const shown = filterConversations(all, { q, unreadOnly })
  const unreadLabel = unreadCount > 0 ? plural(unreadCount, "non lu", "non lus") : "Tout est lu"

  if (result?.error || !result?.conversations) {
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

  if (all.length === 0) {
    return (
      <>
        <LiveRefresh />
        <PageHead date="Aucun message" title="Messages" />
        <NoConversation />
      </>
    )
  }

  return (
    <>
      <LiveRefresh />
      <PageHead date={unreadLabel} title="Messages" />
      <div className="e2-06-inbox">
        <section className="e2-06-list" aria-label="Conversations">
          <div className="e2-06-list__head">
            <div className="e2-06-list__title">
              Conversations<span>{unreadLabel}</span>
            </div>
            <form role="search" method="get" action={studentMessagesHref()}>
              {unreadOnly ? <input type="hidden" name="filtre" value={UNREAD_PARAM} /> : null}
              <label className="search2 e2-06-search">
                <Icon name="i-search" />
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  maxLength={SEARCH_MAX_LENGTH}
                  placeholder="Rechercher une personne ou une mission"
                  aria-label="Rechercher dans les messages"
                  autoComplete="off"
                />
              </label>
            </form>
            <nav className="e2-pills" aria-label="Filtrer les conversations">
              <Link
                className={cx("e2-pill", !unreadOnly && "is-active")}
                href={inboxHref({ q })}
                aria-current={unreadOnly ? undefined : "page"}
              >
                Toutes
              </Link>
              <Link
                className={cx("e2-pill", unreadOnly && "is-active")}
                href={inboxHref({ q, unreadOnly: true })}
                aria-current={unreadOnly ? "page" : undefined}
              >
                Non lues
                {unreadCount > 0 ? <b>{unreadCount}</b> : null}
              </Link>
            </nav>
          </div>
          {shown.length === 0 ? (
            <div className="e2-06-list__items">
              <NoResult q={q} unreadOnly={unreadOnly} />
            </div>
          ) : (
            <ul className="e2-06-list__items" aria-label="Conversations">
              {shown.map((conversation) => (
                <ConversationRow key={conversation.key} conversation={conversation} now={nowDate} />
              ))}
            </ul>
          )}
        </section>
        <div className="e2-06-pane">
          <div className="empty2">
            <span className="empty2__ic">
              <Icon name="i-message" />
            </span>
            <div className="empty2__title">Choisissez une conversation</div>
            <div className="empty2__text">{"Vos échanges avec les clients s'affichent ici, une conversation par mission."}</div>
          </div>
        </div>
      </div>
    </>
  )
}

/** Squelette de la page : titre et lignes (attente par Suspense, jamais de loading.js sous messages/). */
export function InboxSkeleton() {
  return (
    <>
      <PageHead title="Messages" />
      <SkeletonRows count={5} />
    </>
  )
}

export default StudentInboxView
