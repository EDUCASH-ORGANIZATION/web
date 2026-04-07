import Link from "next/link"
import { PublicNavbar } from "@/components/home/public-navbar"
import { PublicFooter } from "@/components/home/public-footer"

export const metadata = {
  title: "Mentions légales — EduCash",
}

export default function MentionsPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <section className="bg-gray-50 px-4 py-12 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A] mb-2">Légal</p>
          <h1 className="text-3xl font-extrabold text-gray-900">Mentions légales</h1>
          <p className="text-sm text-gray-500 mt-2">Dernière mise à jour : 6 avril 2025</p>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">

          <LegalSection title="Éditeur du site">
            <Row label="Raison sociale" value="EduCash SAS" />
            <Row label="Siège social" value="Haie Vive, Cotonou, Bénin" />
            <Row label="Email" value="contact@educash.bj" />
            <Row label="Site web" value="educash.bj" />
          </LegalSection>

          <LegalSection title="Directeur de la publication">
            <p>Le directeur de la publication est le représentant légal de EduCash SAS.</p>
          </LegalSection>

          <LegalSection title="Hébergement">
            <Row label="Hébergeur" value="Vercel Inc." />
            <Row label="Adresse" value="340 S Lemon Ave #4133, Walnut, CA 91789, USA" />
            <Row label="Site" value="vercel.com" />
            <p className="mt-2">
              Les données sont hébergées via Supabase (infrastructure AWS — région UE West).
            </p>
          </LegalSection>

          <LegalSection title="Propriété intellectuelle">
            <p>
              L&apos;ensemble du contenu présent sur le site EduCash (textes, graphismes, logos,
              icônes, images, éléments sonores) est la propriété exclusive de EduCash SAS
              et est protégé par les lois nationales et internationales sur la propriété intellectuelle.
            </p>
            <p>
              Toute reproduction, représentation, modification, publication, transmission,
              dénaturation, totale ou partielle du site ou de son contenu, par quelque procédé
              que ce soit, et sur quelque support que ce soit est interdite sans autorisation écrite préalable.
            </p>
          </LegalSection>

          <LegalSection title="Paiements">
            <p>
              Les paiements sur la plateforme EduCash sont traités par <strong>FedaPay</strong>,
              prestataire de services de paiement agréé en Afrique de l&apos;Ouest.
            </p>
            <Row label="Site FedaPay" value="fedapay.com" />
          </LegalSection>

          <LegalSection title="Limitation de responsabilité">
            <p>
              EduCash s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations
              diffusées sur ce site. Toutefois, EduCash décline toute responsabilité pour les
              omissions, inexactitudes et carences dans la mise à jour, qu&apos;elles soient de
              son fait ou du fait des tiers partenaires qui lui fournissent ces informations.
            </p>
          </LegalSection>

          <LegalSection title="Droit applicable et juridiction">
            <p>
              Tout litige en relation avec l&apos;utilisation du site educash.bj est soumis
              au droit béninois. Il est fait attribution exclusive de juridiction aux tribunaux
              compétents de Cotonou.
            </p>
          </LegalSection>

          <LegalSection title="Contact">
            <p>
              Pour toute question : <strong>contact@educash.bj</strong><br />
              EduCash SAS · Haie Vive · Cotonou · Bénin
            </p>
          </LegalSection>

        </div>

        <div className="max-w-3xl mx-auto mt-10 pt-8 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
          <Link href="/legal/terms" className="text-[#1A6B4A] hover:underline">Conditions d&apos;utilisation</Link>
          <Link href="/legal/privacy" className="text-[#1A6B4A] hover:underline">Politique de confidentialité</Link>
          <Link href="/contact" className="text-[#1A6B4A] hover:underline">Nous contacter</Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}

function LegalSection({ title, children }) {
  return (
    <div>
      <h2 className="text-base font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed flex flex-col gap-2">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="font-medium text-gray-700 w-36 shrink-0">{label} :</span>
      <span>{value}</span>
    </div>
  )
}
