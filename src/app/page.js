import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { MISSION_TYPES } from "@/lib/supabase/database.constants"
import { PublicNavbar } from "@/components/home/public-navbar"
import { PublicFooter } from "@/components/home/public-footer"
import { HowItWorks } from "@/components/home/how-it-works"
import {
  Baby, Bike, ClipboardList, Keyboard, Megaphone,
  Languages, GraduationCap, Sparkles, ShieldCheck,
  Star, TrendingUp, Clock,
} from "lucide-react"

export const metadata = {
  title: "EduCash — Missions rémunérées pour étudiants au Bénin",
  description: "Marketplace de missions ponctuelles entre étudiants et clients à Cotonou, Porto-Novo et Abomey-Calavi. Paiement sécurisé via FedaPay.",
}

const MISSION_ICONS = {
  "Babysitting": Baby,
  "Livraison": Bike,
  "Aide administrative": ClipboardList,
  "Saisie": Keyboard,
  "Community Management": Megaphone,
  "Traduction": Languages,
  "Cours particuliers": GraduationCap,
  "Autre": Sparkles,
}

const MISSION_DESCRIPTIONS = {
  "Babysitting": "Garde d'enfants à domicile en toute confiance",
  "Livraison": "Coursier & livraison express en ville",
  "Aide administrative": "Gestion de documents et dossiers officiels",
  "Saisie": "Transcription et entrée de données rapide",
  "Community Management": "Animation et croissance sur les réseaux sociaux",
  "Traduction": "Français, Anglais, Fon et langues locales",
  "Cours particuliers": "Soutien scolaire et universitaire personnalisé",
  "Autre": "Toute autre prestation sur mesure",
}

const TESTIMONIALS = [
  {
    initial: "K",
    color: "bg-[#1A6B4A]",
    name: "Kokou Mensah",
    role: "Étudiant Licence 2 · UAC Cotonou",
    rating: 5,
    quote: "En deux semaines, j'ai décroché 3 missions de cours particuliers. EduCash m'a permis de payer ma scolarité sans demander à mes parents.",
  },
  {
    initial: "A",
    color: "bg-[#F59E0B]",
    name: "Adjoua Koffi",
    role: "Gérante · Boutique Mode, Cotonou",
    rating: 5,
    quote: "J'avais besoin d'aide pour gérer mon Instagram. J'ai trouvé un étudiant compétent en moins de 24h. Paiement simple, mission réussie.",
  },
  {
    initial: "S",
    color: "bg-purple-500",
    name: "Serge Dossou",
    role: "Directeur · PME Logistique, Porto-Novo",
    rating: 5,
    quote: "La qualité des profils est impressionnante. On a confié notre community management à un étudiant — résultats au-delà de nos attentes.",
  },
]

const TRUST_BADGES = [
  { icon: ShieldCheck, label: "Profils vérifiés", desc: "Carte étudiante requise" },
  { icon: Star, label: "Noté 4.8/5", desc: "Par nos utilisateurs" },
  { icon: TrendingUp, label: "+850 missions", desc: "Réalisées avec succès" },
  { icon: Clock, label: "Réponse rapide", desc: "Sous 24h en moyenne" },
]

export default async function HomePage() {
  const supabase = await createClient()

  const [{ count: studentsCount }, { count: missionsCount }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("missions").select("*", { count: "exact", head: true }),
  ])

  const students = studentsCount ?? 0
  const missions = missionsCount ?? 0

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#f0faf5] via-white to-[#fffbeb] px-4 pt-12 pb-0">
        {/* Decoration blobs */}
        <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#1A6B4A]/5 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 -left-24 w-64 h-64 rounded-full bg-[#F59E0B]/5 blur-3xl" />

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div className="flex flex-col gap-6 py-8">
              <span className="w-fit inline-flex items-center gap-2 bg-[#dcf5e9] text-[#1A6B4A] text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1A6B4A] animate-pulse" />
                La référence estudiantine au Bénin
              </span>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
                Transforme tes<br />
                compétences en{" "}
                <span className="text-[#1A6B4A] relative">
                  revenu
                  <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none">
                    <path d="M0 5 Q50 0 100 4 Q150 8 200 3" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                  </svg>
                </span>
              </h1>

              <p className="text-base text-gray-500 leading-relaxed max-w-md">
                Des missions ponctuelles rémunérées pour les étudiants de{" "}
                <span className="font-semibold text-gray-700">Cotonou, Calavi et Porto-Novo</span>.
                Aliez études et autonomie financière.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center gap-2 text-sm font-bold text-white bg-[#1A6B4A] hover:bg-[#155a3d] px-6 py-3.5 rounded-xl transition-colors shadow-lg shadow-[#1A6B4A]/20"
                >
                  Je suis étudiant →
                </Link>
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#1A6B4A] bg-white border-2 border-[#1A6B4A] hover:bg-[#f0faf5] px-6 py-3.5 rounded-xl transition-colors"
                >
                  Je cherche un prestataire
                </Link>
              </div>

              {/* Social proof mini */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex -space-x-2">
                  {["K", "A", "S", "M"].map((l, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: ["#1A6B4A", "#F59E0B", "#7c3aed", "#0ea5e9"][i] }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-900">{students > 0 ? `+${students}` : "+1 200"}</span> étudiants inscrits
                </p>
              </div>
            </div>

            {/* Right — Phone mockup */}
            <div className="hidden lg:flex justify-center items-end pb-0">
              <div className="relative">
                {/* Glow */}
                <div className="absolute inset-8 bg-[#1A6B4A]/20 blur-3xl rounded-full" />

                {/* Phone */}
                <div className="relative w-[260px] bg-gray-900 rounded-[44px] p-2 shadow-2xl border-4 border-gray-800">
                  {/* Notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-900 rounded-full z-10" />

                  <div className="bg-[#f8fafb] rounded-[36px] overflow-hidden h-[500px] flex flex-col">
                    {/* Status bar */}
                    <div className="px-5 pt-6 pb-2 flex justify-between items-center text-[10px] text-gray-500 font-medium">
                      <span>9:41</span>
                      <div className="flex gap-1 items-center">
                        <div className="w-3.5 h-2 border border-gray-400 rounded-sm relative">
                          <div className="absolute inset-0.5 left-0.5 bg-[#1A6B4A] rounded-sm w-2/3" />
                        </div>
                      </div>
                    </div>

                    {/* App header */}
                    <div className="px-4 pb-3">
                      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                        <p className="text-[10px] text-gray-400 font-medium">Bonjour 👋</p>
                        <p className="text-sm font-bold text-gray-900">Kokou Mensah</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <p className="text-[10px] text-green-600 font-semibold">Profil vérifié</p>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                      <div className="bg-[#1A6B4A] rounded-2xl px-3 py-2.5 text-white">
                        <p className="text-[10px] opacity-75">Revenus ce mois</p>
                        <p className="text-base font-bold">45 000 FCFA</p>
                      </div>
                      <div className="bg-white rounded-2xl px-3 py-2.5 shadow-sm">
                        <p className="text-[10px] text-gray-500">Missions</p>
                        <p className="text-base font-bold text-gray-900">3 actives</p>
                      </div>
                    </div>

                    {/* Missions list */}
                    <div className="px-4 flex flex-col gap-2 flex-1 overflow-hidden">
                      <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Missions disponibles</p>
                      {[
                        { type: "Cours particuliers", budget: "15 000", city: "Cotonou", dot: "bg-purple-400" },
                        { type: "Saisie de données", budget: "8 000", city: "Calavi", dot: "bg-blue-400" },
                        { type: "Community Mgmt", budget: "20 000", city: "Porto-Novo", dot: "bg-amber-400" },
                      ].map((m, i) => (
                        <div key={i} className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-3 shadow-sm">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${m.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-gray-900 truncate">{m.type}</p>
                            <p className="text-[10px] text-gray-400">{m.city}</p>
                          </div>
                          <p className="text-[11px] font-bold text-[#1A6B4A] shrink-0">{m.budget} F</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────────── */}
      <section className="bg-[#1A1A2E] py-6 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: students > 0 ? `+${students.toLocaleString()}` : "+1 200", label: "Étudiants" },
            { value: missions > 0 ? `+${missions.toLocaleString()}` : "+850", label: "Missions" },
            { value: "3", label: "Villes" },
            { value: "4.8/5", label: "Note moyenne" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-extrabold text-white">{value}</p>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRUST BADGES ─────────────────────────────────────────────────────── */}
      <section className="py-12 px-4 bg-gray-50 border-b border-gray-100">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
          {TRUST_BADGES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-3 bg-white rounded-xl px-4 py-4 shadow-sm border border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-[#f0faf5] flex items-center justify-center shrink-0">
                <Icon size={20} className="text-[#1A6B4A]" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TYPES DE MISSIONS ────────────────────────────────────────────────── */}
      <section id="missions" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A] bg-[#f0faf5] px-3 py-1 rounded-full">
                Catalogue
              </span>
              <h2 className="text-3xl font-bold text-gray-900 mt-4">
                Explore les opportunités
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                Trouvez la mission qui correspond à votre emploi du temps et vos talents.
              </p>
            </div>
            <Link
              href="/auth/register"
              className="text-sm font-semibold text-[#1A6B4A] hover:underline whitespace-nowrap"
            >
              Voir tout le catalogue →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {MISSION_TYPES.map((type) => {
              const Icon = MISSION_ICONS[type] ?? Sparkles
              return (
                <Link
                  key={type}
                  href="/auth/register"
                  className="group flex flex-col gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-5 shadow-sm hover:shadow-md hover:border-[#1A6B4A]/30 transition-all duration-200"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#f0faf5] group-hover:bg-[#1A6B4A] flex items-center justify-center transition-colors">
                    <Icon size={20} className="text-[#1A6B4A] group-hover:text-white transition-colors" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{type}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{MISSION_DESCRIPTIONS[type]}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ────────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── TÉMOIGNAGES ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A] bg-[#f0faf5] px-3 py-1 rounded-full">
              Témoignages
            </span>
            <h2 className="text-3xl font-bold text-gray-900 mt-4">
              Ils font confiance à EduCash
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map(({ initial, color, name, role, rating, quote }) => (
              <div
                key={name}
                className="flex flex-col gap-4 bg-white rounded-2xl border border-gray-100 px-5 py-6 shadow-sm"
              >
                {/* Stars */}
                <div className="flex gap-0.5">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} size={14} className="text-[#F59E0B] fill-[#F59E0B]" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1">
                  &ldquo;{quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                  <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {initial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-[#1A6B4A] relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/5" />

        <div className="relative max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Prêt à dynamiser<br />ton budget ?
          </h2>
          <p className="text-sm text-[#a7d9c1] max-w-sm leading-relaxed">
            Rejoins la plus grande communauté d&apos;étudiants actifs au Bénin et commence à gagner de l&apos;argent dès aujourd&apos;hui.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              href="/auth/register"
              className="flex-1 sm:flex-none text-center text-sm font-bold text-[#1A6B4A] bg-white hover:bg-gray-100 px-8 py-3.5 rounded-xl transition-colors shadow-lg"
            >
              Rejoindre l&apos;aventure →
            </Link>
            <Link
              href="/about"
              className="flex-1 sm:flex-none text-center text-sm font-semibold text-white border-2 border-white/50 hover:border-white hover:bg-white/10 px-8 py-3.5 rounded-xl transition-colors"
            >
              En savoir plus
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
