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
  Plus,
  LogOut,
  LifeBuoy,
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

const CLIENT_ITEMS = [
  { label: "Dashboard",          href: "/client/dashboard",  icon: LayoutDashboard },
  { label: "Mes missions",       href: "/client/missions",   icon: Briefcase,     exact: false, excludes: ["/client/missions/new"] },
  { label: "Nouvelle mission",   href: "/client/missions/new", icon: Plus,        exact: true },
  { label: "Messages",           href: "/client/messages",   icon: MessageSquare },
  { label: "Profil",             href: "/client/profile",    icon: User },
]

export function Sidebar({ role = "student", profile, userId, unreadCount: initialUnreadCount = 0 }) {
  const pathname    = usePathname()
  const items       = role === "client" ? CLIENT_ITEMS : STUDENT_ITEMS
  const unreadCount = useUnreadCount(userId, initialUnreadCount)
  const subtitle = role === "client" ? "Espace client" : "Espace étudiant"
  const homeHref = role === "client" ? "/client/dashboard" : "/dashboard"
  const messagesHref = role === "client" ? "/client/messages" : "/messages"

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white border-r border-gray-100 h-screen sticky top-0 overflow-y-auto">

      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href={homeHref} className="flex items-center gap-2.5">
          <Logo size="md" />
          <p className="text-xs text-gray-400 font-medium">{subtitle}</p>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {items.map(({ label, href, icon: Icon, exact, excludes }) => {
          const excluded = excludes?.some((ex) => pathname === ex || pathname.startsWith(ex + "/")) ?? false
          const isActive = !excluded && (
            exact
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/")
          )
          const isMessages = href === messagesHref

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
