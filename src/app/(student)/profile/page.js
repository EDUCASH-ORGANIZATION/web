import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Star, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"

export const metadata = { title: "Mon profil — EduCash" }

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? "?"
  return (
    <div className="relative w-20 h-20 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <Image src={avatarUrl} alt={name} fill className="object-cover" />
      ) : (
        <span className="text-white text-2xl font-bold">{initial}</span>
      )}
    </div>
  )
}

function StarRow({ rating, count }) {
  const filled = Math.round(rating ?? 0)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={16}
            className={i < filled ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-gray-700">
        {rating != null ? Number(rating).toFixed(1) : "—"} / 5
      </span>
      <span className="text-xs text-gray-400">· {count ?? 0} mission{count !== 1 ? "s" : ""}</span>
    </div>
  )
}

function ReviewCard({ review }) {
  const reviewer = review.profiles
  const initial = reviewer?.full_name?.charAt(0)?.toUpperCase() ?? "?"
  const filled = Math.round(review.rating ?? 0)
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(review.created_at))

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative w-9 h-9 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
          {reviewer?.avatar_url ? (
            <Image src={reviewer.avatar_url} alt={reviewer.full_name} fill className="object-cover" />
          ) : (
            <span className="text-white text-sm font-bold">{initial}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {reviewer?.full_name?.split(" ")?.[0] ?? "Client"}
          </p>
          <div className="flex gap-0.5 mt-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={12}
                className={i < filled ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
              />
            ))}
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0">{date}</span>
      </div>
      {review.comment && (
        <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StudentProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [
    { data: profile },
    { data: studentProfile },
    { data: reviews },
    { data: transactions },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("student_profiles").select("*").eq("user_id", user.id).single(),
    supabase
      .from("reviews")
      .select("*, profiles!reviewer_id(full_name, avatar_url)")
      .eq("reviewed_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("amount_student")
      .eq("student_id", user.id)
      .eq("status", "paid"),
  ])

  const totalEarned = (transactions ?? []).reduce(
    (sum, t) => sum + (t.amount_student ?? 0),
    0
  )

  const skills = Array.isArray(studentProfile?.skills) ? studentProfile.skills : []
  const availability = studentProfile?.availability ?? null
  const missionsDone = profile?.missions_done ?? 0

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto flex flex-col gap-6">

        {/* Header profil */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center gap-3">
          {/* Bouton modifier */}
          <div className="w-full flex justify-end">
            <Link
              href="/profile/edit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={13} />
              Modifier mon profil
            </Link>
          </div>

          <div className="relative">
            <Avatar name={profile?.full_name} avatarUrl={profile?.avatar_url} />
            {profile?.is_verified && (
              <span className="absolute -bottom-1 -right-1 bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                Vérifié ✓
              </span>
            )}
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-900">{profile?.full_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {[profile?.city, studentProfile?.school, studentProfile?.level]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <StarRow rating={profile?.rating} count={missionsDone} />

          {/* Compétences */}
          {skills.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="bg-green-50 text-green-700 border border-green-100 rounded-full px-3 py-1 text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          {/* Disponibilités */}
          {availability && (
            <div className="w-full text-left mt-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Disponibilités
              </p>
              <p className="text-sm text-gray-700">{availability}</p>
            </div>
          )}
        </div>

        {/* Mes gains */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Mes gains
          </p>
          <p className="text-2xl font-bold text-green-700">
            {new Intl.NumberFormat("fr-FR").format(totalEarned)} FCFA
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Total reçu sur toutes les missions complétées
          </p>
        </div>

        {/* Avis reçus */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-800">
            Avis reçus ({reviews?.length ?? 0})
          </h2>

          {!reviews || reviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-sm text-gray-400">Aucun avis pour le moment.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
