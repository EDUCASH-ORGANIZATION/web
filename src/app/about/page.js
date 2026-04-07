import Link from "next/link"
import { PublicNavbar } from "@/components/home/public-navbar"
import { PublicFooter } from "@/components/home/public-footer"
import { Target, Heart, Shield, Users, TrendingUp, MapPin } from "lucide-react"

export const metadata = {
  title: "À propos — EduCash",
  description: "Découvrez l'histoire, la mission et les valeurs d'EduCash, la marketplace des étudiants au Bénin.",
}

const VALUES = [
  {
    icon: Heart,
    title: "Bienveillance",
    description: "Chaque étudiant mérite une chance de s'autonomiser. On crée des ponts, pas des barrières.",
  },
  {
    icon: Shield,
    title: "Confiance",
    description: "Profils vérifiés, paiements sécurisés. Chaque transaction est protégée de bout en bout.",
  },
  {
    icon: Target,
    title: "Impact local",
    description: "Nous investissons dans l'économie béninoise en créant des opportunités réelles sur le terrain.",
  },
  {
    icon: TrendingUp,
    title: "Croissance",
    description: "Nos étudiants ne font pas que gagner de l'argent — ils développent des compétences durables.",
  },
]

const TEAM = [
  { initial: "B", color: "bg-[#1A6B4A]", name: "Brandon M.", role: "Fondateur & CEO" },
  { initial: "E", color: "bg-[#F59E0B]", name: "Éric D.", role: "CTO" },
  { initial: "F", color: "bg-purple-500", name: "Fatoumata K.", role: "Head of Operations" },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#f0faf5] to-white px-4 py-20">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-5">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A] bg-[#dcf5e9] px-3 py-1.5 rounded-full">
            Notre histoire
          </span>
          <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
            On croit en l&apos;avenir<br />des étudiants béninois
          </h1>
          <p className="text-base text-gray-500 max-w-xl leading-relaxed">
            EduCash est né d&apos;un constat simple : des milliers d&apos;étudiants talentueux peinent
            à subvenir à leurs besoins, tandis que des particuliers et entreprises cherchent
            des prestataires fiables. Nous avons construit le pont.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={14} className="text-[#1A6B4A]" />
            <span>Cotonou, Bénin · Fondé en 2025</span>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A]">Notre mission</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-3 mb-4">
              Démocratiser l&apos;accès au travail pour les étudiants
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-4">
              Au Bénin, plus de 60 000 étudiants sont inscrits dans les universités publiques et privées.
              Beaucoup abandonnent leurs études par manque de ressources financières.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              EduCash propose une solution concrète : connecter ces étudiants à des missions
              rémunérées, adaptées à leurs disponibilités, et garantir des paiements sécurisés
              via FedaPay — la référence du paiement mobile en Afrique de l&apos;Ouest.
            </p>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-[#1A6B4A]">+1 200</p>
                <p className="text-xs text-gray-500">Étudiants</p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-[#1A6B4A]">+850</p>
                <p className="text-xs text-gray-500">Missions</p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-[#1A6B4A]">3</p>
                <p className="text-xs text-gray-500">Villes</p>
              </div>
            </div>
          </div>

          {/* Visual */}
          <div className="bg-[#f0faf5] rounded-3xl p-8 flex flex-col gap-4">
            <div className="bg-white rounded-2xl px-5 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1A6B4A] flex items-center justify-center text-white font-bold">K</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Kokou · Cours particuliers</p>
                  <p className="text-xs text-gray-500">Mission terminée · 15 000 FCFA</p>
                </div>
                <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Payé</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl px-5 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B] flex items-center justify-center text-white font-bold">M</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Marie · Community Mgmt</p>
                  <p className="text-xs text-gray-500">En cours · 20 000 FCFA</p>
                </div>
                <span className="ml-auto text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Actif</span>
              </div>
            </div>
            <p className="text-center text-xs text-[#1A6B4A] font-medium">+850 missions réussies sur EduCash</p>
          </div>
        </div>
      </section>

      {/* Valeurs */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A]">Ce qu&apos;on défend</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-3">Nos valeurs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VALUES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4 bg-white rounded-2xl px-5 py-5 shadow-sm border border-gray-100">
                <div className="w-11 h-11 rounded-xl bg-[#f0faf5] flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-[#1A6B4A]" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">{title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Équipe */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A]">L&apos;équipe</span>
          <h2 className="text-2xl font-bold text-gray-900 mt-3 mb-10">Les visages derrière EduCash</h2>
          <div className="flex flex-wrap justify-center gap-6">
            {TEAM.map(({ initial, color, name, role }) => (
              <div key={name} className="flex flex-col items-center gap-3">
                <div className={`w-20 h-20 rounded-2xl ${color} flex items-center justify-center text-white text-2xl font-extrabold shadow-lg`}>
                  {initial}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="text-sm text-gray-500">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4 bg-[#1A6B4A]">
        <div className="max-w-xl mx-auto text-center flex flex-col items-center gap-5">
          <h2 className="text-2xl font-bold text-white">Rejoins-nous</h2>
          <p className="text-sm text-[#a7d9c1]">Construis ton avenir financier dès aujourd&apos;hui.</p>
          <Link
            href="/auth/register"
            className="text-sm font-bold text-[#1A6B4A] bg-white hover:bg-gray-100 px-8 py-3 rounded-xl transition-colors"
          >
            Créer mon compte →
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
