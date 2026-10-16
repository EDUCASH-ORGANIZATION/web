"use client"

// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { EmptyState } from "@/components/app-ui/empty-state"
import { SEARCH_MAX_LENGTH } from "@/lib/constants/missions"
import { studentConversationHref, studentMessagesHref } from "@/lib/app/student-routes"
import { filterConversations, formatListTime, unreadTotal } from "@/lib/client-space/conversations"

const UNREAD_PARAM = "non-lues"
const IN_PROGRESS_PARAM = "en-cours"

const cx = (...parts) => parts.filter(Boolean).join(" ")
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

// Recherche : texte seul, sans caractère de contrôle, bornée (découpe par point de code).
function normalizeSearch(raw) {
  return Array.from((raw ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim()).slice(0, SEARCH_MAX_LENGTH).join("")
}

/**
 * Adresse d'une liste filtrée (paramètres vides omis). `base` est le chemin courant : la recherche et les
 * filtres gardent la conversation ouverte.
 * @param {{ q?: string, unreadOnly?: boolean, inProgressOnly?: boolean, base?: string }} [options]
 */
export function inboxHref({ q, unreadOnly, inProgressOnly, base = studentMessagesHref() } = {}) {
  const query = new URLSearchParams()
  if (q) query.set("q", q)
  if (unreadOnly) query.set("filtre", UNREAD_PARAM)
  else if (inProgressOnly) query.set("filtre", IN_PROGRESS_PARAM)
  const qs = query.toString()
  return qs ? `${base}?${qs}` : base
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

function ConversationRow({ conversation, now, active, query }) {
  const unread = conversation.unreadCount > 0
  const href = inboxHref({ ...query, base: studentConversationHref(conversation.missionId) })
  return (
    <li>
      <Link
        className={cx("e2-06-convo", unread && "is-unread", active && "is-active")}
        href={href}
        aria-current={active ? "true" : undefined}
      >
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

// Aucun résultat : recherche sans réponse, aucun message non lu ou aucune conversation en cours.
function NoResult({ q, unreadOnly, inProgressOnly, base }) {
  if (q) {
    return (
      <EmptyState
        compact
        icon="i-search"
        title={`Aucune conversation pour « ${q} »`}
        text="Essayez un autre mot."
        action={{ label: "Effacer la recherche", href: inboxHref({ unreadOnly, inProgressOnly, base }) }}
      />
    )
  }
  if (inProgressOnly) {
    return (
      <EmptyState
        compact
        icon="i-message"
        title="Aucune conversation en cours"
        text="Les échanges des missions en cours apparaîtront ici."
        action={{ label: "Voir toutes les conversations", href: inboxHref({ base }) }}
      />
    )
  }
  return (
    <EmptyState
      compact
      icon="i-check-circle"
      title="Aucun message non lu"
      text="Vous avez lu tous vos messages."
      action={{ label: "Voir toutes les conversations", href: inboxHref({ base }) }}
    />
  )
}

/**
 * Volet gauche de la messagerie : recherche, filtres (Toutes, Non lues, En cours) et lignes. La recherche et le
 * filtre sont lus dans l'adresse ; la ligne de la conversation ouverte est repérée par le chemin.
 * @param {{ conversations: object[], now: Date }} props conversations déjà lues (toutes, non filtrées)
 */
export function StudentInboxList({ conversations, now }) {
  const pathname = usePathname() || studentMessagesHref()
  const params = useSearchParams()
  const q = normalizeSearch(params?.get("q"))
  const filter = params?.get("filtre")
  const unreadOnly = filter === UNREAD_PARAM
  const inProgressOnly = filter === IN_PROGRESS_PARAM
  const unreadCount = unreadTotal(conversations)
  const shown = filterConversations(conversations, { q, unreadOnly, inProgressOnly })
  const unreadLabel = unreadCount > 0 ? plural(unreadCount, "non lu", "non lus") : "Tout est lu"
  const query = { q, unreadOnly, inProgressOnly }

  return (
    <section className="e2-06-list" aria-label="Conversations">
      <div className="e2-06-list__head">
        <div className="e2-06-list__title">
          Conversations<span>{unreadLabel}</span>
        </div>
        <form role="search" method="get" action={pathname}>
          {filter === UNREAD_PARAM || filter === IN_PROGRESS_PARAM ? <input type="hidden" name="filtre" value={filter} /> : null}
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
            className={cx("e2-pill", !unreadOnly && !inProgressOnly && "is-active")}
            href={inboxHref({ q, base: pathname })}
            aria-current={unreadOnly || inProgressOnly ? undefined : "page"}
          >
            Toutes
          </Link>
          <Link
            className={cx("e2-pill", unreadOnly && "is-active")}
            href={inboxHref({ q, unreadOnly: true, base: pathname })}
            aria-current={unreadOnly ? "page" : undefined}
          >
            Non lues
            {unreadCount > 0 ? <b>{unreadCount}</b> : null}
          </Link>
          <Link
            className={cx("e2-pill", inProgressOnly && "is-active")}
            href={inboxHref({ q, inProgressOnly: true, base: pathname })}
            aria-current={inProgressOnly ? "page" : undefined}
          >
            En cours
          </Link>
        </nav>
      </div>
      {shown.length === 0 ? (
        <div className="e2-06-list__items">
          <NoResult q={q} unreadOnly={unreadOnly} inProgressOnly={inProgressOnly} base={pathname} />
        </div>
      ) : (
        <ul className="e2-06-list__items" aria-label="Conversations">
          {shown.map((conversation) => (
            <ConversationRow
              key={conversation.key}
              conversation={conversation}
              now={now}
              active={pathname === studentConversationHref(conversation.missionId)}
              query={query}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export default StudentInboxList
