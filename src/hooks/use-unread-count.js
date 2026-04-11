"use client"

import { useState, useEffect, useRef, useId } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Compte les messages non lus en temps réel pour un utilisateur.
 * - Incrémente sur INSERT (nouveau message reçu)
 * - Re-compte sur UPDATE (messages marqués comme lus)
 *
 * @param {string} userId
 * @param {number} initialCount  valeur initiale issue du serveur
 */
export function useUnreadCount(userId, initialCount = 0) {
  const [count, setCount] = useState(initialCount)
  const supabase          = useRef(createClient()).current
  // useId() garantit un nom de channel unique par instance du hook,
  // évitant le conflit quand Sidebar + BottomNav utilisent le même userId.
  const instanceId        = useId().replace(/:/g, "")

  // Resync quand la valeur serveur change (navigation entre pages)
  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    if (!userId) return

    async function fetchCount() {
      const { count: fresh } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", userId)
        .eq("read", false)
      setCount(fresh ?? 0)
    }

    const channel = supabase
      .channel(`unread_badge:${userId}:${instanceId}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "messages",
        filter: `receiver_id=eq.${userId}`,
      }, () => setCount((prev) => prev + 1))
      .on("postgres_changes", {
        event:  "UPDATE",
        schema: "public",
        table:  "messages",
        filter: `receiver_id=eq.${userId}`,
      }, () => fetchCount())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId, supabase, instanceId])

  return count
}
