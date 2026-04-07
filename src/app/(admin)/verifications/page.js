import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { VerificationsTabs } from "@/components/admin/verifications-tabs"

export const metadata = { title: "Vérifications — Admin EduCash" }

export default async function AdminVerificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") redirect("/auth/login")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Charge tous les profils étudiants avec leur profil étudiant (établissement)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, is_verified, created_at, student_profiles(school, card_url)")
    .eq("role", "student")
    .order("created_at", { ascending: false })

  // Génère les signed URLs pour les cartes étudiantes
  const withSignedUrls = await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const cardPath = profile.student_profiles?.card_url ?? null
      let card_signed_url = null

      if (cardPath) {
        const { data } = await admin.storage
          .from("student-cards")
          .createSignedUrl(cardPath, 3600)
        card_signed_url = data?.signedUrl ?? null
      }

      return {
        ...profile,
        card_url: cardPath,
        card_signed_url,
      }
    })
  )

  const pending  = withSignedUrls.filter((p) => !p.is_verified)
  const verified = withSignedUrls.filter((p) => p.is_verified)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Vérifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Examinez les cartes étudiantes et validez ou rejetez les dossiers.
        </p>
      </div>

      <VerificationsTabs
        pending={pending}
        verified={verified}
        all={withSignedUrls}
      />
    </div>
  )
}
