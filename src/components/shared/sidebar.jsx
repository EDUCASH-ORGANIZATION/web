"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  MessageSquare,
  User,
  LogOut,
  LifeBuoy,
  Wallet,
} from "lucide-react"
import clsx from "clsx"
import { logout } from "@/lib/actions/auth.actions"
import { useUnreadCount } from "@/hooks/use-unread-count"
import { Logo } from "@/components/shared/logo"

const STUDENT_ITEMS = [
  { label: "Dashboard",          href: "/dashboard",    icon: LayoutDashboard },
  { label: "Explorer les missions", href: "/student/missions", icon: Briefcase },
  { label: "Mes candidatures",   href: "/applications", icon: FileText },
  { label: "Messages",           href: "/messages",     icon: MessageSquare },
  { label: "Mon profil",         href: "/profile",      icon: User },
]

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

export function Sidebar({ profile, userId, unreadCount: initialUnreadCount = 0, walletAvailable = 0 }) {
  const pathname    = usePathname()
  const unreadCount = useUnreadCount(userId, initialUnreadCount)

  const walletColor = walletAvailable >= 5000
    ? "text-[#1A6B4A]"
    : walletAvailable >= 2000
      ? "text-amber-500"
      : "text-red-500"

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white border-r border-gray-100 h-screen sticky top-0 overflow-y-auto">

      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo size="md" />
          <p className="text-xs text-gray-400 font-medium">Espace étudiant</p>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {STUDENT_ITEMS.map(({ label, href, icon: Icon, exact, excludes }) => {
          const excluded = excludes?.some((ex) => pathname === ex || pathname.startsWith(ex + "/")) ?? false
          const isActive = !excluded && (
            exact
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/")
          )
          const isMessages = href === "/messages"

          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-[#1A6B4A] text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2 : 1.75}
                className={isActive ? "text-white" : "text-gray-400"}
              />
              <span className="flex-1">{label}</span>
              {isMessages && unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Mini wallet */}
      <div className="border-t border-gray-100 px-4 py-3">
        <Link
          href="/wallet"
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
        >
          <Wallet size={14} className={walletColor} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">
              Mon portefeuille
            </p>
            <p className={`text-xs font-bold leading-none ${walletColor}`}>
              {fmt(walletAvailable)} FCFA
            </p>
          </div>
        </Link>
      </div>

      {/* Bas : aide + déconnexion */}
      <div className="border-t border-gray-100 px-5 py-5 flex flex-col gap-3">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Besoin d&apos;aide ?
          </p>
          <Link
            href="/contact"
            className="flex items-center gap-2 text-sm font-semibold text-[#1A6B4A] hover:underline"
          >
            <LifeBuoy size={15} />
            Centre d&apos;assistance
          </Link>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-500 transition-colors touch-manipulation cursor-pointer"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  )
}
