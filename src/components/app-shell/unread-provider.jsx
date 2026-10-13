"use client"

import { createContext, useContext } from "react"
import { useUnreadCount } from "@/hooks/use-unread-count"

const UnreadContext = createContext(0)

// Un seul abonnement temps réel pour toute la coquille : la sidebar et la barre du bas lisent le même compteur.
export function UnreadProvider({ userId, initialCount = 0, children }) {
  const count = useUnreadCount(userId, initialCount)
  return <UnreadContext.Provider value={count}>{children}</UnreadContext.Provider>
}

export function useUnread() {
  return useContext(UnreadContext)
}
