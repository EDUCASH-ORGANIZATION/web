import { LEGAL_ENTITY } from "@/components/vitrine/legal/legal-entity"
import { LegalLayout } from "@/components/vitrine/legal/legal-layout"
import { LegalSection } from "@/components/vitrine/legal/legal-section"

export const metadata = {
  title: "Conditions d’utilisation - EduCash",
}

const SECTIONS = {
  objet: { id: "objet", title: "1. Objet" },
  description_du_service: { id: "description-du-service", title: "2. Description du service" },
  inscription_et_compte_utilisateur: { id: "inscription-et-compte-utilisateur", title: "3. Inscription et compte utilisateur" },
  missions_et_candidatures: { id: "missions-et-candidatures", title: "4. Missions et candidatures" },
  paiements_et_commission: { id: "paiements-et-commission", title: "5. Paiements et commission" },
  comportement_des_utilisateurs: { id: "comportement-des-utilisateurs", title: "6. Comportement des utilisateurs" },
  responsabilite: { id: "responsabilite", title: "7. Responsabilité" },
  suspension_et_resiliation: { id: "suspension-et-resiliation", title: "8. Suspension et résiliation" },
  modifications: { id: "modifications", title: "9. Modifications" },
  droit_applicable: { id: "droit-applicable", title: "10. Droit applicable" },
}

export default function TermsPage() {
  return (
    <LegalLayout
      current="terms"
      title="Conditions d’utilisation"
      updatedAt="8 octobre 2026"
      sections={Object.values(SECTIONS)}
    >
      <LegalSection {...SECTIONS.objet}>
        <p>
          Les présentes conditions générales d’utilisation (CGU) régissent l’accès et
          l’utilisation de la plateforme EduCash, accessible à l’adresse educash.bj,
          éditée par {LEGAL_ENTITY.name}, {LEGAL_ENTITY.legalForm}, dont le siège est situé à {LEGAL_ENTITY.address}.
        </p>
        <p>
          Toute inscription sur la plateforme vaut acceptation sans réserve des présentes CGU.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.description_du_service}>
        <p>
          EduCash est une marketplace mettant en relation des étudiants (prestataires) et
          des particuliers ou entreprises (clients) souhaitant confier des missions ponctuelles.
        </p>
        <p>Les types de missions proposées incluent : babysitting, livraison, saisie de données,
          community management, traduction, cours particuliers et autres prestations.</p>
      </LegalSection>

      <LegalSection {...SECTIONS.inscription_et_compte_utilisateur}>
        <p>L’accès au service requiert la création d’un compte. L’utilisateur s’engage à :</p>
        <ul>
          <li>Fournir des informations exactes et à jour</li>
          <li>Maintenir la confidentialité de ses identifiants</li>
          <li>Notifier immédiatement EduCash de tout accès non autorisé</li>
        </ul>
        <p>
          Pour les étudiants, la vérification du statut étudiant est requise via l’upload
          d’une carte étudiante valide. EduCash se réserve le droit de refuser ou de
          suspendre tout compte ne respectant pas ces conditions.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.missions_et_candidatures}>
        <p>
          Les clients publient des missions en précisant le budget, la ville, le type et la description.
          Les étudiants postulent librement. La sélection d’un candidat relève de la seule
          décision du client.
        </p>
        <p>
          EduCash ne garantit pas la conclusion d’un accord entre les parties et n’est
          pas partie au contrat conclu entre le client et l’étudiant.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.paiements_et_commission}>
        <p>
          Les paiements sont traités via FedaPay, notre partenaire de paiement sécurisé.
          EduCash perçoit une commission de <strong>12%</strong> sur chaque transaction complétée.
        </p>
        <p>
          Le paiement est déclenché par le client et conservé en séquestre jusqu’à
          validation de la mission. En cas de litige, EduCash peut intervenir en médiation.
        </p>
      
        <h3 className="ds-h4 ds-mt-4" id="achats">Missions avec achats</h3>
        <p>
          Lorsqu’une mission comprend des achats (courses, livraison), les paiements d’achats
          effectués hors plateforme, directement du client au vendeur par Mobile Money, ne relèvent
          pas d’EduCash. EduCash n’est ni partie, ni dépositaire, ni garant de ces paiements.
          Seul le service passe par le séquestre et supporte la commission.
        </p>
        <p>
          L’estimation des achats affichée sur la mission est indicative et sans commission.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.comportement_des_utilisateurs}>
        <p>Il est strictement interdit de :</p>
        <ul>
          <li>Publier des missions illégales ou contraires aux bonnes mœurs</li>
          <li>Contourner la plateforme pour effectuer des paiements directs</li>
          <li>Harceler, discriminer ou menacer d’autres utilisateurs</li>
          <li>Créer de faux profils ou fournir des informations mensongères</li>
          <li>Utiliser la plateforme à des fins commerciales non autorisées</li>
        </ul>
      </LegalSection>

      <LegalSection {...SECTIONS.responsabilite}>
        <p>
          EduCash agit en qualité d’intermédiaire de mise en relation. La responsabilité
          d’EduCash ne saurait être engagée pour les dommages résultant de l’inexécution
          ou de la mauvaise exécution d’une mission par l’étudiant.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.suspension_et_resiliation}>
        <p>
          EduCash se réserve le droit de suspendre ou résilier tout compte en cas de
          violation des présentes CGU, sans préavis ni indemnité.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.modifications}>
        <p>
          EduCash peut modifier les présentes CGU à tout moment. Les utilisateurs seront
          informés par email. La poursuite de l’utilisation du service vaut acceptation
          des nouvelles conditions.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.droit_applicable}>
        <p>
          Les présentes CGU sont soumises au droit béninois. En cas de litige, et à défaut
          de résolution amiable, les tribunaux de Cotonou seront seuls compétents.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
