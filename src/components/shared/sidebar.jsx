"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Briefcase,
  FileText,
  MessageSquare,
  User,
  Plus,
  LogOut,
} from "lucide-react"
import clsx from "clsx"
import { logout } from "@/lib/actions/auth.actions"

const STUDENT_ITEMS = [
  { label: "Accueil",       href: "/dashboard",     icon: Home },
  { label: "Missions",      href: "/missions",       icon: Briefcase },
  { label: "Candidatures",  href: "/applications",   icon: FileText },
  { label: "Messages",      href: "/messages",       icon: MessageSquare },
  { label: "Profil",        href: "/profile",        icon: User },
]

const CLIENT_ITEMS = [
  { label: "Accueil", href: "/client/dashboard", icon: Home },
  { label: "Mes missions", href: "/client/missions", icon: Briefcase },
  { label: "Nouvelle mission", href: "/client/missions/new", icon: Plus },
  { label: "Messages", href: "/client/messages", icon: MessageSquare },
  { label: "Profil", href: "/client/profile", icon: User },
]

function Logo() {
  return (
    <span className="text-xl font-bold tracking-tight">
      <span className="text-[#1A6B4A]">Edu</span>
      <span className="text-[#F59E0B]">Cash</span>
    </span>
  )
}

export function Sidebar({ role = "student", profile, unreadCount = 0 }) {
  const pathname = usePathname()
  const items = role === "client" ? CLIENT_ITEMS : STUDENT_ITEMS

  const messagesHref = role === "client" ? "/client/messages" : "/student/messages"

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-gray-100 bg-white h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href={role === "client" ? "/client/dashboard" : "/dashboard"}>
          <Logo />
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {items.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          const isMessages = href === messagesHref

          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#f0faf5] text-[#1A6B4A]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2.5 : 1.75}
                aria-hidden="true"
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

      {/* Profile footer + logout */}
      <div className="border-t border-gray-100">
        {profile && (
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xs font-bold">
                  {profile.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{role === "client" ? "Client" : "Étudiant"}</p>
            </div>
          </div>
        )}
        <form action={logout} className="px-3 pb-4">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors touch-manipulation md:cursor-pointer"
          >
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>Déconnexion</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
