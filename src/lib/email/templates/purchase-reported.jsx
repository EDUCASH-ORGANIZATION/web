import { Html, Body, Container, Text, Button, Heading, Hr, Img } from "@react-email/components"
import { APP_URL, logoProps, styles } from "@/lib/email/brand"
import { clientConversationHref } from "@/lib/app/client-routes"
import { studentConversationHref } from "@/lib/app/student-routes"

/**
 * À l'autre partie : une demande d'achats a été signalée. L'auteur du signalement n'est pas désigné, le motif et le
 * commentaire ne sont pas repris. Texte fixe : ni montant, ni nom ou numéro de vendeur, ni lien de photo.
 *
 * @param {{
 *   recipient?: "client" | "student",
 *   missionTitle?: string,
 *   missionId?: string,
 *   studentId?: string,
 *   requestId?: string,
 * }} props `recipient` est le rôle du destinataire (il choisit le lien).
 */
export default function PurchaseReported({
  recipient = "client",
  missionTitle = "",
  missionId = "",
  studentId = "",
  requestId = "",
}) {
  const what = missionTitle ? `« ${missionTitle} »` : "la mission"
  const path =
    recipient === "student"
      ? studentConversationHref(missionId, { demande: requestId })
      : clientConversationHref(missionId, studentId, { demande: requestId })
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Demande d’achats signalée</Heading>

          <Text style={text}>Bonjour,</Text>

          <Text style={text}>
            Une demande d’achats a été signalée pour {what}. L’équipe EduCash examine le signalement. Vous
            pouvez consulter la demande dans la conversation de la mission.
          </Text>

          <Button href={`${APP_URL}${path}`} style={button}>
            Ouvrir la conversation →
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
