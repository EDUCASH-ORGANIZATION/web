"use client"

import { useReducer, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { NotificationList } from "./notification-list"
import { NotificationsEmpty, NotificationsUnavailable } from "./notification-states"
import { useNotifications } from "./notifications-provider"
import { filterParam, initialListState, listReducer, loadedFromResponse, pageGroups } from "./notifications-logic"
import { adminHomeHref, adminNotificationsHref } from "@/lib/app/admin-routes"
import { clientNotificationsHref } from "@/lib/app/client-routes"
import { studentHomeHref, studentNotificationsHref } from "@/lib/app/student-routes"

const SPACES = {
  client: { filterHref: clientNotificationsHref, headerClass: null },
  student: { filterHref: studentNotificationsHref, headerClass: "e2", backHref: studentHomeHref },
  admin: { filterHref: adminNotificationsHref, headerClass: "a2", backHref: adminHomeHref },
}

// Bouton « Tout marquer comme lu » de l'en-tête mobile : icône seule, zone de 44 px sous 1024.
function MarkAllIcon({ onClick }) {
  return (
    <button type="button" className="iconbtn2" onClick={onClick} aria-label="Tout marquer comme lu">
      <Icon name="i-check-double" />
    </button>
  )
}

/**
 * Page complète des notifications d'un espace (mobile et « Voir toutes les notifications »). Reçoit les données
 * initiales et les actions serveur en props (aucun import d'action). Le filtre vient de l'URL (`filter`), la
 * pagination par curseur (« Afficher plus ») et le marquage passent par `actions`.
 *
 * @param {{
 *   space: "client"|"student"|"admin",
 *   filter: "all"|"unread",
 *   nowIso: string,
 *   initial: { items: any[], nextCursor: string|null, unreadCount: number } | null,
 *   actions: { list: Function, markRead: Function, markAll: Function },
 * }} props `initial` null : lecture impossible (état « Notifications indisponibles »)
 */
export function NotificationsPage({ space, filter = "all", nowIso, initial, actions }) {
  const ctx = useNotifications()
  const router = useRouter()
  const config = SPACES[space] ?? SPACES.client
  const [state, dispatch] = useReducer(listReducer, undefined, () =>
    initial
      ? { ...initialListState({ rows: initial.items, nextCursor: initial.nextCursor, count: initial.unreadCount, status: "ready" }), filter }
      : { ...initialListState({ status: "error" }), filter },
  )
  const [more, setMore] = useState("idle")
  const setCount = ctx?.setCount
  const refresh = ctx?.refresh

  const now = new Date(nowIso)
  const { groups, primaryId } = pageGroups(state.rows, space, now)
  const unreadOnly = filter === "unread"

  function onOpen(item) {
    if (!item.unread) return
    dispatch({ type: "mark", id: item.id })
    setCount?.((previous) => Math.max(0, previous - 1))
    Promise.resolve(actions.markRead(item.id))
      .then((res) => {
        if (res?.error) {
          dispatch({ type: "rollback" })
          refresh?.()
        }
      })
      .catch(() => refresh?.())
  }

  function onMarkAll() {
    dispatch({ type: "markAll" })
    setCount?.(0)
    Promise.resolve(actions.markAll())
      .then((res) => {
        if (res?.error) {
          dispatch({ type: "rollback" })
          refresh?.()
        }
      })
      .catch(() => refresh?.())
  }

  async function onMore() {
    if (more === "loading" || !state.nextCursor) return
    setMore("loading")
    try {
      const res = await actions.list({ filtre: filterParam(filter), curseur: state.nextCursor })
      const next = loadedFromResponse(res, { append: true })
      if (next.type === "loaded") {
        dispatch(next)
        setMore("idle")
      } else {
        setMore("error")
      }
    } catch {
      setMore("error")
    }
  }

  const canMarkAll = state.status === "ready" && state.count > 0
  const markAllLabel = "Tout marquer comme lu"
  const desktopOnly = config.headerClass ? " ds-desk-only" : ""

  return (
    <>
      {config.headerClass ? (
        <header className={`${config.headerClass}-mtop`}>
          <Link className="iconbtn2" href={config.backHref()} aria-label="Retour à l'accueil">
            <Icon name="i-arrow-left" />
          </Link>
          <span className={`${config.headerClass}-mtop__title`}>Notifications</span>
          {canMarkAll ? (
            <MarkAllIcon onClick={onMarkAll} />
          ) : (
            <span className={`${config.headerClass}-mtop__spacer`} aria-hidden="true" />
          )}
        </header>
      ) : null}

      <div className="ntf-page">
        <PageHead
          title="Notifications"
          actions={
            canMarkAll ? (
              <button type="button" className={`btn btn--ghost btn--sm${desktopOnly}`} onClick={onMarkAll}>
                {markAllLabel}
              </button>
            ) : null
          }
        />

        <nav className="ntf-page__bar" aria-label="Filtrer les notifications">
          <div className="segmented">
            <Link
              className={unreadOnly ? "segmented__item" : "segmented__item is-active"}
              href={config.filterHref()}
              aria-current={unreadOnly ? undefined : "page"}
              prefetch={false}
            >
              Toutes
            </Link>
            <Link
              className={unreadOnly ? "segmented__item is-active" : "segmented__item"}
              href={config.filterHref({ filtre: "non-lues" })}
              aria-current={unreadOnly ? "page" : undefined}
              prefetch={false}
            >
              Non lues
              {state.status === "ready" && state.count > 0 ? <span className="count count--neutre">{state.count}</span> : null}
            </Link>
          </div>
        </nav>

        <div className="ntf-card">
          {state.status === "error" ? <NotificationsUnavailable onRetry={() => router.refresh()} /> : null}
          {state.status === "ready" && state.rows.length === 0 ? (
            <NotificationsEmpty space={space} unreadOnly={unreadOnly} />
          ) : null}
          {state.status === "ready" && state.rows.length > 0 ? (
            <>
              <NotificationList groups={groups} now={now} primaryId={primaryId} onOpen={onOpen} />
              {state.nextCursor ? (
                <div className="ntf-more">
                  <button type="button" className="btn btn--soft btn--sm" onClick={onMore} disabled={more === "loading"}>
                    {more === "loading" ? "Chargement..." : "Afficher plus"}
                  </button>
                </div>
              ) : null}
              {more === "error" ? (
                <p className="ntf-more" role="alert">
                  Impossible de charger la suite. Réessayez dans un instant.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
