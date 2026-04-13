"use client"

import { useState } from "react"
import Link from "next/link"
import * as Dialog from "@radix-ui/react-dialog"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo as LogoImg } from "@/components/shared/logo"

const NAV_LINKS = [
  { label: "Accueil", href: "/" },
  { label: "Comment ça marche", href: "/#how-it-works" },
  { label: "Missions", href: "/missions" },
  { label: "À propos", href: "/about" },
]

function Logo() {
  return <LogoImg size="md" href="/" />
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 hover:text-[#1A6B4A] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Link href="/auth/login">Se connecter</Link>
          </Button>
          <Button variant="primary" size="sm">
            <Link href="/auth/register">S&apos;inscrire</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Trigger asChild>
            <button
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
            <Dialog.Content className="fixed top-0 right-0 bottom-0 z-50 w-72 bg-white shadow-xl flex flex-col p-6 gap-6 focus:outline-none">
              <div className="flex items-center justify-between">
                <Logo />
                <Dialog.Close className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" aria-label="Fermer">
                  <X size={20} />
                </Dialog.Close>
              </div>

              <nav className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-[#1A6B4A] transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-2">
                <Button variant="secondary" fullWidth>
                  <Link href="/auth/login" onClick={() => setMobileOpen(false)}>Se connecter</Link>
                </Button>
                <Button variant="primary" fullWidth>
                  <Link href="/auth/register" onClick={() => setMobileOpen(false)}>S&apos;inscrire</Link>
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  )
}
