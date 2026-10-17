import { Html, Body, Container, Text, Button, Heading, Hr, Img } from "@react-email/components"
import { APP_URL, logoProps, styles } from "@/lib/email/brand"
import { studentConversationHref } from "@/lib/app/student-routes"

/**
 * À l'étudiant : le client indique avoir payé la demande d'achats. Il confirme la réception depuis l'application.
 * Texte fixe : ni montant, ni nom ou numéro de vendeur, ni lien de photo. Aucun nom du client.
 *
 * @param {{
 *   missionTitle?: string,
 *   missionId?: string,
 *   requestId?: string,
 * }} props
 */
export default function PurchasePaid({ missionTitle = "", missionId = "", requestId = "" }) {
  const what = missionTitle ? `« ${missionTitle} »` : "votre mission"
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Paiement indiqué par le client</Heading>

          <Text style={text}>Bonjour,</Text>

          <Text style={text}>
            Le client indique avoir payé votre demande d’achats pour {what}. Confirmez la réception dès que le
            vendeur a reçu l’argent, depuis la conversation de la mission.
          </Text>

          <Button href={`${APP_URL}${studentConversationHref(missionId, { demande: requestId })}`} style={button}>
            Confirmer la réception →
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
