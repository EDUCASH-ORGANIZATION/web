"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const SPACE_BY_ROLE = {
  student: "/dashboard",
  client: "/client/dashboard",
  admin: "/admin/dashboard",
}

// Session pour la navbar vitrine : utilisateur, profil et espace du rôle.
export function useVitrineSession() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    function loadProfile(nextUser) {
      if (!nextUser) {
        setUser(null)
        setProfile(null)
        return
      }
      setUser(nextUser)
      supabase
        .from("profiles")
        .select("full_name, avatar_url, role")
        .eq("user_id", nextUser.id)
        .single()
        .then(({ data }) => {
          if (active) setProfile(data)
        })
    }

    supabase.auth.getUser().then(({ data }) => {
      if (active) loadProfile(data?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) loadProfile(session?.user ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  const role = user?.user_metadata?.role ?? profile?.role ?? null
  const fullName = profile?.full_name ?? user?.user_metadata?.full_name ?? null

  return {
    user,
    role,
    fullName,
    avatarUrl: profile?.avatar_url || null,
    initials: fullName ? fullName.trim().charAt(0).toUpperCase() : "?",
    spaceHref: SPACE_BY_ROLE[role] ?? SPACE_BY_ROLE.student,
    signOut,
  }
}
