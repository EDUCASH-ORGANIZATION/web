import { PublicNavbar } from "@/components/home/public-navbar"
import { PublicFooter } from "@/components/home/public-footer"
import { ContactForm } from "@/components/home/contact-form"
import { Mail, MessageSquare, MapPin, Clock } from "lucide-react"

export const metadata = {
  title: "Contact — EduCash",
  description: "Contactez l'équipe EduCash pour toute question ou suggestion.",
}

const CONTACT_INFO = [
  {
    icon: Mail,
    label: "Email",
    value: "contact@educash.bj",
    desc: "Réponse sous 24h ouvrées",
  },
  {
    icon: MessageSquare,
    label: "WhatsApp",
    value: "+229 XX XX XX XX",
    desc: "Lun–Ven, 8h–18h",
  },
  {
    icon: MapPin,
    label: "Adresse",
    value: "Cotonou, Bénin",
    desc: "Haie Vive, Cotonou",
  },
  {
    icon: Clock,
    label: "Disponibilité",
    value: "Lun–Sam",
    desc: "8h – 20h (WAT)",
  },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#f0faf5] to-white px-4 py-16">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A] bg-[#dcf5e9] px-3 py-1.5 rounded-full">
            On vous répond
          </span>
          <h1 className="text-4xl font-extrabold text-gray-900">Contactez-nous</h1>
          <p className="text-base text-gray-500 max-w-md leading-relaxed">
            Une question, un problème, une suggestion ? L&apos;équipe EduCash est là pour vous.
            Écrivez-nous, on répond rapidement.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Infos */}
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Informations de contact</h2>
              <p className="text-sm text-gray-500">Plusieurs façons de nous joindre, choisissez celle qui vous convient.</p>
            </div>
            <div className="flex flex-col gap-4">
              {CONTACT_INFO.map(({ icon: Icon, label, value, desc }) => (
                <div key={label} className="flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-4">
                  <div className="w-11 h-11 rounded-xl bg-[#f0faf5] flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-[#1A6B4A]" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                    <p className="text-sm font-semibold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* FAQ rapide */}
            <div className="bg-[#f0faf5] rounded-2xl px-5 py-5 border border-[#1A6B4A]/10">
              <p className="text-sm font-semibold text-[#1A6B4A] mb-3">Questions fréquentes</p>
              {[
                "Comment vérifier mon profil étudiant ?",
                "Quels sont les délais de paiement ?",
                "Comment signaler un problème avec une mission ?",
              ].map((q) => (
                <p key={q} className="text-xs text-gray-600 py-2 border-b border-[#1A6B4A]/10 last:border-0">
                  → {q}
                </p>
              ))}
            </div>
          </div>

          {/* Formulaire */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-7">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Envoyer un message</h2>
            <ContactForm />
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
