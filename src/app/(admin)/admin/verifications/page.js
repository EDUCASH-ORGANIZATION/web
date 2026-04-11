import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VerificationsTabs } from "@/components/admin/verifications-tabs"

export const metadata = { title: "Vérifications — Admin EduCash" }

export default async function AdminVerificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") redirect("/auth/login")

  // Requête 1 : tous les profils étudiants
  let { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, is_verified, rejection_reason, verified_until, verification_submitted_at, created_at")
    .eq("role", "student")
    .order("created_at", { ascending: false })

  // Fallback si colonnes manquantes (avant migration fix-verifications.sql)
  if (profilesError) {
    const fallback = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, is_verified, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false })
    profilesData = fallback.data ?? []
  }

  // Requête 2 : tous les student_profiles (sans FK directe avec profiles)
  const { data: studentData } = await supabase
    .from("student_profiles")
    .select("user_id, school, card_url, level, skills")

  const studentMap = {}
  ;(studentData ?? []).forEach((s) => { studentMap[s.user_id] = s })

  // Génère des signed URLs (1h) pour les cartes du bucket privé student-cards
  const signedCardUrls = {}
  for (const [userId, sp] of Object.entries(studentMap)) {
    const rawUrl = sp.card_url
    if (!rawUrl) continue
    const match = rawUrl.match(/student-cards\/(.+)$/)
    const storagePath = match?.[1]
    if (!storagePath) { signedCardUrls[userId] = rawUrl; continue }
    const { data: signed } = await supabase.storage
      .from("student-cards")
      .createSignedUrl(storagePath, 60 * 60) // 1 heure
    signedCardUrls[userId] = signed?.signedUrl ?? rawUrl
  }

  // Fusion des deux requêtes
  const profiles = (profilesData ?? []).map((p) => ({
    ...p,
    rejection_reason:          p.rejection_reason          ?? null,
    verified_until:            p.verified_until             ?? null,
    verification_submitted_at: p.verification_submitted_at ?? null,
    school:                    studentMap[p.user_id]?.school  ?? null,
    card_url:                  signedCardUrls[p.user_id]      ?? null,
    level:                     studentMap[p.user_id]?.level   ?? null,
    skills:                    studentMap[p.user_id]?.skills  ?? [],
  }))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ── Catégories ────────────────────────────────────────────────────────────────

  // "submitted" : carte soumise, non encore vérifié, non rejeté
  // Triés du plus ancien au plus récent (priorité aux dossiers en attente depuis longtemps)
  const submitted = profiles
    .filter((p) => !p.is_verified && !p.rejection_reason && p.card_url)
    .sort((a, b) => {
      const dateA = new Date(a.verification_submitted_at ?? a.created_at)
      const dateB = new Date(b.verification_submitted_at ?? b.created_at)
      return dateA - dateB
    })

  const incomplete = profiles.filter((p) => !p.is_verified && !p.rejection_reason && !p.card_url)
  const rejected   = profiles.filter((p) => !!p.rejection_reason)

  // "verified" : vérifié ET badge encore valide (ou sans date d'expiration)
  const verified = profiles.filter(
    (p) => p.is_verified && (!p.verified_until || new Date(p.verified_until) >= today)
  )

  // "expired" : vérifié mais badge expiré
  const expired = profiles.filter(
    (p) => p.is_verified && p.verified_until && new Date(p.verified_until) < today
  )

  // ── Stats contextuelles ───────────────────────────────────────────────────────

  const threshold48h = new Date(today.getTime() - 48 * 60 * 60 * 1000)
  const waitingOver48h = submitted.filter((p) => {
    const submittedAt = p.verification_submitted_at ?? p.created_at
    return submittedAt && new Date(submittedAt) < threshold48h
  }).length

  // "Validés ce mois" : badge vérifié émis dans les 30 derniers jours
  // verified_until = verified_date + 1 an → si verified_until >= aujourd'hui + 11 mois
  const elevenMonthsFromNow = new Date(today)
  elevenMonthsFromNow.setMonth(elevenMonthsFromNow.getMonth() + 11)
  const validatedThisMonth = verified.filter((p) => {
    if (!p.verified_until) return false
    return new Date(p.verified_until) >= elevenMonthsFromNow
  }).length

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
        expired={expired}
        all={profiles}
        stats={{
          waitingOver48h,
          validatedThisMonth,
          totalRejected: rejected.length,
        }}
      />
    </div>
  )
}
