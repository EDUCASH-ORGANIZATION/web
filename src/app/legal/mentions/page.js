import Link from "next/link"
import { LEGAL_ENTITY } from "@/components/vitrine/legal/legal-entity"
import { LegalLayout } from "@/components/vitrine/legal/legal-layout"
import { LegalSection, LegalFacts } from "@/components/vitrine/legal/legal-section"

export const metadata = {
  title: "Mentions légales",
}

const SECTIONS = {
  editeur_du_site: { id: "editeur-du-site", title: "Éditeur du site" },
  directeur_de_la_publication: { id: "directeur-de-la-publication", title: "Directeur de la publication" },
  hebergement: { id: "hebergement", title: "Hébergement" },
  propriete_intellectuelle: { id: "propriete-intellectuelle", title: "Propriété intellectuelle" },
  paiements: { id: "paiements", title: "Paiements" },
  limitation_de_responsabilite: { id: "limitation-de-responsabilite", title: "Limitation de responsabilité" },
  droit_applicable_et_juridiction: { id: "droit-applicable-et-juridiction", title: "Droit applicable et juridiction" },
  contact: { id: "contact", title: "Contact" },
}

export default function MentionsPage() {
  return (
    <LegalLayout
      current="mentions"
      title="Mentions légales"
      updatedAt="8 octobre 2026"
      sections={Object.values(SECTIONS)}
    >
      <LegalSection {...SECTIONS.editeur_du_site}>
        <p>
          Le site educash.bj est édité par {LEGAL_ENTITY.name}, {LEGAL_ENTITY.legalForm}.
          EduCash est une marque et une plateforme exploitée par {LEGAL_ENTITY.name}.
        </p>
        <LegalFacts
          items={[
            { label: "Raison sociale", value: LEGAL_ENTITY.name },
            { label: "Forme juridique", value: LEGAL_ENTITY.legalForm },
            { label: "Siège social", value: LEGAL_ENTITY.address },
            { label: "RCCM", value: LEGAL_ENTITY.rccm },
            { label: "IFU", value: LEGAL_ENTITY.ifu },
            { label: "Téléphone", value: LEGAL_ENTITY.phone },
            { label: "Email de l’éditeur", value: LEGAL_ENTITY.email },
            { label: "Email du service EduCash", value: LEGAL_ENTITY.serviceEmail },
            { label: "Site web", value: "educash.bj" },
            { label: "Site de l’éditeur", value: LEGAL_ENTITY.website },
          ]}
        />
      </LegalSection>

      <LegalSection {...SECTIONS.directeur_de_la_publication}>
        <p>Le directeur de la publication est {LEGAL_ENTITY.publisher}, exploitant de {LEGAL_ENTITY.name}.</p>
      </LegalSection>

      <LegalSection {...SECTIONS.hebergement}>
        <LegalFacts
          items={[
            { label: "Hébergeur", value: "Vercel Inc." },
            { label: "Adresse", value: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis" },
            { label: "Site", value: "vercel.com" },
          ]}
        />
        <p>
          Les données sont hébergées via Supabase (infrastructure AWS - région UE West).
        </p>
        <LegalFacts
          items={[
            { label: "Base de données", value: "Supabase Pte. Ltd." },
            { label: "Adresse", value: "65 Chulia Street #38-02/03, OCBC Centre, Singapour 049513" },
          ]}
        />
      </LegalSection>

      <LegalSection {...SECTIONS.propriete_intellectuelle}>
        <p>
          L’ensemble du contenu présent sur le site EduCash (textes, graphismes, logos,
          icônes, images, éléments sonores) est la propriété exclusive de {LEGAL_ENTITY.name}{" "}
          et est protégé par les lois nationales et internationales sur la propriété intellectuelle.
        </p>
        <p>
          Toute reproduction, représentation, modification, publication, transmission,
          dénaturation, totale ou partielle du site ou de son contenu, par quelque procédé
          que ce soit, et sur quelque support que ce soit est interdite sans autorisation écrite préalable.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.paiements}>
        <p>
          Les paiements sur la plateforme EduCash sont traités par <strong>FedaPay</strong>,
          prestataire de services de paiement agréé en Afrique de l’Ouest.
        </p>
        <LegalFacts items={[{ label: "Site FedaPay", value: "fedapay.com" }]} />
        <p>
          Les paiements d’achats effectués hors plateforme, du client au vendeur par Mobile Money,
          ne relèvent pas d’EduCash. Voir l’article 5 des{" "}
          <Link className="link" href="/legal/terms#achats">conditions d’utilisation</Link>.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.limitation_de_responsabilite}>
        <p>
          EduCash s’efforce d’assurer l’exactitude et la mise à jour des informations
          diffusées sur ce site. Toutefois, EduCash décline toute responsabilité pour les
          omissions, inexactitudes et carences dans la mise à jour, qu’elles soient de
          son fait ou du fait des tiers partenaires qui lui fournissent ces informations.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.droit_applicable_et_juridiction}>
        <p>
          Tout litige en relation avec l’utilisation du site educash.bj est soumis
          au droit béninois. Il est fait attribution exclusive de juridiction aux tribunaux
          compétents de Cotonou.
        </p>
      </LegalSection>

      <LegalSection {...SECTIONS.contact}>
        <p>
          Pour toute question : <strong>{LEGAL_ENTITY.serviceEmail}</strong>
          <br />
          {LEGAL_ENTITY.name} · {LEGAL_ENTITY.address}
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
