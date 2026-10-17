import { Html, Body, Container, Text, Button, Heading, Hr, Img, Section } from "@react-email/components"
import { APP_URL, COLORS, logoProps, styles } from "@/lib/email/brand"
import { clientConversationHref } from "@/lib/app/client-routes"
import { PAYMENT_WARNING } from "@/lib/purchases/requests"

/**
 * Au client : l'étudiant retenu lui demande de payer un achat. Texte fixe : ni montant, ni nom ou numéro de
 * vendeur, ni lien de photo (le détail se lit dans la conversation de l'application). Le paiement se fait hors
 * EduCash, l'avertissement du produit (PAYMENT_WARNING) est repris tel quel.
 *
 * @param {{
 *   missionTitle?: string,
 *   missionId?: string,
 *   studentId?: string,
 *   requestId?: string,
 * }} props
 */
export default function PurchaseRequested({
  missionTitle = "",
  missionId = "",
  studentId = "",
  requestId = "",
}) {
  const what = missionTitle ? `« ${missionTitle} »` : "votre mission"
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Nouvelle demande de paiement d’achats</Heading>

          <Text style={text}>Bonjour,</Text>

          <Text style={text}>
            Votre étudiant vous demande de payer un achat pour {what}. Le paiement se fait hors EduCash,
            directement auprès du vendeur. Les détails de la demande se trouvent dans la conversation de la
            mission.
          </Text>

          <Section style={warning}>
            <Text style={warningText}>{PAYMENT_WARNING}</Text>
          </Section>

          <Button
            href={`${APP_URL}${clientConversationHref(missionId, studentId, { demande: requestId })}`}
            style={button}
          >
            Ouvrir la demande →
          </Button>

          <Hr style={hr} />
          <Text style={footer}>EduCash - Marketplace étudiant au Bénin</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = styles.body
const container = styles.container
const h1 = styles.h1
const text = styles.text
const button = styles.button
const hr = styles.hr
const footer = styles.footer

const warning = {
  backgroundColor: COLORS.peche,
  borderRadius: "8px",
  padding: "4px 16px",
  margin: "16px 0",
}
const warningText = { ...styles.text, margin: "8px 0" }
