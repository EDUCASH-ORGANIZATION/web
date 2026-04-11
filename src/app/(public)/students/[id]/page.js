import { notFound } from "next/navigation"
import Link from "next/link"
import {
  Star, MapPin, GraduationCap, Clock, Zap,
  MessageSquare, ShieldCheck, CheckCircle, ChevronLeft,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { VerifiedAvatar } from "@/components/shared/verified-avatar"

export async function generateMetadata({ params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", id)
    .single()
  return { title: data ? `${data.full_name} — EduCash` : "Profil étudiant — EduCash" }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso))
}

function fmtMonth(iso) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(iso))
}

// ─── StarRow ──────────────────────────────────────────────────────────────────

function StarRow({ rating, count, size = 16 }) {
  const filled = Math.round(rating ?? 0)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={size}
            className={i < filled ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
          />
        ))}
      </div>
      {rating > 0 && (
        <span className="text-sm font-semibold text-gray-700">{Number(rating).toFixed(1)}</span>
      )}
      {count > 0 && (
        <span className="text-xs text-gray-400">· {count} mission{count > 1 ? "s" : ""}</span>
      )}
    </div>
  )
}

// ─── ReviewCard ───────────────────────────────────────────────────────────────

function ReviewCard({ review }) {
  const reviewer = review.profiles
  const initial  = reviewer?.full_name?.charAt(0)?.toUpperCase() ?? "?"
  const filled   = Math.round(review.rating ?? 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
            {reviewer?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reviewer.avatar_url} alt={reviewer.full_name ?? ""} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-sm font-bold">{initial}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">
              {reviewer?.full_name?.split(" ")?.[0] ?? "Client"}
            </p>
            <p className="text-xs text-gray-400">{fmtMonth(review.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={12} className={i < filled ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"} />
          ))}
        </div>
      </div>
      {review.comment && (
        <p className="text-sm text-gray-600 italic leading-relaxed">
          &ldquo;{review.comment}&rdquo;
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StudentPublicProfilePage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: profile },
    { data: studentProfile },
    { data: reviews },
    { data: { user } },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", id).single(),
    supabase.from("student_profiles").select("*").eq("user_id", id).maybeSingle(),
    supabase
      .from("reviews")
      .select("*, profiles!reviewer_id(full_name, avatar_url)")
      .eq("reviewed_id", id)
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ])

  if (!profile) notFound()

  const viewerRole   = user?.user_metadata?.role ?? null
  const isClient     = viewerRole === "client"
  const skills       = Array.isArray(studentProfile?.skills) ? studentProfile.skills : []
  const missionsDone = profile.missions_done ?? 0
  const rating       = profile.rating ?? 0

  const isVerified    = profile.is_verified ?? false
  const verifiedUntil = profile.verified_until ?? null
  const badgeValid    = isVerified && (!verifiedUntil || new Date(verifiedUntil) > new Date())

  // Indicatif tarifaire : budget moyen des missions faites
  // (pas en base → on affiche une fourchette indicative selon le niveau)
  const levelRates = {
    "Licence 1": "1 500 – 3 000", "Licence 2": "2 000 – 4 000", "Licence 3": "2 500 – 5 000",
    "Master 1":  "3 000 – 6 000", "Master 2":  "4 000 – 8 000",
    "BTS":       "2 000 – 4 000", "Doctorat":  "5 000 – 10 000",
  }
  const rateRange = levelRates[studentProfile?.level] ?? "2 000 – 5 000"

  return (
    <div className="min-h-screen bg-[#F5F6FA] py-8 px-4">
      <div className="max-w-[960px] mx-auto flex flex-col gap-6">

        {/* ── Retour ──────────────────────────────────────────────── */}
        {isClient && (
          <Link
            href="/client/missions"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors w-fit"
          >
            <ChevronLeft size={16} />
            Retour aux missions
          </Link>
        )}

        {/* ── Corps : 2 colonnes ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

          {/* ── Colonne principale ─────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-start gap-5 flex-wrap">

                {/* Avatar */}
                <VerifiedAvatar
                  avatarUrl={profile.avatar_url}
                  fullName={profile.full_name ?? ""}
                  isVerified={isVerified}
                  verifiedUntil={verifiedUntil}
                  size="lg"
                  showBadge
                />

                {/* Identité */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-black text-gray-900">{profile.full_name}</h1>
                    {badgeValid && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#1A6B4A] bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                        <ShieldCheck size={11} />
                        vérifié
                      </span>
                    )}
                  </div>

                  {/* Localisation + école */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                    {profile.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-gray-400" />
                        {profile.city}, Bénin
                      </span>
                    )}
                    {studentProfile?.school && (
                      <span className="flex items-center gap-1">
                        <GraduationCap size={13} className="text-gray-400" />
                        {studentProfile.school}
                      </span>
                    )}
                    {studentProfile?.level && (
                      <span className="text-gray-400 text-xs font-semibold bg-gray-100 px-2.5 py-1 rounded-full">
                        {studentProfile.level}
                      </span>
                    )}
                  </div>

                  {/* Note */}
                  <StarRow rating={rating} count={missionsDone} />
                </div>
              </div>
            </div>

            {/* À propos */}
            {profile.bio && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
                <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Zap size={15} className="text-[#1A6B4A]" />
                  À propos
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Compétences */}
            {skills.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
                <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Zap size={15} className="text-[#1A6B4A]" />
                  Compétences
                </h2>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="bg-gray-100 text-gray-700 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Disponibilités */}
            {studentProfile?.availability && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
                <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Clock size={15} className="text-[#1A6B4A]" />
                  Disponibilités
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {studentProfile.availability}
                </p>
              </div>
            )}

            {/* Avis */}
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <MessageSquare size={15} className="text-[#1A6B4A]" />
                Voir tous les avis ({reviews?.length ?? 0})
              </h2>

              {!reviews?.length ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
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

          {/* ── Colonne droite (sidebar) ────────────────────────────── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">

            {/* Tarif indicatif */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Tarif indicatif
                </p>
                <p className="text-2xl font-black text-gray-900 mt-1">
                  {rateRange}{" "}
                  <span className="text-sm font-bold text-gray-400">FCFA / h</span>
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {[
                  "Réponse sous 2 heures",
                  "Paiement sécurisé via EduCash",
                  "Entretien vidéo possible",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle size={13} className="text-[#1A6B4A] shrink-0" />
                    <p className="text-xs text-gray-600">{item}</p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isClient ? (
                <a
                  href={`/client/missions/new?studentId=${id}`}
                  className="w-full py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors text-center touch-manipulation"
                >
                  Proposer une mission →
                </a>
              ) : !user ? (
                <Link
                  href={`/auth/login`}
                  className="w-full py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors text-center touch-manipulation"
                >
                  Se connecter pour contacter
                </Link>
              ) : null}
            </div>

            {/* Identité vérifiée */}
            {badgeValid ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#1A6B4A] flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} className="text-white" />
                  </div>
                  <p className="text-sm font-black text-[#1A6B4A] uppercase tracking-wide">
                    Identité vérifiée
                  </p>
                </div>
                <p className="text-xs text-green-700 leading-relaxed">
                  Sans engagement. Vous confirmez votre projet avant de valider.
                </p>
                {verifiedUntil && (
                  <p className="text-[11px] text-green-600 font-semibold">
                    Badge valide jusqu&apos;au {fmtDate(verifiedUntil)}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-black text-gray-500">Profil non vérifié</p>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Cet étudiant n&apos;a pas encore soumis sa carte étudiante.
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-2xl font-black text-gray-900">{missionsDone}</p>
                <p className="text-[11px] text-gray-400 font-medium">Missions réussies</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-2xl font-black text-gray-900">
                  {rating > 0 ? rating.toFixed(1) : "—"}
                </p>
                <p className="text-[11px] text-gray-400 font-medium">Note moyenne</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
