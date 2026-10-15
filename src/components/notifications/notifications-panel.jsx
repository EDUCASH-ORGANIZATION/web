"use client"

import { useCallback, useEffect, useId, useReducer, useRef } from "react"
import Link from "next/link"
import { NotificationList } from "./notification-list"
import { NotificationsEmpty, NotificationsSkeleton, NotificationsUnavailable } from "./notification-states"
import { useNotifications } from "./notifications-provider"
import { filterParam, initialListState, listReducer, loadedFromResponse, panelGroups } from "./notifications-logic"

// Panneau de notifications du bureau (non modal). Les données viennent des actions de l'espace reçues par le
// fournisseur ; ouvrir le panneau ne marque rien comme lu. Focus sur le titre à l'ouverture ; la fermeture
// (Échap, clic extérieur) et le retour du focus à la cloche sont gérés par la cloche.
export function NotificationsPanel({ id, allHref, onClose }) {
  const ctx = useNotifications()
  const titleId = useId()
  const titleRef = useRef(null)
  const latest = useRef(0)
  const [state, dispatch] = useReducer(listReducer, undefined, () => initialListState({ status: "loading" }))
  const { space, actions, setCount, refresh } = ctx
  const listAction = actions?.list

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const load = useCallback(
    async (filter) => {
      const ticket = ++latest.current
      dispatch({ type: "loading" })
      try {
        const res = await listAction({ filtre: filterParam(filter) })
        if (ticket !== latest.current) return
        const next = loadedFromResponse(res)
        dispatch(next)
        if (next.type === "loaded") setCount(res.unreadCount)
      } catch {
        if (ticket === latest.current) dispatch({ type: "failed" })
      }
    },
    [listAction, setCount],
  )

  useEffect(() => {
    load(state.filter)
  }, [load, state.filter])

  function onOpen(item) {
    if (item.unread) {
      dispatch({ type: "mark", id: item.id })
      setCount((previous) => Math.max(0, previous - 1))
      Promise.resolve(actions?.markRead?.(item.id))
        .then((res) => {
          if (res?.error) {
            dispatch({ type: "rollback" })
            refresh()
          }
        })
        .catch(() => refresh())
    }
    onClose?.({ restoreFocus: false })
  }

  function onMarkAll() {
    dispatch({ type: "markAll" })
    setCount(0)
    Promise.resolve(actions?.markAll?.())
      .then((res) => {
        if (res?.error) {
          dispatch({ type: "rollback" })
          refresh()
        }
      })
      .catch(() => refresh())
  }

  const now = new Date()
  const { groups, primaryId } = panelGroups(state.rows, space, now)
  const unreadOnly = state.filter === "unread"

  return (
    <section id={id} className="ntf-pop" aria-labelledby={titleId}>
      <div className="notif-panel">
        <div className="notif-panel__head">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="ntf-pop__title">
            Notifications
          </h2>
          {state.status === "ready" && state.count > 0 ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onMarkAll}>
              Tout marquer comme lu
            </button>
          ) : null}
        </div>
        <div className="ntf-pop__bar">
          <div className="segmented" role="group" aria-label="Filtrer les notifications">
            <button
              type="button"
              className={unreadOnly ? "segmented__item" : "segmented__item is-active"}
              aria-pressed={!unreadOnly}
              onClick={() => dispatch({ type: "filter", filter: "all" })}
            >
              Toutes
            </button>
            <button
              type="button"
              className={unreadOnly ? "segmented__item is-active" : "segmented__item"}
              aria-pressed={unreadOnly}
              onClick={() => dispatch({ type: "filter", filter: "unread" })}
            >
              Non lues
              {state.count > 0 ? <span className="count count--neutre">{state.count}</span> : null}
            </button>
          </div>
        </div>
        <div className="ntf-pop__body">
          {state.status === "loading" || state.status === "idle" ? <NotificationsSkeleton /> : null}
          {state.status === "error" ? <NotificationsUnavailable compact onRetry={() => load(state.filter)} /> : null}
          {state.status === "ready" && state.rows.length === 0 ? (
            <NotificationsEmpty space={space} unreadOnly={unreadOnly} compact />
          ) : null}
          {state.status === "ready" && state.rows.length > 0 ? (
            <NotificationList groups={groups} now={now} primaryId={primaryId} onOpen={onOpen} headingAs="h3" />
          ) : null}
        </div>
        <div className="notif-panel__foot">
          <Link className="link" href={allHref} prefetch={false} onClick={() => onClose?.({ restoreFocus: false })}>
            Voir toutes les notifications
          </Link>
        </div>
      </div>
    </section>
  )
}
