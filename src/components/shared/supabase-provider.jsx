"use client"

import { createContext, useContext, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const SupabaseContext = createContext(null)

export function SupabaseProvider({ children }) {
  const [supabase] = useState(() => createClient())

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext)
  if (!ctx) throw new Error("useSupabase doit être utilisé dans SupabaseProvider")
  return ctx
}
