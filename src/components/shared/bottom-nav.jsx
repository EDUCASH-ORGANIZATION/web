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
} from "lucide-react"
import clsx from "clsx"
import { useUnreadCount } from "@/hooks/use-unread-count"

const STUDENT_ITEMS = [
  { label: "Accueil",      href: "/dashboard",    icon: Home },
  { label: "Missions",     href: "/student/missions", icon: Briefcase },
  { label: "Candidatures", href: "/applications",  icon: FileText },
  { label: "Messages",     href: "/messages",      icon: MessageSquare },
  { label: "Profil",       href: "/profile",       icon: User },
]

const CLIENT_ITEMS = [
  { label: "Accueil", href: "/client/dashboard", icon: Home },
  { label: "Mes missions", href: "/client/missions", icon: Briefcase },
  { label: "Nouveau", href: "/client/missions/new", icon: Plus },
  { label: "Messages", href: "/client/messages", icon: MessageSquare },
  { label: "Profil", href: "/client/profile", icon: User },
]

export function BottomNav({ role = "student", userId, unreadCount: initialUnreadCount = 0 }) {
  const pathname     = usePathname()
  const items        = role === "client" ? CLIENT_ITEMS : STUDENT_ITEMS
  const messagesHref = role === "client" ? "/client/messages" : "/messages"
  const unreadCount  = useUnreadCount(userId, initialUnreadCount)

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {items.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          const isMessages = href === messagesHref
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full px-1 transition-colors",
                isActive ? "text-[#1A6B4A]" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  aria-hidden="true"
                />
                {isMessages && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
