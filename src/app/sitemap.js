import { createClient } from "@/lib/supabase/server"

export default async function sitemap() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

  const supabase = await createClient()
  const { data: missions } = await supabase
    .from("missions")
    .select("id, updated_at")
    .eq("status", "open")
    .limit(100)

  const staticRoutes = [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/missions`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${APP_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/legal/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/legal/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ]

  const missionRoutes = (missions ?? []).map((m) => ({
    url: `${APP_URL}/missions/${m.id}`,
    lastModified: new Date(m.updated_at),
    changeFrequency: "daily",
    priority: 0.7,
  }))

  return [...staticRoutes, ...missionRoutes]
}
