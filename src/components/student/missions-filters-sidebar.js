"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Zap, Clock, ShieldCheck, SlidersHorizontal, X, ChevronDown, Star, BadgeCheck, TrendingUp, ArrowRight } from "lucide-react"
import { CITIES } from "@/lib/supabase/database.constants"

const BUDGET_MAX = 75000

export function MissionsFiltersSidebar({ budgetMax, cities, urgency }) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [promoOpen, setPromoOpen] = useState(false)

  const updateParam = useCallback((key, value) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete("page")
    router.push(`/student/missions?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  function toggleCity(city) {
    const params   = new URLSearchParams(searchParams.toString())
    const current  = params.get("cities")?.split(",").filter(Boolean) ?? []
    const next     = current.includes(city)
      ? current.filter((c) => c !== city)
      : [...current, city]
    if (next.length) params.set("cities", next.join(","))
    else params.delete("cities")
    params.delete("page")
    router.push(`/student/missions?${params.toString()}`, { scroll: false })
  }

  function reset() {
    router.push("/student/missions", { scroll: false })
    setMobileOpen(false)
  }

  const budgetVal = parseInt(budgetMax) || BUDGET_MAX
  const pct       = Math.round((budgetVal / BUDGET_MAX) * 100)

  const activeCount = [
    budgetMax && budgetVal < BUDGET_MAX,
    cities.length > 0,
    !!urgency,
  ].filter(Boolean).length

  // ── Popup promo ─────────────────────────────────────────────────────────────
  const PromoModal = () => promoOpen ? (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setPromoOpen(false)}
      />
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header vert */}
        <div className="bg-[#1A6B4A] px-6 pt-8 pb-10 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />
          <button
            type="button"
            onClick={() => setPromoOpen(false)}
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

        {/* Avantages */}
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

        {/* CTA */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <a
            href="/profile"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors touch-manipulation"
            onClick={() => setPromoOpen(false)}
          >
            Compléter mon profil
            <ArrowRight size={15} />
          </a>
          <button
            type="button"
            onClick={() => setPromoOpen(false)}
            className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors touch-manipulation"
          >
            Pas maintenant
          </button>
        </div>
      </div>
    </div>
  ) : null

  // ── Carte promo (partagée desktop + mobile) ──────────────────────────────
  const PromoCard = () => (
    <div className="bg-[#1A6B4A] rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
      <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-10 -right-2 w-16 h-16 rounded-full bg-white/5" />
      <p className="text-base font-black text-white leading-snug relative z-10">Boostez votre profil</p>
      <p className="text-xs text-white/70 leading-relaxed relative z-10">
        Les étudiants certifiés ont 3× plus de chances d&apos;être sélectionnés.
      </p>
      <button
        type="button"
        onClick={() => setPromoOpen(true)}
        className="relative z-10 flex items-center gap-1.5 mt-1 px-3 py-2 rounded-xl bg-white text-[#1A6B4A] text-xs font-bold hover:bg-green-50 transition-colors w-fit touch-manipulation"
      >
        <ShieldCheck size={13} />
        En savoir plus
      </button>
    </div>
  )

  // ── Contenu filtres (partagé desktop + mobile) ──────────────────────────
  const FiltersContent = () => (
    <div className="flex flex-col gap-5">

      {/* Budget */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Budget maximum</p>
          <span className="text-xs font-bold text-[#1A6B4A] bg-green-50 px-2 py-0.5 rounded-lg">
            {budgetVal >= BUDGET_MAX
              ? "75 000+ FCFA"
              : `${new Intl.NumberFormat("fr-FR").format(budgetVal)} FCFA`}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="relative h-6 flex items-center">
            {/* Track */}
            <div className="w-full h-2 rounded-full bg-gray-100 relative overflow-visible">
              <div
                className="absolute left-0 top-0 h-full bg-[#1A6B4A] rounded-full"
                style={{ width: `${pct}%` }}
              />
              {/* Thumb visible */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#1A6B4A] shadow-md transition-all"
                style={{ left: `calc(${pct}% - 10px)` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={BUDGET_MAX}
              step={2500}
              value={budgetVal}
              onChange={(e) =>
                updateParam("budget", e.target.value === String(BUDGET_MAX) ? "" : e.target.value)
              }
              className="absolute inset-0 w-full opacity-0 cursor-grab active:cursor-grabbing h-full"
              style={{ zIndex: 1 }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 font-medium">
            <span>0 FCFA</span>
            <span className="flex items-center gap-0.5 text-gray-400">⟵ glisser ⟶</span>
            <span>75 000+ FCFA</span>
          </div>
        </div>
      </div>

      {/* Localisation */}
      <div className="flex flex-col gap-2.5">
        <p className="text-sm font-semibold text-gray-800">Localisation</p>
        {CITIES.map((city) => {
          const isChecked = cities.includes(city)
          return (
            <label
              key={city}
              onClick={() => toggleCity(city)}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${
                  isChecked
                    ? "bg-[#1A6B4A] border-[#1A6B4A]"
                    : "border-gray-300 group-hover:border-[#1A6B4A]"
                }`}
              >
                {isChecked && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
              <span className={`text-sm cursor-pointer transition-colors ${isChecked ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                {city}
              </span>
            </label>
          )
        })}
      </div>

      {/* Urgence */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-800">Urgence</p>
        <button
          type="button"
          onClick={() => updateParam("urgency", urgency === "high" ? "" : "high")}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors touch-manipulation ${
            urgency === "high"
              ? "bg-red-100 text-red-700 border border-red-200"
              : "bg-gray-50 text-gray-600 border border-gray-200 hover:border-red-200 hover:text-red-600"
          }`}
        >
          <Zap size={13} className={urgency === "high" ? "text-red-600" : "text-gray-400"} />
          Urgent (moins de 24h)
        </button>
        <button
          type="button"
          onClick={() => updateParam("urgency", urgency === "medium" ? "" : "medium")}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors touch-manipulation ${
            urgency === "medium"
              ? "bg-amber-100 text-amber-700 border border-amber-200"
              : "bg-gray-50 text-gray-600 border border-gray-200 hover:border-amber-200 hover:text-amber-600"
          }`}
        >
          <Clock size={13} className={urgency === "medium" ? "text-amber-500" : "text-gray-400"} />
          Cette semaine
        </button>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={reset}
        className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:border-red-200 hover:text-red-500 transition-colors touch-manipulation"
      >
        Réinitialiser les filtres
      </button>
    </div>
  )

  return (
    <>
      {/* ── Popup certification ───────────────────────────────────────── */}
      <PromoModal />

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-5">
            Filtres avancés
          </p>
          <FiltersContent />
        </div>

        {/* Promo card desktop */}
        <PromoCard />
      </aside>

      {/* ── Bouton Filtres (mobile only) ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300 transition-colors touch-manipulation relative shrink-0"
      >
        <SlidersHorizontal size={14} />
        Filtres
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#1A6B4A] text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {activeCount}
          </span>
        )}
      </button>

      {/* ── Bottom sheet mobile ───────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sheet */}
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <p className="text-base font-black text-gray-900">Filtres</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors touch-manipulation"
              >
                <X size={18} />
              </button>
            </div>
            {/* Contenu scrollable */}
            <div className="overflow-y-auto px-5 py-4 flex-1 flex flex-col gap-5">
              <FiltersContent />
              <PromoCard />
            </div>
            {/* Bouton appliquer */}
            <div className="px-5 pb-6 pt-3 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-full py-3.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors touch-manipulation"
              >
                Voir les résultats
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
