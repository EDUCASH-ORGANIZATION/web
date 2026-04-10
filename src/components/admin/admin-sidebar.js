"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, ShieldCheck, Users, LogOut,
  Briefcase, TrendingUp,
} from "lucide-react"
import { logout } from "@/lib/actions/auth.actions"

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/admin/dashboard",      icon: LayoutDashboard },
  { label: "Vérifications",   href: "/admin/verifications",  icon: ShieldCheck     },
  { label: "Utilisateurs",    href: "/admin/users",          icon: Users           },
  { label: "Missions",        href: "/admin/missions",       icon: Briefcase       },
]

export function AdminSidebar({ pendingCount = 0 }) {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-60 shrink-0 bg-[#1A1A2E] flex-col h-screen sticky top-0 overflow-y-auto">

      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <Link href="/admin/dashboard">
          <span className="text-xl font-black tracking-tight">
            <span className="text-[#1A6B4A]">Edu</span><span className="text-[#F59E0B]">Cash</span>
          </span>
          <p className="text-[11px] text-white/40 mt-0.5 font-medium uppercase tracking-widest">
            Administration
          </p>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#1A6B4A] text-white shadow-sm"
                  : "text-white/50 hover:bg-white/8 hover:text-white/90"
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className="flex-1">{label}</span>
              {href === "/admin/verifications" && pendingCount > 0 && (
                <span className="text-[10px] font-black bg-amber-400 text-[#1A1A2E] px-1.5 py-0.5 rounded-full min-w-5 text-center">
                  {pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:bg-white/8 hover:text-white/70 transition-all touch-manipulation cursor-pointer"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  )
}
