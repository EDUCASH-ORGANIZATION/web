import Link from "next/link"

export const metadata = { title: "Page introuvable — EduCash" }

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#1A1A2E] flex flex-col items-center justify-center px-6 overflow-hidden relative">

      {/* Cercles décoratifs en arrière-plan */}
      <div className="absolute top-[-120px] left-[-120px] w-[400px] h-[400px] rounded-full bg-[#1A6B4A]/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full bg-[#F59E0B]/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#1A6B4A]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg">

        {/* 404 stylisé */}
        <div className="relative mb-6 select-none">
          <p className="text-[10rem] sm:text-[12rem] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-[#1A6B4A] to-[#1A6B4A]/20 tracking-tight">
            404
          </p>
          {/* Badge flottant */}
          <div className="absolute -top-3 -right-4 sm:-right-8 bg-[#F59E0B] text-[#1A1A2E] text-xs font-black px-2.5 py-1 rounded-full rotate-12 shadow-lg">
            Oups !
          </div>
        </div>

        {/* Illustration étudiante */}
        <div className="mb-6 w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl shadow-xl backdrop-blur-sm">
          🎓
        </div>

        {/* Texte */}
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-snug">
          Cette page est en mission… introuvable.
        </h1>
        <p className="text-gray-400 text-base leading-relaxed mb-8">
          Peut-être qu&apos;elle cherche un étudiant, ou un client, ou les deux.
          En attendant, on a plein d&apos;autres missions pour toi.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] active:bg-[#104530] transition-colors text-center touch-manipulation"
          >
            ← Retour à l&apos;accueil
          </Link>
          <Link
            href="/missions"
            className="px-6 py-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm font-semibold hover:bg-white/15 transition-colors text-center backdrop-blur-sm touch-manipulation"
          >
            Voir les missions
          </Link>
        </div>

        {/* Liens rapides */}
        <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {[
            { label: "Publier une mission", href: "/auth/register" },
            { label: "Devenir étudiant", href: "/auth/register" },
            { label: "Se connecter", href: "/auth/login" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-xs text-gray-500 hover:text-[#1A6B4A] transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

      </div>

      {/* Footer minimal */}
      <p className="absolute bottom-6 text-xs text-gray-600">
        EduCash — Marketplace étudiant au Bénin
      </p>
    </div>
  )
}
