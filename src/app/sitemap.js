import { createClient } from "@supabase/supabase-js"
import { todayInBenin } from "@/lib/vitrine/dates"

// Client anonyme sans cookies : le sitemap reste statique, la lecture passe par la RLS.
export const revalidate = 3600

export default async function sitemap() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.educash.bj"

  const staticRoutes = [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/missions`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${APP_URL}/clients`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/aide`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/legal/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/legal/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/legal/mentions`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ]

  let missions = []
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data, error } = await supabase
      .from("missions")
      .select("id, updated_at")
      .eq("status", "open")
      .or("deadline.is.null,deadline.gte." + todayInBenin())
      .limit(100)
    if (error) throw error
    missions = data ?? []
  } catch (error) {
    console.error("sitemap: missions indisponibles", error)
    return staticRoutes
  }

  const missionRoutes = missions.map((m) => ({
    url: `${APP_URL}/missions/${m.id}`,
    lastModified: new Date(m.updated_at),
    changeFrequency: "daily",
    priority: 0.7,
  }))

  return [...staticRoutes, ...missionRoutes]
}
