"use client"

// @ds-screen RD-CLIENT-01
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { EmptyState } from "@/components/app-ui/empty-state"
import { SEARCH_MAX_LENGTH } from "@/lib/constants/missions"
import { clientConversationHref } from "@/lib/app/client-routes"
import { filterConversations, formatListTime, unreadTotal } from "@/lib/client-space/conversations"

const INBOX_PATH = "/client/messages"
const UNREAD_PARAM = "non-lues"
const IN_PROGRESS_PARAM = "en-cours"

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Recherche : texte seul, sans caractère de contrôle, bornée (découpe par point de code).
function normalizeSearch(raw) {
  return Array.from((raw ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim()).slice(0, SEARCH_MAX_LENGTH).join("")
}

/**
 * Adresse d'une liste filtrée (paramètres vides omis). `base` est le chemin courant : la recherche et les
 * filtres gardent la conversation ouverte, `studentId` repère l'étudiant d'une mission à plusieurs candidats.
 * @param {{ q?: string, unreadOnly?: boolean, inProgressOnly?: boolean, base?: string, studentId?: string }} [options]
 */
export function inboxHref({ q, unreadOnly, inProgressOnly, base = INBOX_PATH, studentId } = {}) {
  const query = new URLSearchParams()
  if (studentId) query.set("studentId", studentId)
  if (q) query.set("q", q)
  if (unreadOnly) query.set("filtre", UNREAD_PARAM)
  else if (inProgressOnly) query.set("filtre", IN_PROGRESS_PARAM)
  const qs = query.toString()
  return qs ? `${base}?${qs}` : base
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

/**
 * Clé de la conversation ouverte, d'après le chemin et le paramètre `studentId`. Sans `studentId`, la page ouvre
 * l'étudiant retenu : la seule ligne de la mission, sinon celle qui n'est ni candidate ni refusée.
 * @param {object[]} conversations
 * @param {string} pathname
 * @param {string|null|undefined} studentId
 * @returns {string|null}
 */
export function activeKeyOf(conversations, pathname, studentId) {
  const ofMission = (conversations ?? []).filter((c) => pathname === clientConversationHref(c.missionId))
  if (ofMission.length === 0) return null
  if (studentId) return ofMission.find((c) => c.studentId === studentId)?.key ?? null
  if (ofMission.length === 1) return ofMission[0].key
  return ofMission.find((c) => c.state !== "candidate" && c.state !== "rejected")?.key ?? null
}

function ConversationRow({ conversation, now, active, query }) {
  const unread = conversation.unreadCount > 0
  const href = inboxHref({
    ...query,
    base: clientConversationHref(conversation.missionId),
    studentId: conversation.studentId,
  })
  return (
    <li>
      <Link className={cx("convo", unread && "is-unread", active && "is-active")} href={href} aria-current={active ? "true" : undefined}>
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
 * filtre sont lus dans l'adresse ; la ligne de la conversation ouverte est repérée par le chemin et `studentId`.
 * @param {{ conversations: object[], now: Date }} props conversations déjà lues (toutes, non filtrées)
 */
export function ClientInboxList({ conversations, now }) {
  const pathname = usePathname() || INBOX_PATH
  const params = useSearchParams()
  const q = normalizeSearch(params?.get("q"))
  const filter = params?.get("filtre")
  const unreadOnly = filter === UNREAD_PARAM
  const inProgressOnly = filter === IN_PROGRESS_PARAM
  const unreadCount = unreadTotal(conversations)
  const shown = filterConversations(conversations, { q, unreadOnly, inProgressOnly })
  const activeKey = activeKeyOf(conversations, pathname, params?.get("studentId"))
  const query = { q, unreadOnly, inProgressOnly }
  // Les liens de filtre restent sur la conversation ouverte, avec son étudiant.
  const openStudentId = activeKey ? conversations.find((c) => c.key === activeKey)?.studentId : undefined

  return (
    <section className="c-inbox__list" aria-label="Conversations">
      <form role="search" method="get" action={pathname}>
        {openStudentId ? <input type="hidden" name="studentId" value={openStudentId} /> : null}
        {unreadOnly || inProgressOnly ? <input type="hidden" name="filtre" value={filter} /> : null}
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
        <Link
          className={cx("segmented__item", !unreadOnly && !inProgressOnly && "is-active")}
          href={inboxHref({ q, base: pathname, studentId: openStudentId })}
          aria-current={unreadOnly || inProgressOnly ? undefined : "page"}
        >
          Toutes
        </Link>
        <Link
          className={cx("segmented__item", unreadOnly && "is-active")}
          href={inboxHref({ q, unreadOnly: true, base: pathname, studentId: openStudentId })}
          aria-current={unreadOnly ? "page" : undefined}
        >
          {unreadCount > 0 ? `Non lues (${unreadCount})` : "Non lues"}
        </Link>
        <Link
          className={cx("segmented__item", inProgressOnly && "is-active")}
          href={inboxHref({ q, inProgressOnly: true, base: pathname, studentId: openStudentId })}
          aria-current={inProgressOnly ? "page" : undefined}
        >
          En cours
        </Link>
      </nav>
      {shown.length === 0 ? (
        <div className="inbox-rows2 convos2">
          <NoResult q={q} unreadOnly={unreadOnly} inProgressOnly={inProgressOnly} base={pathname} />
        </div>
      ) : (
        <ul className="inbox-rows2 convos2" aria-label="Conversations">
          {shown.map((conversation) => (
            <ConversationRow
              key={conversation.key}
              conversation={conversation}
              now={now}
              active={conversation.key === activeKey}
              query={query}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export default ClientInboxList
