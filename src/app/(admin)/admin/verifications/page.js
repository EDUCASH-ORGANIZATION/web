import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VerificationsTabs } from "@/components/admin/verifications-tabs"

export const metadata = { title: "Vérifications — Admin EduCash" }

export default async function AdminVerificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") redirect("/auth/login")

  // Requête 1 : tous les profils étudiants
  // rejection_reason disponible après migration fix-verifications.sql
  let { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, is_verified, rejection_reason, created_at")
    .eq("role", "student")
    .order("created_at", { ascending: false })

  // Fallback si rejection_reason n'existe pas encore
  if (profilesError) {
    const fallback = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, is_verified, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false })
    profilesData = fallback.data
  }

  // Requête 2 : tous les student_profiles (séparée — pas de FK direct avec profiles)
  const { data: studentData } = await supabase
    .from("student_profiles")
    .select("user_id, school, card_url, level, skills")

  // Index des student_profiles par user_id pour une jointure O(1)
  const studentMap = {}
  ;(studentData ?? []).forEach((s) => { studentMap[s.user_id] = s })

  // Génère des signed URLs (1h) pour les cartes du bucket privé student-cards
  // On extrait le chemin relatif depuis l'URL publique stockée en base
  const signedCardUrls = {}
  for (const [userId, sp] of Object.entries(studentMap)) {
    const rawUrl = sp.card_url
    if (!rawUrl) continue
    // Extrait le chemin : "uuid/card.jpg" depuis l'URL complète
    const match = rawUrl.match(/student-cards\/(.+)$/)
    const storagePath = match?.[1]
    if (!storagePath) { signedCardUrls[userId] = rawUrl; continue }
    const { data: signed } = await supabase.storage
      .from("student-cards")
      .createSignedUrl(storagePath, 60 * 60) // 1 heure
    if (signed?.signedUrl) signedCardUrls[userId] = signed.signedUrl
    // Fallback sur l'URL brute si la signature échoue (bucket rendu public plus tard)
    else signedCardUrls[userId] = rawUrl
  }

  // Fusion des deux requêtes
  const profiles = (profilesData ?? []).map((p) => ({
    ...p,
    rejection_reason: p.rejection_reason ?? null,
    school:           studentMap[p.user_id]?.school   ?? null,
    card_url:         signedCardUrls[p.user_id]       ?? null,
    level:            studentMap[p.user_id]?.level    ?? null,
    skills:           studentMap[p.user_id]?.skills   ?? [],
  }))

  // Catégories :
  // • "submitted"  = carte soumise, non encore vérifié, non rejeté
  // • "incomplete" = pas de carte soumise, non vérifié, non rejeté
  // • "rejected"   = rejection_reason non nul
  // • "verified"   = is_verified = true
  const submitted  = profiles.filter((p) => !p.is_verified && !p.rejection_reason && p.card_url)
  const incomplete = profiles.filter((p) => !p.is_verified && !p.rejection_reason && !p.card_url)
  const rejected   = profiles.filter((p) => !!p.rejection_reason)
  const verified   = profiles.filter((p) => p.is_verified)

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Vérifications</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Examinez les cartes étudiantes et validez ou rejetez les dossiers.
        </p>
      </div>

      <VerificationsTabs
        submitted={submitted}
        incomplete={incomplete}
        rejected={rejected}
        verified={verified}
        all={profiles}
      />
    </div>
  )
}
