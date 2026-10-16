"use client"

// @ds-screen RD-CLIENT-01
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { useUnread } from "@/components/app-shell/unread-provider"
import { ClientInboxList, activeKeyOf } from "@/components/client-space/messages/inbox-list"
import { clientMissionsHref, clientPublishHref } from "@/lib/app/client-routes"
import { unreadTotal } from "@/lib/client-space/conversations"

const INBOX_PATH = "/client/messages"

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

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
 * Conversations ouvertes depuis le dernier `result` (à lire comme lues) : vidé quand `result` change, cumulé
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
    <section className="c-inbox__list" aria-label="Conversations">
      <div className="inbox-rows2 convos2">{children}</div>
    </section>
  )
}

// Volet de droite sans conversation ouverte.
function EmptyPane() {
  return (
    <div className="c-inbox__thread inbox2__empty">
      <div className="empty2">
        <span className="empty2__ic">
          <Icon name="i-message" />
        </span>
        <div className="empty2__title">Choisissez une conversation</div>
        <div className="empty2__text">{"Vos échanges avec les étudiants s'affichent ici, une conversation par candidat."}</div>
      </div>
    </div>
  )
}

/**
 * Messages (C12, C13) : titre de page puis une carte unique à deux volets, la liste des conversations à gauche et
 * `children` à droite (volet vide sur /client/messages, où la page ne rend rien, conversation sur
 * /client/messages/<mission>). Vue pure : `result` est la réponse de `getClientConversations`. La conversation
 * ouverte est comptée comme lue sans attendre le rafraîchissement.
 * @param {{ result: { conversations?: object[], error?: string }, now?: string, children?: import("react").ReactNode }} props
 */
export function ClientInboxView({ result, now, children }) {
  const pathname = usePathname() || INBOX_PATH
  const params = useSearchParams()
  const nowDate = useMemo(() => (now ? new Date(now) : new Date()), [now])
  const isConversation = pathname.startsWith(`${INBOX_PATH}/`)
  const all = result?.conversations
  const hasError = Boolean(result?.error) || !all

  // Conversations ouvertes depuis le dernier `result` : comptées comme lues, vidé quand `result` change.
  const openedKey = activeKeyOf(all, pathname, params?.get("studentId"))
  const [opened, setOpened] = useState({ result, ids: [] })
  const next = nextOpened(opened, result, openedKey)
  if (next !== opened) setOpened(next)
  const ids = next.ids

  const conversations = (all ?? []).map((c) => (c.unreadCount > 0 && ids.includes(c.key) ? { ...c, unreadCount: 0 } : c))

  // Sur /client/messages : l'état d'erreur ou vide occupe la page. Sur une conversation : il reste dans le volet
  // gauche, le volet droit garde la conversation (404 d'un client sans lien avec la conversation).
  if (!isConversation && hasError) {
    return (
      <>
        <PageHead title="Messages" />
        <section className="card2 card2--flush" aria-label="Erreur de chargement">
          <ErrorState
            compact
            title="Impossible d'afficher vos messages"
            text={result?.error ?? "Le chargement a échoué. Veuillez réessayer."}
          />
        </section>
      </>
    )
  }

  if (!isConversation && conversations.length === 0) {
    return (
      <>
        <LiveRefresh />
        <PageHead date="Aucune conversation" title="Messages" />
        <NoConversation />
      </>
    )
  }

  const unreadCount = unreadTotal(conversations)
  const summary = hasError
    ? "Messages indisponibles"
    : conversations.length === 0
      ? "Aucune conversation"
      : `${plural(conversations.length, "conversation", "conversations")} · ${plural(unreadCount, "non lue", "non lues")}`

  return (
    <>
      <LiveRefresh />
      <PageHead date={summary} title="Messages" />
      <div className="c-inbox inbox2" data-view={isConversation ? "conversation" : "list"}>
        {hasError ? (
          <ListNotice>
            <ErrorState
              compact
              title="Impossible d'afficher vos messages"
              text={result?.error ?? "Le chargement a échoué. Veuillez réessayer."}
            />
          </ListNotice>
        ) : conversations.length === 0 ? (
          <ListNotice>
            <EmptyState
              compact
              icon="i-message"
              title="Aucune conversation"
              text="Vos échanges avec les candidats apparaîtront ici."
              action={{ label: "Voir mes missions", href: clientMissionsHref() }}
            />
          </ListNotice>
        ) : (
          <ClientInboxList conversations={conversations} now={nowDate} />
        )}
        {isConversation ? <div className="c-inbox__thread">{children}</div> : <EmptyPane />}
      </div>
    </>
  )
}

export default ClientInboxView
