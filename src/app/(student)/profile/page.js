import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Star, MapPin, GraduationCap, Pencil, ShieldCheck, ShieldAlert,
  BookOpen, Zap, Clock, MessageSquare
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { VerifiedAvatar } from "@/components/shared/verified-avatar"

export const metadata = { title: "Mon profil — EduCash" }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(iso))
}

function StarRow({ rating, size = 16 }) {
  const filled = Math.round(rating ?? 0)
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={i < filled ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
        />
      ))}
    </div>
  )
}

function ReviewCard({ review }) {
  const reviewer = review.profiles
  const initial = reviewer?.full_name?.charAt(0)?.toUpperCase() ?? "?"
  const filled = Math.round(review.rating ?? 0)

  return (
    <div className="bg-[#f8f9fb] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
            {reviewer?.avatar_url ? (
              <Image src={reviewer.avatar_url} alt={reviewer.full_name ?? ""} fill sizes="40px" className="object-cover" />
            ) : (
              <span className="text-white text-sm font-bold">{initial}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{reviewer?.full_name ?? "Client"}</p>
            <p className="text-xs text-gray-400">{formatDate(review.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              size={13}
              className={i < filled ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
            />
          ))}
        </div>
      </div>
      {review.comment && (
        <p className="text-sm text-gray-600 leading-relaxed italic">
          &ldquo;{review.comment}&rdquo;
        </p>
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

  const totalEarned  = (transactions ?? []).reduce((s, t) => s + (t.amount_student ?? 0), 0)
  const skills       = Array.isArray(studentProfile?.skills) ? studentProfile.skills : []
  const missionsDone = profile?.missions_done ?? 0
  const rating       = profile?.rating ?? 0
  const isVerified   = profile?.is_verified ?? false
  const hasCard      = !!studentProfile?.card_url

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto flex flex-col gap-6">

      {/* ── Bannière vérification ────────────────────────────────────── */}
      {!isVerified && (
        <Link
          href="/profile/verify"
          className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 hover:bg-amber-100 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
            <ShieldAlert size={20} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {hasCard ? "Vérification en cours" : "Compte non vérifié"}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {hasCard
                ? "Votre carte étudiante est en cours de vérification par notre équipe (sous 24h)."
                : "Ajoutez votre carte étudiante pour postuler aux missions. Les étudiants vérifiés ont 3× plus de succès."}
            </p>
          </div>
          {!hasCard && (
            <span className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold whitespace-nowrap">
              Ajouter ma carte →
            </span>
          )}
        </Link>
      )}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

          {/* Avatar */}
          <VerifiedAvatar
            avatarUrl={profile?.avatar_url}
            fullName={profile?.full_name ?? ""}
            isVerified={isVerified}
            size="lg"
          />

          {/* Nom + infos */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black text-gray-900">{profile?.full_name}</h1>
                  {isVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#1A6B4A] bg-green-50 border border-green-200 px-2.5 py-1 rounded-full uppercase tracking-wide">
                      <ShieldCheck size={11} />
                      Vérifié
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {profile?.city && (
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin size={13} className="text-gray-400" />
                      {profile.city}, Bénin
                    </span>
                  )}
                  {studentProfile?.school && (
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <GraduationCap size={13} className="text-gray-400" />
                      {studentProfile.school}
                    </span>
                  )}
                </div>
              </div>

              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors touch-manipulation shrink-0"
              >
                <Pencil size={14} />
                Modifier mon profil
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mt-1 flex-wrap">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Note globale</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl font-black text-gray-900">{rating > 0 ? rating.toFixed(1) : "—"}</span>
                  <StarRow rating={rating} size={14} />
                </div>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total gains</p>
                <p className="text-xl font-black text-gray-900 mt-0.5">
                  {fmt(totalEarned)} <span className="text-sm font-bold text-gray-400">FCFA</span>
                </p>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Missions réussies</p>
                <p className="text-xl font-black text-gray-900 mt-0.5">{missionsDone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Corps : 2 colonnes ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Colonne gauche */}
        <div className="flex flex-col gap-5">

          {/* À propos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-base font-black text-gray-900">
              <BookOpen size={17} className="text-[#1A6B4A]" />
              À propos de moi
            </h2>
            {profile?.bio ? (
              <p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">
                Aucune description.{" "}
                <Link href="/profile/edit" className="text-[#1A6B4A] font-semibold hover:underline">
                  Ajouter une bio →
                </Link>
              </p>
            )}
          </div>

          {/* Compétences */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-base font-black text-gray-900">
              <Zap size={17} className="text-[#1A6B4A]" />
              Compétences
            </h2>
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="bg-gray-100 text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">
                Aucune compétence renseignée.{" "}
                <Link href="/profile/edit" className="text-[#1A6B4A] font-semibold hover:underline">
                  Ajouter →
                </Link>
              </p>
            )}
          </div>

          {/* Disponibilités */}
          {studentProfile?.availability && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-base font-black text-gray-900">
                <Clock size={17} className="text-[#1A6B4A]" />
                Disponibilités
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {studentProfile.availability}
              </p>
            </div>
          )}
        </div>

        {/* Colonne droite : avis */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black text-gray-900">
              <MessageSquare size={17} className="text-[#1A6B4A]" />
              Avis reçus
              <span className="text-sm font-semibold text-gray-400 ml-1">
                {reviews?.length ?? 0} témoignage{(reviews?.length ?? 0) !== 1 ? "s" : ""}
              </span>
            </h2>
          </div>

          {!reviews?.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <p className="text-sm font-semibold text-gray-400">Aucun avis pour le moment.</p>
              <p className="text-xs text-gray-400 mt-1">Complétez vos premières missions pour recevoir des avis.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.slice(0, 4).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
              {reviews.length > 4 && (
                <button
                  type="button"
                  className="text-sm font-semibold text-[#1A6B4A] hover:underline text-center py-2"
                >
                  Voir tous les avis ({reviews.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
