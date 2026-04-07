import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { ReviewForm } from "@/components/review/review-form"

export const metadata = { title: "Laisser un avis — EduCash" }

// ─── Server Action ─────────────────────────────────────────────────────────────

async function createReview(reviewedId, missionId, role, formData) {
  "use server"

  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié" }

  const supabase = await createClient()

  // Vérifie qu'aucune review n'existe déjà
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("mission_id", missionId)
    .eq("reviewer_id", user.id)
    .maybeSingle()

  if (existing) return { error: "Vous avez déjà laissé un avis pour cette mission." }

  const rating = parseInt(formData.get("rating"), 10)
  const comment = formData.get("comment")?.toString().trim() || null

  if (!rating || rating < 1 || rating > 5) {
    return { error: "Veuillez sélectionner une note entre 1 et 5 étoiles." }
  }

  // Insère la review
  const { error: insertError } = await supabase.from("reviews").insert({
    mission_id: missionId,
    reviewer_id: user.id,
    reviewed_id: reviewedId,
    rating,
    comment,
  })

  if (insertError) {
    console.error("[createReview] insert error:", insertError)
    return { error: "Impossible d'enregistrer votre avis." }
  }

  // Recalcule la moyenne
  const { data: allReviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewed_id", reviewedId)

  if (allReviews?.length) {
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
    await supabase
      .from("profiles")
      .update({ rating: Math.round(avg * 10) / 10 })
      .eq("user_id", reviewedId)
  }

  const { revalidatePath } = await import("next/cache")
  revalidatePath(`/students/${reviewedId}`)

  redirect(role === "client" ? "/client/dashboard" : "/dashboard")
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function ReviewPage({ params }) {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()
  const { missionId } = params

  // Charge la mission pour obtenir la personne à noter
  const { data: mission } = await supabase
    .from("missions")
    .select("title, client_id, selected_student_id, status")
    .eq("id", missionId)
    .single()

  if (!mission || mission.status !== "done") notFound()

  // Vérifie que l'utilisateur est impliqué dans cette mission
  const isClient = mission.client_id === user.id
  const isStudent = mission.selected_student_id === user.id
  if (!isClient && !isStudent) notFound()

  // Vérifie si une review existe déjà
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("mission_id", missionId)
    .eq("reviewer_id", user.id)
    .maybeSingle()

  if (existing) {
    redirect(isClient ? "/client/dashboard" : "/dashboard")
  }

  // La personne notée = l'autre partie
  const reviewedId = isClient ? mission.selected_student_id : mission.client_id
  const role = isClient ? "client" : "student"

  const action = createReview.bind(null, reviewedId, missionId, role)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Laisser un avis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Comment s&apos;est passée la mission ?
          </p>
          <p className="text-xs text-gray-400 mt-0.5 font-medium truncate">
            {mission.title}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <ReviewForm action={action} />
        </div>
      </div>
    </div>
  )
}
