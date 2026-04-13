import Link from "next/link"
import { Logo } from "@/components/shared/logo"

const FOOTER_LINKS = [
  {
    title: "Produit",
    links: [
      { label: "Comment ça marche", href: "/#how-it-works" },
      { label: "Voir les missions", href: "/missions" },
      { label: "Pour les étudiants", href: "/auth/register" },
      { label: "Pour les clients", href: "/auth/register" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Conditions d'utilisation", href: "/legal/terms" },
      { label: "Politique de confidentialité", href: "/legal/privacy" },
      { label: "Mentions légales", href: "/legal/mentions" },
    ],
  },
]

export function PublicFooter() {
  return (
    <footer className="bg-[#1A1A2E] text-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 mb-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5">
              <Logo size="lg" />
              <span className="text-2xl font-black tracking-tight">
                <span className="text-[#1A6B4A]">Edu</span><span className="text-[#F59E0B]">Cash</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              La marketplace des étudiants au Bénin. Des missions rémunérées, un paiement sécurisé.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-gray-400">Service actif</span>
            </div>
          </div>

          {/* Links */}
          {FOOTER_LINKS.map(({ title, links }) => (
            <div key={title}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                {title}
              </p>
              <ul className="flex flex-col gap-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} EduCash · Fait avec ❤️ au Bénin
          </p>
          <p className="text-xs text-gray-600">
            Paiement sécurisé via FedaPay · Commission 12%
          </p>
        </div>
      </div>
    </footer>
  )
}
