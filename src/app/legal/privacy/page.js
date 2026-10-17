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
  demandes_d_achats: { id: "demandes-d-achats", title: "7. Demandes d’achats" },
  analyse_des_messages: { id: "analyse-des-messages", title: "8. Analyse des messages" },
  vos_droits: { id: "vos-droits", title: "9. Vos droits" },
  cookies: { id: "cookies", title: "10. Cookies" },
  securite: { id: "securite", title: "11. Sécurité" },
  contact: { id: "contact", title: "12. Contact" },
}

export default function PrivacyPage() {
  return (
    <LegalLayout
      current="privacy"
      title="Politique de confidentialité"
      updatedAt="17 octobre 2026"
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
        <ul>
          <li>
            <strong>Compte :</strong> vos données sont conservées pendant toute la durée de votre
            inscription.
          </li>
          <li>
            <strong>Clôture du compte :</strong> vous pouvez demander la clôture de votre compte à
            contact@educash.bj. La demande est traitée dans un délai de <strong>30 jours</strong>.
            Les fichiers associés au compte (photo de profil, carte étudiante, photos et messages
            vocaux envoyés, preuves d’achats) qui ne sont plus utilisés sont ensuite supprimés
            automatiquement dès qu’ils ne sont plus utilisés, et jamais moins de <strong>7 jours</strong> après leur envoi.
          </li>
          <li>
            <strong>Données comptables :</strong> les transactions et les mouvements du portefeuille
            sont conservés pendant <strong>10 ans</strong>, conformément aux obligations comptables
            (OHADA). Tant que ces données doivent être conservées, la clôture de votre compte ne les
            efface pas.
          </li>
          <li>
            <strong>Fichiers qui ne sont plus utilisés :</strong> une photo remplacée, une carte
            refusée, un envoi abandonné ou une preuve remplacée sont supprimés automatiquement
            dès qu’ils ne sont plus utilisés, et jamais moins de <strong>7 jours</strong> après leur envoi.
          </li>
          <li>
            <strong>Journal de détection et signalements :</strong> supprimés automatiquement
            selon les durées indiquées à la section « Analyse des messages » : 180 jours pour le
            journal, 12 mois après clôture pour les signalements.
          </li>
          <li>
            <strong>Messages vocaux, photos et autres médias de messagerie :</strong> aucune durée
            de conservation n’est fixée pour ces fichiers tant qu’ils restent utilisés ; ils sont
            supprimés automatiquement dès qu’ils ne sont plus utilisés, et jamais moins de 7 jours après leur envoi.
          </li>
        </ul>
      </LegalSection>

      <LegalSection {...SECTIONS.demandes_d_achats}>
        <p>
          Lorsqu’une mission comprend des achats, l’étudiant retenu peut envoyer au client une
          demande d’achats à payer, et le client y joint la preuve de son paiement. Ces
          échanges reposent sur les données suivantes : le numéro à payer, le nom du vendeur, le
          montant, les articles s’ils sont indiqués, la photo du numéro marchand ou du panneau du
          vendeur, la photo du ticket et la capture du SMS de paiement. Ces éléments peuvent
          concerner des tiers, notamment des vendeurs : leur numéro, leur nom et leur panneau.
        </p>
        <ul>
          <li>
            <strong>Finalité :</strong> permettre le paiement direct des achats au vendeur, hors
            EduCash, en gardant une trace des échanges entre les deux parties, et traiter les
            signalements.
          </li>
          <li>
            <strong>Accès :</strong> les deux parties de la mission et l’équipe d’administration
            d’EduCash, pour le suivi des missions et le traitement des signalements.
          </li>
          <li>
            <strong>Stockage :</strong> les photos et captures sont conservées dans un espace de
            stockage privé, jamais accessible publiquement.
          </li>
          <li>
            <strong>Durée de conservation :</strong> les photos et captures sont supprimées
            automatiquement 12 mois après la fin de la mission, et jamais tant qu’un signalement est
            ouvert. Le numéro à payer, le nom du vendeur et le montant restent attachés à la mission
            tant que la mission et les comptes concernés existent.
          </li>
          <li>
            <strong>Droits :</strong> vous disposez des droits décrits à la section « Vos droits »,
            y compris si vous êtes un vendeur dont les données figurent dans une demande. Pour les
            exercer : contact@educash.bj
          </li>
        </ul>
      </LegalSection>

      <LegalSection {...SECTIONS.analyse_des_messages}>
        <p>
          Les messages échangés entre clients et étudiants sur la plateforme font l’objet d’une
          analyse automatique qui détecte et masque les coordonnées (numéros de téléphone,
          adresses e-mail, liens, pseudos de réseaux sociaux). Elle repère aussi les mentions qui
          invitent à échanger ou à payer en dehors de la plateforme (par exemple « réseaux
          sociaux » ou « paiement direct ») : ces mentions ne sont pas masquées, elles sont
          seulement journalisées.
        </p>
        <ul>
          <li>
            <strong>Finalités :</strong> la sécurité des utilisateurs, la lutte contre la fraude et
            le respect des règles de la plateforme (CGU).
          </li>
          <li>
            <strong>Base :</strong> l’exécution du contrat (CGU acceptées lors de l’inscription).
          </li>
          <li>
            <strong>Fonctionnement :</strong> le masquage ne refuse jamais l’envoi d’un message.
            Aucune décision automatique de suspension n’est prise : une suspension reste toujours
            décidée par une personne de l’équipe, après examen.
          </li>
          <li>
            <strong>Données journalisées :</strong> le type de coordonnée détecté, le nombre de
            détections (coordonnée masquée, ou mention d’échange ou de paiement hors plateforme), la
            date, le message concerné, l’expéditeur et la mission. La valeur de la coordonnée (le
            numéro, l’adresse, le lien ou le pseudo) n’est jamais journalisée.
          </li>
          <li>
            <strong>Signalements :</strong> vous pouvez signaler manuellement un message. Le
            signalement enregistre le motif, votre commentaire facultatif (dont les coordonnées sont
            masquées), le message concerné, son expéditeur et votre identité en tant que personne
            qui signale. Votre identité n’est jamais communiquée à la personne signalée.
          </li>
          <li>
            <strong>Accès :</strong> réservé à l’équipe d’administration d’EduCash, qui peut consulter
            le contenu d’un message signalé (texte, image, message vocal ou position). Des alertes
            répétées peuvent conduire à un examen de la situation par cette équipe.
          </li>
          <li>
            <strong>Durée de conservation :</strong> le journal de détection est supprimé
            automatiquement après 180 jours, et les signalements clôturés sont supprimés
            automatiquement 12 mois après leur clôture.
          </li>
          <li>
            <strong>Recherche de lieu :</strong> lorsque vous recherchez un lieu pour l’envoyer
            dans une conversation, le texte recherché est transmis à la Fondation OpenStreetMap
            (Royaume-Uni). Google Maps ne s’ouvre que lorsque vous cliquez sur « Ouvrir dans
            Google Maps » ou « Itinéraire » ; aucune carte n’est chargée sans votre action.
          </li>
        </ul>
        <p>
          Vous disposez à l’égard de ces données des droits décrits à la section suivante
          (accès, rectification, effacement, opposition). Pour les exercer ou pour contester une
          mesure : contact@educash.bj
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
