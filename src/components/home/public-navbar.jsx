"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import clsx from "clsx"

const NAV_LINKS = [
  { label: "Accueil", href: "/" },
  { label: "Comment ça marche", href: "/#how-it-works" },
  { label: "Missions", href: "/missions" },
  { label: "À propos", href: "/about" },
]

function MobileMenu({ open, onClose }) {
  // Bloque le scroll body quand ouvert
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!open) return null

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
      {/* Fond */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", touchAction: "manipulation" }}
        onClick={onClose}
      />
      {/* Panneau */}
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: "280px",
        background: "#fff", display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.12)"
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-[#1A6B4A]">Edu</span>
            <span className="text-[#F59E0B]">Cash</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors touch-manipulation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Liens */}
        <nav className="flex flex-col gap-1 p-4 flex-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              className="text-sm font-medium text-gray-700 hover:text-[#1A6B4A] hover:bg-[#f0faf5] px-4 py-3 rounded-xl transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* CTAs */}
        <div className="flex flex-col gap-2 p-4 border-t border-gray-100">
          <Link
            href="/auth/login"
            onClick={onClose}
            className="text-center text-sm font-medium text-gray-700 border border-gray-200 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Se connecter
          </Link>
          <Link
            href="/auth/register"
            onClick={onClose}
            className="text-center text-sm font-semibold text-white bg-[#1A6B4A] hover:bg-[#155a3d] px-4 py-3 rounded-xl transition-colors"
          >
            S&apos;inscrire gratuitement
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function PublicNavbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    function onScroll() { setScrolled(window.scrollY > 10) }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      <header
        className={clsx(
          "sticky top-0 z-40 transition-all duration-200",
          scrolled
            ? "bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100"
            : "bg-white border-b border-gray-100"
        )}
      >
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold tracking-tight shrink-0">
            <span className="text-[#1A6B4A]">Edu</span>
            <span className="text-[#F59E0B]">Cash</span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "text-sm px-3 py-2 rounded-lg transition-colors",
                  pathname === href
                    ? "text-[#1A6B4A] font-semibold bg-[#f0faf5]"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Actions desktop */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/auth/register"
              className="text-sm font-semibold text-white bg-[#1A6B4A] hover:bg-[#155a3d] px-4 py-2 rounded-lg transition-colors"
            >
              S&apos;inscrire
            </Link>
          </div>

          {/* Bouton hamburger */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors touch-manipulation"
            aria-label="Ouvrir le menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Portal — monte directement sur document.body, immunisé contre tout stacking context */}
      {mounted && <MobileMenu open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
