"use client"

// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef } from "react"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
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

  const conversations = useMemo(
    () =>
      (result?.conversations ?? []).map((c) =>
        c.unreadCount > 0 && pathname === studentConversationHref(c.missionId) ? { ...c, unreadCount: 0 } : c,
      ),
    [result, pathname],
  )

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
        {isConversation ? children : null}
      </>
    )
  }

  if (conversations.length === 0) {
    return (
      <>
        <LiveRefresh />
        <PageHead date="Aucun message" title="Messages" />
        <NoConversation />
        {isConversation ? children : null}
      </>
    )
  }

  const unreadCount = unreadTotal(conversations)
  const unreadLabel = unreadCount > 0 ? plural(unreadCount, "non lu", "non lus") : "Tout est lu"

  return (
    <>
      <LiveRefresh />
      <PageHead
        date={
          <>
            <span className="e2-06-day">{dayLabel(nowDate)} · </span>
            {unreadLabel}
          </>
        }
        title="Messages"
      />
      <div className="e2-06-inbox" data-view={isConversation ? "conversation" : "list"}>
        <StudentInboxList conversations={conversations} now={nowDate} />
        {isConversation ? children : <EmptyPane />}
      </div>
    </>
  )
}

export default StudentInboxView
