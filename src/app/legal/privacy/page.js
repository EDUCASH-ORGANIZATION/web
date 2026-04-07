import Link from "next/link"
import { PublicNavbar } from "@/components/home/public-navbar"
import { PublicFooter } from "@/components/home/public-footer"

export const metadata = {
  title: "Politique de confidentialité — EduCash",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <section className="bg-gray-50 px-4 py-12 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1A6B4A] mb-2">Légal</p>
          <h1 className="text-3xl font-extrabold text-gray-900">Politique de confidentialité</h1>
          <p className="text-sm text-gray-500 mt-2">Dernière mise à jour : 6 avril 2025</p>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">

          <LegalSection title="1. Responsable du traitement">
            <p>
              EduCash SAS, dont le siège est situé à Cotonou (Haie Vive), Bénin,
              est responsable du traitement de vos données personnelles.
              Contact DPO : <span className="font-medium">privacy@educash.bj</span>
            </p>
          </LegalSection>

          <LegalSection title="2. Données collectées">
            <p>Nous collectons les données suivantes :</p>
            <ul className="list-disc pl-4 flex flex-col gap-1">
              <li><strong>Données d&apos;identification :</strong> nom, prénom, adresse email</li>
              <li><strong>Données de profil :</strong> ville, numéro de téléphone, photo de profil, biographie</li>
              <li><strong>Données académiques (étudiants) :</strong> établissement, niveau d&apos;études, carte étudiante</li>
              <li><strong>Données de paiement :</strong> historique des transactions (traité par FedaPay)</li>
              <li><strong>Données de navigation :</strong> adresse IP, logs d&apos;accès, cookies</li>
            </ul>
          </LegalSection>

          <LegalSection title="3. Finalités du traitement">
            <p>Vos données sont utilisées pour :</p>
            <ul className="list-disc pl-4 flex flex-col gap-1">
              <li>Créer et gérer votre compte utilisateur</li>
              <li>Mettre en relation étudiants et clients</li>
              <li>Vérifier le statut étudiant et prévenir la fraude</li>
              <li>Traiter les paiements via FedaPay</li>
              <li>Vous envoyer des notifications relatives à votre compte et vos missions</li>
              <li>Améliorer nos services et analyser l&apos;usage de la plateforme</li>
            </ul>
          </LegalSection>

          <LegalSection title="4. Base légale">
            <p>Le traitement de vos données repose sur :</p>
            <ul className="list-disc pl-4 flex flex-col gap-1">
              <li>L&apos;exécution du contrat (CGU acceptées lors de l&apos;inscription)</li>
              <li>Votre consentement (pour les communications marketing)</li>
              <li>L&apos;intérêt légitime d&apos;EduCash (sécurité, prévention de la fraude)</li>
              <li>Les obligations légales applicables</li>
            </ul>
          </LegalSection>

          <LegalSection title="5. Partage des données">
            <p>Vos données peuvent être partagées avec :</p>
            <ul className="list-disc pl-4 flex flex-col gap-1">
              <li><strong>FedaPay :</strong> traitement des paiements</li>
              <li><strong>Supabase :</strong> hébergement des données (serveurs UE)</li>
              <li><strong>Resend :</strong> envoi d&apos;emails transactionnels</li>
            </ul>
            <p>Nous ne vendons jamais vos données à des tiers à des fins publicitaires.</p>
          </LegalSection>

          <LegalSection title="6. Conservation des données">
            <p>
              Vos données sont conservées pendant toute la durée de votre inscription
              et supprimées dans un délai de <strong>30 jours</strong> suivant la clôture de votre compte,
              sauf obligations légales contraires (données comptables : 10 ans).
            </p>
          </LegalSection>

          <LegalSection title="7. Vos droits">
            <p>Conformément à la réglementation applicable, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-4 flex flex-col gap-1">
              <li><strong>Droit d&apos;accès :</strong> obtenir une copie de vos données</li>
              <li><strong>Droit de rectification :</strong> corriger des données inexactes</li>
              <li><strong>Droit à l&apos;effacement :</strong> demander la suppression de vos données</li>
              <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
              <li><strong>Droit d&apos;opposition :</strong> vous opposer à certains traitements</li>
            </ul>
            <p>Pour exercer ces droits : <span className="font-medium">privacy@educash.bj</span></p>
          </LegalSection>

          <LegalSection title="8. Cookies">
            <p>
              EduCash utilise des cookies strictement nécessaires au fonctionnement du service
              (authentification, session). Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.
            </p>
          </LegalSection>

          <LegalSection title="9. Sécurité">
            <p>
              Nous mettons en œuvre des mesures de sécurité adaptées : chiffrement des données
              en transit (HTTPS/TLS), authentification sécurisée via Supabase Auth,
              accès aux données limité au strict nécessaire.
            </p>
          </LegalSection>

          <LegalSection title="10. Contact">
            <p>
              Pour toute question relative à la protection de vos données :
              <br />
              <strong>EduCash — DPO</strong><br />
              Email : privacy@educash.bj<br />
              Adresse : Haie Vive, Cotonou, Bénin
            </p>
          </LegalSection>

        </div>

        <div className="max-w-3xl mx-auto mt-10 pt-8 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
          <Link href="/legal/terms" className="text-[#1A6B4A] hover:underline">Conditions d&apos;utilisation</Link>
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
