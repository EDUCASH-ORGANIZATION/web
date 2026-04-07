import Link from "next/link"
import { PublicNavbar } from "@/components/home/public-navbar"
import { PublicFooter } from "@/components/home/public-footer"

export const metadata = {
  title: "Conditions d'utilisation — EduCash",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <section className="bg-gray-50 px-4 py-12 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A] mb-2">Légal</p>
          <h1 className="text-3xl font-extrabold text-gray-900">Conditions d&apos;utilisation</h1>
          <p className="text-sm text-gray-500 mt-2">Dernière mise à jour : 6 avril 2025</p>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto prose prose-sm prose-gray max-w-none">

          <div className="flex flex-col gap-8">

            <LegalSection title="1. Objet">
              <p>
                Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et
                l&apos;utilisation de la plateforme EduCash, accessible à l&apos;adresse educash.bj,
                éditée par la société EduCash SAS, dont le siège est situé à Cotonou, Bénin.
              </p>
              <p>
                Toute inscription sur la plateforme vaut acceptation sans réserve des présentes CGU.
              </p>
            </LegalSection>

            <LegalSection title="2. Description du service">
              <p>
                EduCash est une marketplace mettant en relation des étudiants (prestataires) et
                des particuliers ou entreprises (clients) souhaitant confier des missions ponctuelles.
              </p>
              <p>Les types de missions proposées incluent : babysitting, livraison, aide administrative,
                saisie de données, community management, traduction, cours particuliers et autres prestations.</p>
            </LegalSection>

            <LegalSection title="3. Inscription et compte utilisateur">
              <p>L&apos;accès au service requiert la création d&apos;un compte. L&apos;utilisateur s&apos;engage à :</p>
              <ul>
                <li>Fournir des informations exactes et à jour</li>
                <li>Maintenir la confidentialité de ses identifiants</li>
                <li>Notifier immédiatement EduCash de tout accès non autorisé</li>
              </ul>
              <p>
                Pour les étudiants, la vérification du statut étudiant est requise via l&apos;upload
                d&apos;une carte étudiante valide. EduCash se réserve le droit de refuser ou de
                suspendre tout compte ne respectant pas ces conditions.
              </p>
            </LegalSection>

            <LegalSection title="4. Missions et candidatures">
              <p>
                Les clients publient des missions en précisant le budget, la ville, le type et la description.
                Les étudiants postulent librement. La sélection d&apos;un candidat relève de la seule
                décision du client.
              </p>
              <p>
                EduCash ne garantit pas la conclusion d&apos;un accord entre les parties et n&apos;est
                pas partie au contrat conclu entre le client et l&apos;étudiant.
              </p>
            </LegalSection>

            <LegalSection title="5. Paiements et commission">
              <p>
                Les paiements sont traités via FedaPay, notre partenaire de paiement sécurisé.
                EduCash perçoit une commission de <strong>12%</strong> sur chaque transaction complétée.
              </p>
              <p>
                Le paiement est déclenché par le client et conservé en séquestre jusqu&apos;à
                validation de la mission. En cas de litige, EduCash peut intervenir en médiation.
              </p>
            </LegalSection>

            <LegalSection title="6. Comportement des utilisateurs">
              <p>Il est strictement interdit de :</p>
              <ul>
                <li>Publier des missions illégales ou contraires aux bonnes mœurs</li>
                <li>Contourner la plateforme pour effectuer des paiements directs</li>
                <li>Harceler, discriminer ou menacer d&apos;autres utilisateurs</li>
                <li>Créer de faux profils ou fournir des informations mensongères</li>
                <li>Utiliser la plateforme à des fins commerciales non autorisées</li>
              </ul>
            </LegalSection>

            <LegalSection title="7. Responsabilité">
              <p>
                EduCash agit en qualité d&apos;intermédiaire de mise en relation. La responsabilité
                d&apos;EduCash ne saurait être engagée pour les dommages résultant de l&apos;inexécution
                ou de la mauvaise exécution d&apos;une mission par l&apos;étudiant.
              </p>
            </LegalSection>

            <LegalSection title="8. Suspension et résiliation">
              <p>
                EduCash se réserve le droit de suspendre ou résilier tout compte en cas de
                violation des présentes CGU, sans préavis ni indemnité.
              </p>
            </LegalSection>

            <LegalSection title="9. Modifications">
              <p>
                EduCash peut modifier les présentes CGU à tout moment. Les utilisateurs seront
                informés par email. La poursuite de l&apos;utilisation du service vaut acceptation
                des nouvelles conditions.
              </p>
            </LegalSection>

            <LegalSection title="10. Droit applicable">
              <p>
                Les présentes CGU sont soumises au droit béninois. En cas de litige, et à défaut
                de résolution amiable, les tribunaux de Cotonou seront seuls compétents.
              </p>
            </LegalSection>

          </div>
        </div>

        <div className="max-w-3xl mx-auto mt-10 pt-8 border-t border-gray-100 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/privacy" className="text-[#1A6B4A] hover:underline">Politique de confidentialité</Link>
          <Link href="/legal/mentions" className="text-[#1A6B4A] hover:underline">Mentions légales</Link>
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
