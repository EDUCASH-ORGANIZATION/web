import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { VerificationsTabs } from "@/components/admin/verifications-tabs"

export const metadata = { title: "Vérifications - Admin EduCash" }

const PAGE_SIZE = 50
const SIGNED_URL_TTL = 60 * 60 // 1 heure

// Numéro de page robuste : toute valeur non numérique ou inférieure à 1 donne la page 1.
function parsePage(value) {
  const n = Number.parseInt(value ?? "1", 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

// Chemin dans le bucket student-cards à partir de la valeur stockée (chemin ou ancienne URL).
// Retourne null si la valeur n'est pas exploitable : aucun repli sur la valeur brute.
function cardStoragePath(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl === "") return null
  const match = rawUrl.match(/student-cards\/(.+)$/)
  const candidate = (match ? match[1] : rawUrl).split("?")[0]
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate) || candidate.includes("..")) return null
  return candidate
}

export default async function AdminVerificationsPage({ searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const { page: pageParam } = (await searchParams) ?? {}
  const page = parsePage(pageParam)
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  // Colonnes privées (rejection_reason, verification_submitted_at, card_url) : lues avec le client
  // service role, uniquement après le contrôle admin ci-dessus.
  const service = createServiceClient()

  // Requête 1 : tous les profils étudiants
  const { data: profilesData, error: profilesError, count } = await service
    .from("profiles")
    .select("user_id, full_name, avatar_url, is_verified, rejection_reason, verified_until, verification_submitted_at, created_at", { count: "exact" })
    .eq("role", "student")
    .order("created_at", { ascending: false })
    .range(from, to)

  // Requête 2 : student_profiles de la page (sans FK directe avec profiles)
  const pageUserIds = (profilesData ?? []).map((p) => p.user_id)
  const { data: studentData, error: studentsError } = pageUserIds.length === 0
    ? { data: [], error: null }
    : await service
        .from("student_profiles")
        .select("user_id, school, card_url, level, skills")
        .in("user_id", pageUserIds)

  if (profilesError || studentsError) {
    return (
      <div className="p-6 lg:p-8 flex flex-col gap-6 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Vérifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Examinez les cartes étudiantes et validez ou rejetez les dossiers.
          </p>
        </div>
        <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-black text-red-800">Impossible de charger les dossiers de vérification.</p>
          <p className="text-xs text-red-700 mt-0.5">Recharge la page. Si le problème persiste, contacte l&apos;équipe technique.</p>
        </div>
      </div>
    )
  }

  const studentMap = {}
  ;(studentData ?? []).forEach((s) => { studentMap[s.user_id] = s })

  // Signed URLs (1h) pour les cartes du bucket privé student-cards, en un seul appel.
  // Aucun repli sur le chemin brut : sans URL signée, la carte est signalée indisponible.
  const pathByUser = {}
  for (const [userId, sp] of Object.entries(studentMap)) {
    const storagePath = cardStoragePath(sp.card_url)
    if (storagePath) pathByUser[userId] = storagePath
  }
  const paths = [...new Set(Object.values(pathByUser))]
  const urlByPath = {}
  if (paths.length > 0) {
    const { data: signed, error: signError } = await service.storage
      .from("student-cards")
      .createSignedUrls(paths, SIGNED_URL_TTL)
    if (signError) console.error("[admin/verifications] createSignedUrls:", signError.message)
    for (const entry of signed ?? []) {
      if (entry?.signedUrl && !entry.error) urlByPath[entry.path] = entry.signedUrl
    }
  }

  // Fusion des deux requêtes
  const profiles = (profilesData ?? []).map((p) => ({
    ...p,
    rejection_reason:          p.rejection_reason          ?? null,
    verified_until:            p.verified_until             ?? null,
    verification_submitted_at: p.verification_submitted_at ?? null,
    school:                    studentMap[p.user_id]?.school  ?? null,
    has_card:                  !!studentMap[p.user_id]?.card_url,
    card_url:                  urlByPath[pathByUser[p.user_id]] ?? null,
    card_preview_unavailable:  !!studentMap[p.user_id]?.card_url && !urlByPath[pathByUser[p.user_id]],
    level:                     studentMap[p.user_id]?.level   ?? null,
    skills:                    studentMap[p.user_id]?.skills  ?? [],
  }))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ── Catégories ────────────────────────────────────────────────────────────────

  // "submitted" : carte soumise, non encore vérifié, non rejeté
  // Triés du plus ancien au plus récent (priorité aux dossiers en attente depuis longtemps)
  const submitted = profiles
    .filter((p) => !p.is_verified && !p.rejection_reason && p.has_card)
    .sort((a, b) => {
      const dateA = new Date(a.verification_submitted_at ?? a.created_at)
      const dateB = new Date(b.verification_submitted_at ?? b.created_at)
      return dateA - dateB
    })

  const incomplete = profiles.filter((p) => !p.is_verified && !p.rejection_reason && !p.has_card)
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

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1
  const buildHref = (p) => `/admin/verifications${p > 1 ? `?page=${p}` : ""}`

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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page <span className="font-bold">{page}</span> sur {totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              href={page > 1 ? buildHref(page - 1) : "#"}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                page <= 1 ? "border-gray-100 text-gray-300 pointer-events-none" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <ChevronLeft size={15} /> Précédent
            </Link>
            <Link
              href={page < totalPages ? buildHref(page + 1) : "#"}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                page >= totalPages ? "border-gray-100 text-gray-300 pointer-events-none" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Suivant <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
