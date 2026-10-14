"use client"

import { createContext, useContext } from "react"
import { useUnreadCount } from "@/hooks/use-unread-count"

const UnreadContext = createContext(0)

function RealtimeUnread({ userId, initialCount, children }) {
  const count = useUnreadCount(userId, initialCount)
  return <UnreadContext.Provider value={count}>{children}</UnreadContext.Provider>
}

// Un seul abonnement temps réel pour toute la coquille : la sidebar et la barre du bas lisent le même compteur.
// `realtime` faux (espace admin) ou `userId` absent : aucun hook ni canal, le compteur de messages vaut 0.
export function UnreadProvider({ userId, initialCount = 0, realtime = true, children }) {
  if (realtime === false || !userId) {
    return <UnreadContext.Provider value={0}>{children}</UnreadContext.Provider>
  }
  return (
    <RealtimeUnread userId={userId} initialCount={initialCount}>
      {children}
    </RealtimeUnread>
  )
}

export function useUnread() {
  return useContext(UnreadContext)
}
