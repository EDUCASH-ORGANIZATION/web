"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { createPoller, safeCount } from "./notifications-logic"

// Compteur de notifications non lues de la coquille (RD-NOTIF-01). Pas de temps réel : le layout fournit la
// valeur initiale, puis un sondage léger (60 s, onglet visible seulement) relit le compteur ; il est aussi relu
// au retour sur l'onglet et à l'ouverture du panneau (`refresh`). Aucun abonnement Supabase.
//
// `actions` : { list, count, markRead, markAll }, les actions serveur de l'espace reçues en props (ce module
// n'importe aucune action). `space` : "client" | "student" | "admin".

const NotificationsContext = createContext(null)

export function NotificationsProvider({ space, initialCount = 0, actions, children }) {
  const [count, setCountState] = useState(() => safeCount(initialCount))
  const countAction = actions?.count
  const mounted = useRef(true)

  // Resynchronise quand le layout renvoie une nouvelle valeur (navigation).
  useEffect(() => {
    setCountState(safeCount(initialCount))
  }, [initialCount])

  const setCount = useCallback((value) => {
    setCountState((previous) => safeCount(typeof value === "function" ? value(previous) : value, previous))
  }, [])

  const refresh = useCallback(async () => {
    if (typeof countAction !== "function") return
    try {
      const res = await countAction()
      if (mounted.current && res && !res.error && typeof res.count === "number") setCountState(safeCount(res.count))
    } catch {
      // Un sondage en échec garde la valeur affichée.
    }
  }, [countAction])

  useEffect(() => {
    mounted.current = true
    const poller = createPoller({ refresh, getVisibility: () => document.visibilityState })
    poller.start()
    document.addEventListener("visibilitychange", poller.onVisibilityChange)
    return () => {
      mounted.current = false
      poller.stop()
      document.removeEventListener("visibilitychange", poller.onVisibilityChange)
    }
  }, [refresh])

  const value = useMemo(() => ({ space, count, setCount, refresh, actions }), [space, count, setCount, refresh, actions])
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

/** @returns {{ space: string, count: number, setCount: Function, refresh: Function, actions: object } | null} */
export function useNotifications() {
  return useContext(NotificationsContext)
}
