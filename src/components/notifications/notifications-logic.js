// Logique pure du centre de notifications (RD-NOTIF-01) : aucune dépendance React ni réseau, testable en
// environnement node. Utilisée par le fournisseur, la cloche, le panneau et la page.
import {
  groupNotifications,
  notificationActionLabel,
  notificationHref,
  notificationIcon,
  primaryNotificationId,
} from "@/lib/notifications/catalog"

export const POLL_INTERVAL_MS = 60_000
export const PANEL_LIMIT = 8

/** Libellé de la cloche : « Notifications » ou « Notifications, N non lues ». */
export function bellLabel(count) {
  const n = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  if (n === 0) return "Notifications"
  return n === 1 ? "Notifications, 1 non lue" : `Notifications, ${n} non lues`
}

/**
 * Texte annoncé (aria-live) : seulement une hausse du compteur, jamais au premier rendu (`previous` null),
 * jamais à la baisse.
 * @param {number|null} previous
 * @param {number} next
 * @returns {string}
 */
export function announcementFor(previous, next) {
  if (previous === null || previous === undefined) return ""
  if (!Number.isFinite(next) || next <= previous) return ""
  const added = next - previous
  return added === 1 ? "Vous avez une nouvelle notification." : `Vous avez ${added} nouvelles notifications.`
}

/** Le sondage ne tourne que si l'onglet est visible. */
export function shouldPoll(visibilityState) {
  return visibilityState === "visible"
}

/** Compteur borné à un entier positif ; toute valeur invalide donne `fallback`. */
export function safeCount(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback
}

/**
 * Ligne de la base -> élément prêt à afficher. Le lien est recalculé ici (type, mission, acteur, espace) : il
 * n'est jamais stocké ni reçu du serveur.
 */
export function toViewItem(row, space) {
  return {
    ...row,
    createdAt: row.created_at,
    unread: !row.read_at,
    icon: notificationIcon(row.type),
    href: notificationHref(row, space),
    actionLabel: notificationActionLabel(row.type),
  }
}

/** Éléments visibles du panneau : au plus PANEL_LIMIT, regroupés par jour. */
export function panelGroups(rows, space, now = new Date(), limit = PANEL_LIMIT) {
  const items = (Array.isArray(rows) ? rows : []).slice(0, limit).map((row) => toViewItem(row, space))
  return { groups: groupNotifications(items, now), primaryId: primaryNotificationId(items, space) }
}

/** Groupes de la page complète. */
export function pageGroups(rows, space, now = new Date()) {
  const items = (Array.isArray(rows) ? rows : []).map((row) => toViewItem(row, space))
  return { groups: groupNotifications(items, now), primaryId: primaryNotificationId(items, space) }
}

// ─── État d'une liste (panneau et page) ──────────────────────────────────────────────────────

/** @param {{ rows?: any[], nextCursor?: string|null, count?: number, status?: string }} [initial] */
export function initialListState({ rows = [], nextCursor = null, count = 0, status = "idle" } = {}) {
  return { status, rows, nextCursor, count, filter: "all", snapshot: null }
}

/**
 * Réducteur de liste. Actions :
 * - `loading`, `loaded` { rows, nextCursor, count, append }, `failed`
 * - `filter` { filter } : change le filtre et repasse en chargement
 * - `mark` { id } : marque une notification lue (optimiste, mémorise l'état pour le retour arrière)
 * - `markAll` : marque tout lu (optimiste)
 * - `rollback` : restaure l'état mémorisé (échec du marquage)
 * - `count` { count } : compteur renvoyé par le sondage
 */
export function listReducer(state, action) {
  switch (action.type) {
    case "loading":
      return { ...state, status: "loading" }
    case "loaded": {
      const rows = action.append ? [...state.rows, ...action.rows] : action.rows
      return {
        ...state,
        status: "ready",
        rows,
        nextCursor: action.nextCursor ?? null,
        count: action.count === undefined ? state.count : safeCount(action.count, state.count),
      }
    }
    case "failed":
      return { ...state, status: "error" }
    case "filter":
      if (action.filter !== "all" && action.filter !== "unread") return state
      return { ...state, filter: action.filter, status: "loading", rows: [], nextCursor: null }
    case "mark": {
      const target = state.rows.find((row) => row.id === action.id)
      if (!target || target.read_at) return state
      const readAt = action.at ?? new Date().toISOString()
      return {
        ...state,
        snapshot: { rows: state.rows, count: state.count },
        rows: state.rows.map((row) => (row.id === action.id ? { ...row, read_at: readAt } : row)),
        count: Math.max(0, state.count - 1),
      }
    }
    case "markAll": {
      const readAt = action.at ?? new Date().toISOString()
      return {
        ...state,
        snapshot: { rows: state.rows, count: state.count },
        rows: state.rows.map((row) => (row.read_at ? row : { ...row, read_at: readAt })),
        count: 0,
      }
    }
    case "rollback":
      if (!state.snapshot) return state
      return { ...state, rows: state.snapshot.rows, count: state.snapshot.count, snapshot: null }
    case "count":
      return { ...state, count: safeCount(action.count, state.count) }
    default:
      return state
  }
}

/** Réponse d'une action de lecture -> action du réducteur. */
export function loadedFromResponse(res, { append = false } = {}) {
  if (!res || res.error || !Array.isArray(res.items)) return { type: "failed" }
  return { type: "loaded", rows: res.items, nextCursor: res.nextCursor ?? null, count: res.unreadCount, append }
}

/** Paramètre `filtre` attendu par les actions serveur. */
export function filterParam(filter) {
  return filter === "unread" ? "non-lues" : undefined
}

// ─── Sondage ─────────────────────────────────────────────────────────────────────────────────

/**
 * Planificateur du sondage du compteur (sans React, dépendances injectées pour les tests). Une relecture toutes
 * les `interval` ms tant que l'onglet est visible ; onglet caché : aucune minuterie ; retour sur l'onglet :
 * relecture immédiate puis minuterie relancée.
 * @param {{
 *   refresh: () => unknown,
 *   getVisibility: () => string,
 *   interval?: number,
 *   setTimer?: (fn: () => void, ms: number) => unknown,
 *   clearTimer?: (id: unknown) => void,
 * }} deps
 */
export function createPoller({
  refresh,
  getVisibility,
  interval = POLL_INTERVAL_MS,
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = (id) => clearInterval(id),
}) {
  let timer = null
  function stop() {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }
  function start() {
    stop()
    if (!shouldPoll(getVisibility())) return
    timer = setTimer(() => {
      if (shouldPoll(getVisibility())) refresh()
    }, interval)
  }
  function onVisibilityChange() {
    if (shouldPoll(getVisibility())) {
      refresh()
      start()
    } else {
      stop()
    }
  }
  return { start, stop, onVisibilityChange, isRunning: () => timer !== null }
}
