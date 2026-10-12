import { Html, Body, Container, Text, Button, Heading, Hr, Img } from "@react-email/components"
import { logoProps, styles } from "@/lib/email/brand"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{
 *   studentName: string,
 *   missionTitle: string,
 *   clientName: string,
 *   missionId: string,
 * }} props
 */
export default function ApplicationAccepted({
  studentName = "Étudiant",
  missionTitle = "la mission",
  clientName = "le client",
  missionId = "",
}) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Bonne nouvelle ! 🎉</Heading>

          <Text style={text}>Bonjour {studentName},</Text>

          <Text style={text}>
            Félicitations ! Votre candidature pour la mission{" "}
            <strong>« {missionTitle} »</strong> a été <strong>acceptée</strong> par {clientName}.
          </Text>

          <Text style={text}>
            Vous pouvez dès maintenant contacter {clientName} via la messagerie EduCash pour
            organiser les modalités de la mission.
          </Text>

          <Button href={`${APP_URL}/messages/${missionId}`} style={button}>
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
