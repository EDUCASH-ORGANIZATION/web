"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef } from "react"
import { Search, Bell, Settings, ShieldCheck } from "lucide-react"
import { VerifiedAvatar } from "@/components/shared/verified-avatar"

/**
 * @param {{
 *   profile: {
 *     full_name:     string,
 *     avatar_url:    string | null,
 *     is_verified:   boolean,
 *     verified_until: string | null,
 *   },
 *   school: string | null,
 * }} props
 */
export function StudentHeader({ profile, school }) {
  const router   = useRouter()
  const inputRef = useRef(null)

  function handleSearch(e) {
    e.preventDefault()
    const q = inputRef.current?.value.trim()
    if (q) router.push(`/missions?search=${encodeURIComponent(q)}`)
    else router.push("/missions")
  }

  const displayName = profile?.full_name
    ? profile.full_name.split(" ").slice(0, 2).map((p, i) => i === 1 ? p.charAt(0) + "." : p).join(" ")
    : "Étudiant"

  const institution = school ? `ÉTUDIANT · ${school.toUpperCase()}` : "ÉTUDIANT · EDUCASH"

  const isVerified   = profile?.is_verified ?? false
  const verifiedUntil = profile?.verified_until ?? null
  const isStillValid = !verifiedUntil || new Date(verifiedUntil) > new Date()
  const showBadge    = isVerified && isStillValid

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 w-full">

      {/* Barre de recherche */}
      <form onSubmit={handleSearch} className="flex-1 min-w-0">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher une mission, un tuteur…"
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 focus:border-[#1A6B4A] transition-colors"
          />
        </div>
      </form>

      {/* Icônes actions */}
      <div className="flex items-center gap-1">
        <Link
          href="/notifications"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.75} />
        </Link>
        <Link
          href="/profile"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          aria-label="Paramètres"
        >
          <Settings size={18} strokeWidth={1.75} />
        </Link>
      </div>

      {/* Profil utilisateur */}
      <Link href="/profile" className="flex items-center gap-2.5 pl-2 border-l border-gray-100">
        {/* Nom + statut (desktop uniquement) */}
        <div className="text-right hidden sm:flex flex-col items-end gap-0.5">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{displayName}</p>
          {showBadge ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1A6B4A] leading-tight">
              <ShieldCheck size={10} strokeWidth={2.5} />
              Vérifié
            </span>
          ) : (
            <p className="text-[10px] text-gray-400 font-medium tracking-wide leading-tight">
              {institution}
            </p>
          )}
        </div>

        {/* Avatar avec badge de vérification */}
        <VerifiedAvatar
          avatarUrl={profile?.avatar_url}
          fullName={profile?.full_name ?? ""}
          isVerified={isVerified}
          verifiedUntil={verifiedUntil}
          size="sm"
          showBadge
        />
      </Link>
    </header>
  )
}
