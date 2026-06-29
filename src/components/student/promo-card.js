"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { ShieldCheck, X, TrendingUp, BadgeCheck, Star, ArrowRight } from "lucide-react"

export function PromoCard() {
  const [open, setOpen] = useState(false)

  const modal = open ? createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-[#1A6B4A] px-6 pt-8 pb-10 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center bg-white/15 text-white hover:bg-white/25 transition-colors touch-manipulation"
          >
            <X size={16} />
          </button>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
              <ShieldCheck size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-white leading-snug">Boostez votre profil</h2>
            <p className="text-sm text-white/75 mt-1">Devenez un étudiant certifié EduCash</p>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            La certification EduCash valide ton identité et ton statut étudiant. Elle augmente
            considérablement ta visibilité auprès des clients.
          </p>
          <div className="flex flex-col gap-3">
            {[
              { icon: TrendingUp, color: "text-[#1A6B4A]", bg: "bg-green-50", title: "3× plus de sélections", desc: "Les profils certifiés sont prioritaires dans les résultats de recherche." },
              { icon: BadgeCheck, color: "text-blue-600",   bg: "bg-blue-50",  title: "Badge de confiance",   desc: "Un badge visible sur ton profil rassure les clients sur ta sérieux." },
              { icon: Star,       color: "text-amber-500", bg: "bg-amber-50", title: "Accès aux missions premium", desc: "Certaines missions à fort budget sont réservées aux étudiants vérifiés." },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={17} className={color} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center gap-2.5 mt-1">
            <span className="text-lg">🎓</span>
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              Il te suffit de fournir une <strong>carte étudiante valide</strong> lors de la configuration de ton profil.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2">
          <a
            href="/profile"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors touch-manipulation"
            onClick={() => setOpen(false)}
          >
            Compléter mon profil
            <ArrowRight size={15} />
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors touch-manipulation"
          >
            Pas maintenant
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      {modal}
      <div className="lg:hidden bg-[#1A6B4A] rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-10 -right-2 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />
        <p className="text-base font-black text-white leading-snug relative z-10">Boostez votre profil</p>
        <p className="text-xs text-white/70 leading-relaxed relative z-10">
          Les étudiants certifiés ont 3× plus de chances d&apos;être sélectionnés.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative z-10 flex items-center gap-1.5 mt-1 px-3 py-2 rounded-xl bg-white text-[#1A6B4A] text-xs font-bold w-fit touch-manipulation"
        >
          <ShieldCheck size={13} />
          En savoir plus
        </button>
      </div>
    </>
  )
}
