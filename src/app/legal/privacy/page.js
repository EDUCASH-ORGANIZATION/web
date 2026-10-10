import { LEGAL_ENTITY } from "@/components/vitrine/legal/legal-entity"
import { LegalLayout } from "@/components/vitrine/legal/legal-layout"
import { LegalSection } from "@/components/vitrine/legal/legal-section"

export const metadata = {
  title: "Politique de confidentialité",
}

const SECTIONS = {
  responsable_du_traitement: { id: "responsable-du-traitement", title: "1. Responsable du traitement" },
  donnees_collectees: { id: "donnees-collectees", title: "2. Données collectées" },
  finalites_du_traitement: { id: "finalites-du-traitement", title: "3. Finalités du traitement" },
  base_legale: { id: "base-legale", title: "4. Base légale" },
  partage_des_donnees: { id: "partage-des-donnees", title: "5. Partage des données" },
  conservation_des_donnees: { id: "conservation-des-donnees", title: "6. Conservation des données" },
  vos_droits: { id: "vos-droits", title: "7. Vos droits" },
  cookies: { id: "cookies", title: "8. Cookies" },
  securite: { id: "securite", title: "9. Sécurité" },
  contact: { id: "contact", title: "10. Contact" },
}

export default function PrivacyPage() {
  return (
    <LegalLayout
      current="privacy"
      title="Politique de confidentialité"
      updatedAt="8 octobre 2026"
      sections={Object.values(SECTIONS)}
    >
      <LegalSection {...SECTIONS.responsable_du_traitement}>
        <p>
          {LEGAL_ENTITY.name}, éditeur d’EduCash, dont le siège est situé à {LEGAL_ENTITY.address},
          est responsable du traitement de vos données personnelles.
          Contact DPO : contact@educash.bj
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.donnees_collectees}>
        <p>Nous collectons les données suivantes :</p>
        <ul>
          <li><strong>Données d’identification :</strong> nom, prénom, adresse email</li>
          <li><strong>Données de profil :</strong> ville, numéro de téléphone, photo de profil, biographie</li>
          <li><strong>Données académiques (étudiants) :</strong> établissement, niveau d’études, carte étudiante</li>
          <li><strong>Formulaire de contact :</strong> nom, adresse email, sujet et message</li>
          <li><strong>Données de paiement :</strong> historique des transactions (traité par notre prestataire de paiement agréé)</li>
          <li><strong>Données de navigation :</strong> adresse IP, logs d’accès, cookies</li>
        </ul>
      </LegalSection>

      <LegalSection {...SECTIONS.finalites_du_traitement}>
        <p>Vos données sont utilisées pour :</p>
        <ul>
          <li>Créer et gérer votre compte utilisateur</li>
          <li>Mettre en relation étudiants et clients</li>
          <li>Vérifier le statut étudiant et prévenir la fraude</li>
          <li>Traiter les paiements via notre prestataire de paiement agréé</li>
          <li>Répondre aux demandes envoyées via le formulaire de contact, transmises par notre prestataire d’email Resend</li>
          <li>Vous envoyer des notifications relatives à votre compte et vos missions</li>
          <li>Améliorer nos services et analyser l’usage de la plateforme</li>
        </ul>
      </LegalSection>

      <LegalSection {...SECTIONS.base_legale}>
        <p>Le traitement de vos données repose sur :</p>
        <ul>
          <li>L’exécution du contrat (CGU acceptées lors de l’inscription)</li>
          <li>Votre consentement (pour les communications marketing)</li>
          <li>L’intérêt légitime d’EduCash (sécurité, prévention de la fraude)</li>
          <li>Les obligations légales applicables</li>
        </ul>
      </LegalSection>

      <LegalSection {...SECTIONS.partage_des_donnees}>
        <p>Vos données peuvent être partagées avec :</p>
        <ul>
          <li><strong>Prestataire de paiement agréé :</strong> traitement des paiements</li>
          <li><strong>Supabase :</strong> hébergement des données (serveurs UE)</li>
          <li><strong>Resend :</strong> envoi d’emails transactionnels</li>
        </ul>
        <p>Nous ne vendons jamais vos données à des tiers à des fins publicitaires.</p>
      </LegalSection>

      <LegalSection {...SECTIONS.conservation_des_donnees}>
        <p>
          Vos données sont conservées pendant toute la durée de votre inscription
          et supprimées dans un délai de <strong>30 jours</strong> suivant la clôture de votre compte,
          sauf obligations légales contraires (données comptables : 10 ans).
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.vos_droits}>
        <p>Conformément à la réglementation applicable, vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d’accès :</strong> obtenir une copie de vos données</li>
          <li><strong>Droit de rectification :</strong> corriger des données inexactes</li>
          <li><strong>Droit à l’effacement :</strong> demander la suppression de vos données</li>
          <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
          <li><strong>Droit d’opposition :</strong> vous opposer à certains traitements</li>
        </ul>
        <p>Pour exercer ces droits : contact@educash.bj</p>
      </LegalSection>

      <LegalSection {...SECTIONS.cookies}>
        <p>
          EduCash utilise des cookies strictement nécessaires au fonctionnement du service
          (authentification, session). Aucun cookie publicitaire ou de tracking tiers n’est utilisé.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.securite}>
        <p>
          Nous mettons en œuvre des mesures de sécurité adaptées : chiffrement des données
          en transit (HTTPS/TLS), authentification sécurisée via Supabase Auth,
          accès aux données limité au strict nécessaire.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.contact}>
        <p>
          Pour toute question relative à la protection de vos données :
          <br />
          <strong>EduCash - DPO</strong>
          <br />
          Email : contact@educash.bj<br />
          Adresse : {LEGAL_ENTITY.address}
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
