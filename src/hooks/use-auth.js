"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { logout as logoutAction } from "@/lib/actions/auth.actions"

export function useAuth() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    // Le rôle affiché vient de profiles (affichage seulement : l'autorisation est côté serveur).
    // Le chargement ne se termine qu'une fois le rôle connu (pas d'affichage intermédiaire sans rôle).
    async function loadRole(nextUser) {
      if (!nextUser) {
        setRole(null)
        return
      }
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", nextUser.id)
        .maybeSingle()
      if (active) setRole(data?.role ?? null)
    }

    // Initialisation
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return
      setUser(user)
      loadRole(user).finally(() => {
        if (active) setIsLoading(false)
      })
    })

    // Écoute les changements de session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const nextUser = session?.user ?? null
      setUser(nextUser)
      loadRole(nextUser).finally(() => {
        if (active) setIsLoading(false)
      })
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Déconnexion côté serveur (révocation de session) ; l'action redirige vers l'accueil.
  async function logout() {
    setUser(null)
    setRole(null)
    await logoutAction()
  }

  return {
    user,
    role,
    isLoading,
    logout,
  }
}
